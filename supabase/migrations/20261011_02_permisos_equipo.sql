-- ============================================================
-- Tramitá — 02: Permisos del equipo (corrección de fondo)
-- Fecha: 2026-10-11
--
-- 1. staff_profile(roles): devuelve el perfil del usuario actual SOLO si
--    está activo, tiene uno de los roles indicados y (si está activada la
--    verificación en dos pasos del equipo) inició sesión con 2 factores.
--    En cualquier otro caso devuelve NULL. Reemplaza la validación
--    "v_admin.role NOT IN (...)", que dejaba pasar a usuarios sin sesión.
-- 2. current_user_role(): mismas reglas para las políticas RLS.
-- 3. Las funciones admin_* de catálogo, cuentas, cupones, configuración
--    y usuarios se recrean con la validación nueva; el resto de su lógica
--    queda igual. Las otras 11 admin_* las reescriben las migraciones
--    03, 04, 05 y 07 (ejecutar todas en orden, en la misma sesión).
-- Idempotente.
-- ============================================================
BEGIN;

-- Verificación en dos pasos obligatoria para el equipo (se activa desde
-- el panel → Configuración una vez que cada miembro la configuró).
INSERT INTO public.settings (key, value, description)
VALUES ('require_staff_mfa', 'false'::jsonb, 'Exigir verificación en dos pasos al equipo (validado en el servidor)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.staff_mfa_required()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT (value #>> '{}')::boolean FROM settings WHERE key = 'require_staff_mfa'), false);
$function$;

CREATE OR REPLACE FUNCTION public.staff_profile(p_roles user_role[])
 RETURNS users_profile
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v users_profile%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v FROM users_profile WHERE user_id = auth.uid() AND active = true;
  IF v.id IS NULL OR NOT (v.role = ANY (p_roles)) THEN
    RETURN NULL;
  END IF;
  IF staff_mfa_required() AND COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$function$;

-- Rol efectivo para RLS: NULL si no hay sesión, si la cuenta está
-- desactivada o si es del equipo y falta la verificación en dos pasos.
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT p.active THEN NULL
    WHEN p.role = 'cliente' THEN p.role
    WHEN staff_mfa_required() AND COALESCE(auth.jwt() ->> 'aal', '') <> 'aal2' THEN NULL
    ELSE p.role
  END
  FROM users_profile p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$function$;


-- admin_delete_category
CREATE OR REPLACE FUNCTION public.admin_delete_category(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_svc_count INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_svc_count FROM services WHERE category_id = p_id;
  IF v_svc_count > 0 THEN
    UPDATE categories SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Categoría desactivada (tiene ' || v_svc_count || ' servicios asociados).'
    );
  END IF;
  
  DELETE FROM categories WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Categoría eliminada.');
END;
$function$;

-- admin_delete_coupon
CREATE OR REPLACE FUNCTION public.admin_delete_coupon(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_used_count INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_used_count FROM coupon_redemptions WHERE coupon_id = p_id;
  IF v_used_count > 0 THEN
    UPDATE coupons SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Cupón desactivado (ya fue usado ' || v_used_count || ' veces).'
    );
  END IF;
  
  DELETE FROM coupons WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Cupón eliminado.');
END;
$function$;

-- admin_delete_payment_account
CREATE OR REPLACE FUNCTION public.admin_delete_payment_account(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_used_count INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_used_count FROM orders WHERE payment_account_id = p_id;
  IF v_used_count > 0 THEN
    UPDATE payment_accounts SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Cuenta desactivada (usada en ' || v_used_count || ' órdenes).'
    );
  END IF;
  
  DELETE FROM payment_accounts WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Cuenta eliminada.');
END;
$function$;

-- admin_delete_service
CREATE OR REPLACE FUNCTION public.admin_delete_service(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_order_count INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  -- Verificar si hay órdenes con este servicio
  SELECT COUNT(*) INTO v_order_count FROM order_items WHERE service_id = p_id;
  IF v_order_count > 0 THEN
    -- Solo desactivar en lugar de borrar
    UPDATE services SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Servicio desactivado (tiene ' || v_order_count || ' órdenes asociadas, no se puede eliminar definitivamente).'
    );
  END IF;
  
  -- Sin órdenes: borrado completo
  DELETE FROM services WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Servicio eliminado.');
END;
$function$;

-- admin_delete_user
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_profile_id uuid, p_hard_delete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
  v_order_count INTEGER;
  v_paid_count INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden eliminar usuarios.');
  END IF;
  
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  -- Proteger: no auto-eliminarse
  IF v_target.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puede eliminarse a sí mismo.');
  END IF;
  
  -- Contar órdenes del usuario
  SELECT COUNT(*) INTO v_order_count FROM orders WHERE user_id = p_profile_id;
  SELECT COUNT(*) INTO v_paid_count FROM orders WHERE user_id = p_profile_id AND payment_status = 'paid';
  
  -- Si tiene órdenes pagadas, solo permitir borrado suave
  IF v_paid_count > 0 AND p_hard_delete = true THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'error', 'No se puede eliminar definitivamente: el usuario tiene ' || v_paid_count || ' orden(es) pagada(s). Use desactivar en su lugar para preservar el histórico.'
    );
  END IF;
  
  IF p_hard_delete = true THEN
    -- BORRADO DURO: eliminar todo (solo si no tiene órdenes pagadas)
    -- Primero borrar del auth (cascada borra el perfil)
    DELETE FROM auth.users WHERE id = v_target.user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'hard_delete', true,
      'message', 'Usuario eliminado definitivamente.'
    );
  ELSE
    -- BORRADO SUAVE: desactivar y anonimizar datos personales
    UPDATE users_profile SET
      active = false,
      name = 'Usuario eliminado',
      phone = '',
      id_card = '',
      company = '',
      address = '',
      billing_email = ''
    WHERE id = p_profile_id;
    
    -- Cambiar email en auth a uno anónimo único
    UPDATE auth.users SET
      email = 'eliminado_' || v_target.id || '@tramita.app',
      banned_until = 'infinity'::timestamptz
    WHERE id = v_target.user_id;
    
    RETURN jsonb_build_object(
      'ok', true,
      'hard_delete', false,
      'message', 'Usuario eliminado (borrado suave). Se preserva el histórico de órdenes.'
    );
  END IF;
