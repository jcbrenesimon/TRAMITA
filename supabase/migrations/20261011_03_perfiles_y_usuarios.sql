-- ============================================================
-- Tramitá — 03: Perfiles, registro y usuarios del equipo
-- Fecha: 2026-10-11
--
-- H2  El cliente ya no puede cambiar su rol, puntos, código de referido,
--     referido por, estado ni correo (trigger protect_profile_columns).
-- H3  Se elimina la política que dejaba al operador editar cualquier
--     perfil; el equipo solo modifica perfiles mediante funciones admin_*.
-- #12 El registro guarda todos los datos desde el trigger (sin la espera
--     de 800 ms) y funciona con confirmación de correo.
-- #13 admin_create_user crea también la identity de Supabase Auth y se
--     reparan los usuarios existentes sin identity (operador@tramita.app).
-- #16 Contraseñas de mínimo 8 caracteres en las funciones del equipo.
-- #18 Registro de la aceptación de términos (terms_accepted_at).
-- Idempotente.
-- ============================================================
BEGIN;

ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- ---------- Políticas de users_profile ----------
DROP POLICY IF EXISTS up_update_staff ON public.users_profile;   -- H3
DROP POLICY IF EXISTS up_insert_admin ON public.users_profile;   -- perfiles los crea el trigger / RPC
DROP POLICY IF EXISTS up_delete_admin ON public.users_profile;   -- borrado solo con admin_delete_user

-- ---------- H2: columnas protegidas ----------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Las funciones SECURITY DEFINER (admin_*, aprobación, puntos) corren como
  -- el dueño de la función; las peticiones de la API corren como
  -- authenticated/anon y solo pueden cambiar datos personales.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.points_balance IS DISTINCT FROM OLD.points_balance
       OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
       OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
       OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'No se permite modificar este campo del perfil.' USING ERRCODE = '42501';
    END IF;
    NEW.name := left(NEW.name, 150);
    NEW.id_card := left(NEW.id_card, 30);
    NEW.phone := left(NEW.phone, 30);
    NEW.company := left(NEW.company, 150);
    NEW.address := left(NEW.address, 300);
    NEW.billing_email := left(NEW.billing_email, 200);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_protect_profile ON public.users_profile;
CREATE TRIGGER tg_protect_profile BEFORE UPDATE ON public.users_profile
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- El saldo lo mantiene el historial de puntos (corre como dueño)
CREATE OR REPLACE FUNCTION public.update_user_points_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE users_profile SET points_balance = NEW.balance_after WHERE id = NEW.user_id;
  RETURN NEW;
END;
$function$;

-- ---------- #12 / #18: registro ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.users_profile (
    user_id, email, name, id_card, phone, company, address, billing_email,
    referral_code, terms_accepted_at
  ) VALUES (
    NEW.id,
    NEW.email,
    left(COALESCE(m->>'name', ''), 150),
    left(COALESCE(m->>'id_card', ''), 30),
    left(COALESCE(m->>'phone', ''), 30),
    left(COALESCE(m->>'company', ''), 150),
    left(COALESCE(m->>'address', ''), 300),
    left(COALESCE(NULLIF(m->>'billing_email', ''), NEW.email), 200),
    public.generate_referral_code(),
    CASE WHEN COALESCE((m->>'terms_accepted')::boolean, false) THEN now() END
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- ---------- #13: identities faltantes y tokens NULL ----------
-- Usuarios insertados directo en auth.users (versión anterior de
-- admin_create_user) no tienen identity y no pueden iniciar sesión.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', NULL, now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL
   OR email_change_token_new IS NULL OR email_change IS NULL;

-- ---------- admin_create_user ----------
CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_name text, p_phone text DEFAULT ''::text, p_id_card text DEFAULT ''::text, p_role text DEFAULT 'operador'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_new_user_id UUID := gen_random_uuid();
  v_email TEXT := LOWER(TRIM(p_email));
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden crear usuarios.');
  END IF;
  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Correo inválido.');
  END IF;
  IF p_password IS NULL OR LENGTH(p_password) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 8 caracteres.');
  END IF;
  IF p_role NOT IN ('cliente', 'operador', 'admin', 'consulta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rol inválido.');
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un usuario con ese correo.');
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_new_user_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name, 'phone', p_phone, 'id_card', p_id_card),
    '', '', '', ''
  );

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (v_new_user_id::text, v_new_user_id,
          jsonb_build_object('sub', v_new_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', NULL, NOW(), NOW());

  -- El trigger handle_new_user ya creó el perfil; se asigna el rol
  UPDATE users_profile SET role = p_role::user_role WHERE user_id = v_new_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', v_new_user_id, 'email', v_email, 'name', p_name, 'role', p_role);
END;
$function$;

-- ---------- admin_reset_password (mínimo 8) ----------
CREATE OR REPLACE FUNCTION public.admin_reset_password(p_profile_id uuid, p_new_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden resetear contraseñas.');
  END IF;
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 8 caracteres.');
  END IF;
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  IF v_target.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cambie su propia contraseña desde "¿Olvidó su contraseña?".');
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = NOW()
  WHERE id = v_target.user_id;

  RETURN jsonb_build_object('ok', true, 'email', v_target.email, 'message', 'Contraseña actualizada');
END;
$function$;

-- ---------- admin_update_user (solo admin, como indica la matriz de permisos) ----------
CREATE OR REPLACE FUNCTION public.admin_update_user(p_profile_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_id_card text DEFAULT NULL::text, p_company text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_billing_email text DEFAULT NULL::text)
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

  UPDATE users_profile SET
    name = left(COALESCE(p_name, name), 150),
    phone = left(COALESCE(p_phone, phone), 30),
    id_card = left(COALESCE(p_id_card, id_card), 30),
    company = left(COALESCE(p_company, company), 150),
    address = left(COALESCE(p_address, address), 300),
    billing_email = left(COALESCE(p_billing_email, billing_email), 200)
  WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- admin_set_user_role (parámetros con prefijo p_) ----------
DROP FUNCTION IF EXISTS public.admin_set_user_role(uuid, user_role);
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_profile_id uuid, p_new_role user_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo admin puede cambiar roles.');
  END IF;
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  IF v_target.id = v_admin.id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puede cambiar su propio rol.');
  END IF;

  UPDATE users_profile SET role = p_new_role WHERE id = p_profile_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- admin_adjust_points (parámetros con prefijo p_) ----------
DROP FUNCTION IF EXISTS public.admin_adjust_points(uuid, integer, text);
CREATE OR REPLACE FUNCTION public.admin_adjust_points(p_profile_id uuid, p_points_delta integer, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_user users_profile%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo admin puede ajustar puntos.');
  END IF;
  IF p_points_delta IS NULL OR p_points_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Indique una cantidad distinta de cero.');
  END IF;
  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Indique el motivo del ajuste.');
  END IF;

  SELECT * INTO v_user FROM users_profile WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;

  v_new_balance := COALESCE(v_user.points_balance, 0) + p_points_delta;
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El balance no puede quedar negativo.');
  END IF;

  INSERT INTO points_ledger (user_id, movement, points, balance_after, description, created_by)
  VALUES (p_profile_id, 'adjusted', p_points_delta, v_new_balance, left(p_description, 300), v_admin.id);

  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$function$;

-- Solo usuarios con sesión pueden ejecutar funciones admin_*
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'admin\_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

COMMIT;