END;
$function$;

-- admin_save_category
CREATE OR REPLACE FUNCTION public.admin_save_category(p_id integer, p_name text, p_display_order integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_slug TEXT;
  v_result_id INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nombre requerido.');
  END IF;
  
  v_slug := lower(regexp_replace(unaccent(p_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM categories WHERE slug = v_slug) THEN
      v_slug := v_slug || '-' || floor(random() * 1000)::text;
    END IF;
    INSERT INTO categories (name, slug, display_order, active)
    VALUES (p_name, v_slug, COALESCE(p_display_order, 0), COALESCE(p_active, true))
    RETURNING id INTO v_result_id;
  ELSE
    UPDATE categories SET
      name = p_name,
      display_order = COALESCE(p_display_order, display_order),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

-- admin_save_coupon
CREATE OR REPLACE FUNCTION public.admin_save_coupon(p_id integer, p_code text, p_description text, p_coupon_type text, p_value integer, p_min_purchase integer, p_max_discount integer, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_per_user_limit integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_result_id INTEGER;
  v_code TEXT;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código requerido.');
  END IF;
  IF p_value IS NULL OR p_value <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Valor debe ser positivo.');
  END IF;
  IF p_coupon_type NOT IN ('percent', 'fixed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tipo inválido.');
  END IF;
  IF p_coupon_type = 'percent' AND p_value > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El porcentaje no puede superar 100%.');
  END IF;
  
  v_code := UPPER(TRIM(p_code));
  
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM coupons WHERE code = v_code) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un cupón con ese código.');
    END IF;
    INSERT INTO coupons (
      code, description, coupon_type, value, min_purchase, max_discount,
      valid_from, valid_until, usage_limit, per_user_limit, active, created_by
    ) VALUES (
      v_code, p_description, p_coupon_type::coupon_type, p_value,
      COALESCE(p_min_purchase, 0), p_max_discount,
      COALESCE(p_valid_from, NOW()), p_valid_until,
      p_usage_limit, COALESCE(p_per_user_limit, 1),
      COALESCE(p_active, true), v_admin.id
    ) RETURNING id INTO v_result_id;
  ELSE
    UPDATE coupons SET
      code = v_code,
      description = p_description,
      coupon_type = p_coupon_type::coupon_type,
      value = p_value,
      min_purchase = COALESCE(p_min_purchase, 0),
      max_discount = p_max_discount,
      valid_from = COALESCE(p_valid_from, valid_from),
      valid_until = p_valid_until,
      usage_limit = p_usage_limit,
      per_user_limit = COALESCE(p_per_user_limit, 1),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

-- admin_save_payment_account
CREATE OR REPLACE FUNCTION public.admin_save_payment_account(p_id integer, p_display_name text, p_payment_method text, p_bank text, p_currency text, p_iban text, p_account_number text, p_account_holder text, p_holder_id text, p_sinpe_number text, p_payment_link_url text, p_instructions text, p_display_order integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_result_id INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nombre requerido.');
  END IF;
  IF p_payment_method NOT IN ('sinpe', 'transferencia', 'deposito', 'link_bancario') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Método de pago inválido.');
  END IF;
  
  IF p_id IS NULL THEN
    INSERT INTO payment_accounts (
      display_name, payment_method, bank, currency, iban, account_number,
      account_holder, holder_id, sinpe_number, payment_link_url, instructions,
      display_order, active
    ) VALUES (
      p_display_name, p_payment_method::payment_method, p_bank, p_currency,
      p_iban, p_account_number, p_account_holder, p_holder_id, p_sinpe_number,
      p_payment_link_url, p_instructions, COALESCE(p_display_order, 0),
      COALESCE(p_active, true)
    ) RETURNING id INTO v_result_id;
  ELSE
    UPDATE payment_accounts SET
      display_name = p_display_name,
      payment_method = p_payment_method::payment_method,
      bank = p_bank,
      currency = p_currency,
      iban = p_iban,
      account_number = p_account_number,
      account_holder = p_account_holder,
      holder_id = p_holder_id,
      sinpe_number = p_sinpe_number,
      payment_link_url = p_payment_link_url,
      instructions = p_instructions,
      display_order = COALESCE(p_display_order, display_order),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

-- admin_save_setting
CREATE OR REPLACE FUNCTION public.admin_save_setting(p_key text, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  INSERT INTO settings (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, v_admin.id, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- admin_toggle_user_active
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(p_profile_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden activar/desactivar usuarios.');
  END IF;
  
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  -- Proteger: no auto-desactivarse
  IF v_target.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puede desactivarse a sí mismo.');
  END IF;
  
  -- Actualizar el flag active en el perfil
  UPDATE users_profile SET active = p_active WHERE id = p_profile_id;
  
  -- Si se desactiva: invalidar sesión actual banneando el auth
  IF p_active = false THEN
    UPDATE auth.users 
    SET banned_until = 'infinity'::timestamptz
    WHERE id = v_target.user_id;
  ELSE
    UPDATE auth.users 
    SET banned_until = NULL
    WHERE id = v_target.user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'active', p_active,
    'message', CASE WHEN p_active THEN 'Usuario activado' ELSE 'Usuario desactivado' END
  );
END;
$function$;


-- Solo usuarios con sesión pueden ejecutar funciones admin_* y staff_profile
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'admin\_%' OR p.proname IN ('staff_profile', 'staff_mfa_required'))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

COMMIT;
