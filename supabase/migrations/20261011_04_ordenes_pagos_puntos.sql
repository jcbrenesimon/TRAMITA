-- ============================================================
-- Tramitá — 04: Órdenes, cupones, puntos y comprobantes
-- Fecha: 2026-10-11
--
-- create_order() y validate_coupon(): precios, cupones, puntos y totales
-- se calculan en la base de datos. Registro de usos de cupón, reserva y
-- devolución de puntos, aprobación, rechazo y cancelación de órdenes,
-- comprobantes y carpetas de Storage por cliente.
-- Idempotente.
-- ============================================================
BEGIN;

-- ---------- Utilidades ----------
CREATE OR REPLACE FUNCTION public.setting_numeric(p_key text)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT NULLIF(value #>> '{}', '')::numeric FROM settings WHERE key = p_key), 0);
$function$;

CREATE OR REPLACE FUNCTION public.setting_bool(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT (value #>> '{}')::boolean FROM settings WHERE key = p_key), false);
$function$;

CREATE OR REPLACE FUNCTION public.fmt_crc(p numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT '₡' || replace(to_char(p, 'FM999,999,999,990'), ',', '.');
$function$;

-- Descuento que da un cupón sobre un subtotal
CREATE OR REPLACE FUNCTION public.coupon_discount(p_coupon coupons, p_subtotal integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE v integer;
BEGIN
  IF p_coupon.coupon_type = 'percent' THEN
    v := floor(p_subtotal * p_coupon.value / 100.0)::integer;
  ELSE
    v := p_coupon.value;
  END IF;
  IF p_coupon.max_discount IS NOT NULL AND v > p_coupon.max_discount THEN
    v := p_coupon.max_discount;
  END IF;
  RETURN LEAST(GREATEST(v, 0), p_subtotal);
END;
$function$;

-- NULL si el cupón se puede usar; si no, el motivo
CREATE OR REPLACE FUNCTION public.coupon_error(p_coupon coupons, p_profile_id uuid, p_subtotal integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_used integer;
BEGIN
  IF p_coupon.id IS NULL OR NOT p_coupon.active THEN
    RETURN 'Cupón no encontrado o inactivo';
  END IF;
  IF p_coupon.valid_until IS NOT NULL AND p_coupon.valid_until < now() THEN
    RETURN 'Cupón expirado';
  END IF;
  IF p_coupon.valid_from IS NOT NULL AND p_coupon.valid_from > now() THEN
    RETURN 'Cupón aún no vigente';
  END IF;
  IF p_coupon.usage_limit IS NOT NULL AND p_coupon.usage_count >= p_coupon.usage_limit THEN
    RETURN 'Cupón agotado';
  END IF;
  IF p_coupon.per_user_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM coupon_redemptions
    WHERE coupon_id = p_coupon.id AND user_id = p_profile_id;
    IF v_used >= p_coupon.per_user_limit THEN
      RETURN 'Ya utilizó este cupón';
    END IF;
  END IF;
  IF p_subtotal < COALESCE(p_coupon.min_purchase, 0) THEN
    RETURN 'Compra mínima de ' || fmt_crc(p_coupon.min_purchase);
  END IF;
  RETURN NULL;
END;
$function$;

-- ---------- #6: validar cupón desde la web ----------
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text, p_subtotal integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_c coupons%ROWTYPE;
  v_err text;
BEGIN
  SELECT id INTO v_profile_id FROM users_profile WHERE user_id = auth.uid() AND active;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Inicie sesión para usar cupones.');
  END IF;
  SELECT * INTO v_c FROM coupons WHERE code = upper(trim(p_code));
  v_err := coupon_error(v_c, v_profile_id, COALESCE(p_subtotal, 0));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', v_err);
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'code', v_c.code, 'coupon_type', v_c.coupon_type, 'value', v_c.value,
    'max_discount', v_c.max_discount, 'discount', coupon_discount(v_c, COALESCE(p_subtotal, 0)));
END;
$function$;

-- ---------- crear orden en el servidor ----------
CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_payment_account_id integer,
  p_coupon_code text DEFAULT NULL,
  p_use_points boolean DEFAULT false,
  p_shipping_address text DEFAULT '',
  p_customer_notes text DEFAULT '')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p users_profile%ROWTYPE;
  v_acc payment_accounts%ROWTYPE;
  v_coupon coupons%ROWTYPE;
  v_svc services%ROWTYPE;
  r record;
  v_qty integer;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal integer := 0;
  v_earned integer := 0;
  v_line_earned integer;
  v_coupon_disc integer := 0;
  v_err text;
  v_pv numeric;
  v_balance integer;
  v_points_used integer := 0;
  v_points_disc integer := 0;
  v_total integer;
  v_ref text;
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM users_profile WHERE user_id = auth.uid() AND active FOR UPDATE;
  IF v_p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Inicie sesión para continuar.');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El carrito está vacío.');
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Demasiados servicios en una sola orden.');
  END IF;

  SELECT * INTO v_acc FROM payment_accounts WHERE id = p_payment_account_id AND active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Seleccione un método de pago válido.');
  END IF;

  -- Servicios: precio y puntos SIEMPRE desde la base de datos
  FOR r IN
    SELECT (e->>'service_id')::integer AS service_id,
           sum(GREATEST(COALESCE((e->>'quantity')::integer, 1), 1))::integer AS quantity
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1
  LOOP
    SELECT * INTO v_svc FROM services WHERE id = r.service_id AND active;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Uno de los servicios ya no está disponible. Actualice su carrito.');
    END IF;
    v_qty := LEAST(r.quantity, 20);
    v_line_earned := floor(v_svc.price * v_qty * v_svc.points_percentage / 100)::integer;
    v_subtotal := v_subtotal + v_svc.price * v_qty;
    v_earned := v_earned + v_line_earned;
    v_lines := v_lines || jsonb_build_object(
      'service_id', v_svc.id, 'service_name', v_svc.name, 'service_price', v_svc.price,
      'quantity', v_qty, 'subtotal', v_svc.price * v_qty, 'points_earned', v_line_earned);
  END LOOP;

  -- Cupón (bloqueado para que dos compras simultáneas no superen el límite)
  IF NULLIF(trim(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE code = upper(trim(p_coupon_code)) FOR UPDATE;
    v_err := coupon_error(v_coupon, v_p.id, v_subtotal);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', v_err);
    END IF;
    v_coupon_disc := coupon_discount(v_coupon, v_subtotal);
  END IF;

  -- Puntos
  v_pv := setting_numeric('point_value_crc');
  v_balance := COALESCE(v_p.points_balance, 0);
  IF COALESCE(p_use_points, false) AND v_pv > 0 AND v_balance > 0
     AND (v_coupon.id IS NULL OR setting_bool('allow_combine_coupon_and_points')) THEN
    v_points_used := LEAST(v_balance, floor((v_subtotal - v_coupon_disc) / v_pv)::integer);
    v_points_disc := floor(v_points_used * v_pv)::integer;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_coupon_disc - v_points_disc);
  v_ref := generate_order_reference();

  INSERT INTO orders (
    reference, user_id, order_status, payment_status, payment_method, payment_account_id,
    subtotal, discount_amount, points_used, points_discount, points_earned, total,
    coupon_id, coupon_code, shipping_address, customer_notes
  ) VALUES (
    v_ref, v_p.id, 'pendiente_de_pago', 'pending', v_acc.payment_method, v_acc.id,
    v_subtotal, v_coupon_disc, v_points_used, v_points_disc, v_earned, v_total,
    v_coupon.id, v_coupon.code, left(COALESCE(p_shipping_address, ''), 300), left(COALESCE(p_customer_notes, ''), 1000)
  ) RETURNING * INTO v_order;

  INSERT INTO order_items (order_id, service_id, service_name, service_price, quantity, subtotal, points_earned)
  SELECT v_order.id, (l->>'service_id')::integer, l->>'service_name', (l->>'service_price')::integer,
         (l->>'quantity')::integer, (l->>'subtotal')::integer, (l->>'points_earned')::integer
  FROM jsonb_array_elements(v_lines) l;

  -- Reservar puntos
  IF v_points_used > 0 THEN
    INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
    VALUES (v_p.id, v_order.id, 'redeemed', -v_points_used, v_balance - v_points_used,
            'Canje de puntos en orden ' || v_ref, v_p.id);
  END IF;

  -- Reservar cupón
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
    VALUES (v_coupon.id, v_order.id, v_p.id, v_coupon_disc);
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'order', to_jsonb(v_order));
END;
$function$;

-- ---------- Políticas: escritura directa solo por funciones ----------
DROP POLICY IF EXISTS ord_insert ON public.orders;
DROP POLICY IF EXISTS ord_update ON public.orders;
DROP POLICY IF EXISTS ord_delete ON public.orders;
DROP POLICY IF EXISTS oi_insert ON public.order_items;
DROP POLICY IF EXISTS pr_update ON public.payment_receipts;
DROP POLICY IF EXISTS pl_insert ON public.points_ledger;
DROP POLICY IF EXISTS cr_insert ON public.coupon_redemptions;

-- ---------- comprobantes ----------
CREATE OR REPLACE FUNCTION public.enforce_receipt_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_profile_id uuid := current_user_profile_id();
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada.' USING ERRCODE = '42501';
  END IF;
  IF v_order.user_id IS DISTINCT FROM v_profile_id
     AND current_user_role() NOT IN ('admin', 'operador') THEN
    RAISE EXCEPTION 'Sin permisos para esta orden.' USING ERRCODE = '42501';
  END IF;
  IF v_order.order_status = 'cancelado' OR v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Esta orden ya no admite comprobantes.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_receipts WHERE order_id = NEW.order_id AND status = 'pendiente') THEN
    RAISE EXCEPTION 'Ya hay un comprobante en revisión para esta orden.' USING ERRCODE = '42501';
  END IF;
  IF NEW.storage_path IS NULL OR NEW.storage_path NOT LIKE v_order.user_id::text || '/' || v_order.id::text || '/%' THEN
    RAISE EXCEPTION 'Ruta de archivo inválida.' USING ERRCODE = '42501';
  END IF;

  NEW.status := 'pendiente';
  NEW.verified_by := NULL;
  NEW.verified_at := NULL;
  NEW.rejection_reason := NULL;
  NEW.notes := '';
  NEW.uploaded_by := v_profile_id;
  NEW.amount := v_order.total;
  NEW.payment_method := COALESCE(v_order.payment_method, NEW.payment_method);
  NEW.payment_account_id := v_order.payment_account_id;
  NEW.reference_number := left(NEW.reference_number, 100);
  NEW.original_filename := left(NEW.original_filename, 200);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_enforce_receipt_insert ON public.payment_receipts;
CREATE TRIGGER tg_enforce_receipt_insert BEFORE INSERT ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_receipt_insert();

-- ---------- #5: Storage, cada cliente en su carpeta ----------
DROP POLICY IF EXISTS receipts_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS receipts_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS receipts_owner_select ON storage.objects;
DROP POLICY IF EXISTS receipts_owner_insert ON storage.objects;
DROP POLICY IF EXISTS documents_owner_select ON storage.objects;
DROP POLICY IF EXISTS documents_owner_insert ON storage.objects;

CREATE POLICY receipts_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = public.current_user_profile_id()::text);
CREATE POLICY receipts_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (
    (storage.foldername(name))[1] = public.current_user_profile_id()::text
    OR public.current_user_role() IN ('admin', 'operador', 'consulta')));
CREATE POLICY documents_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = public.current_user_profile_id()::text
    OR public.current_user_role() IN ('admin', 'operador')));
CREATE POLICY documents_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (
    (storage.foldername(name))[1] = public.current_user_profile_id()::text
    OR public.current_user_role() IN ('admin', 'operador', 'consulta')));

-- ---------- Aprobar comprobante ----------
CREATE OR REPLACE FUNCTION public.admin_approve_receipt(p_receipt_id uuid, p_admin_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_receipt payment_receipts%ROWTYPE;
  v_order orders%ROWTYPE;
  v_user users_profile%ROWTYPE;
  v_balance integer;
  v_redeem integer;
  v_referrer_bonus integer;
  v_welcome_bonus integer;
  v_is_first_paid_order boolean;
  v_notes text := COALESCE(p_admin_notes, '');
  v_points_credited integer := 0;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;

  SELECT * INTO v_receipt FROM payment_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Comprobante no encontrado.');
  END IF;
  IF v_receipt.status <> 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este comprobante ya fue revisado.');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_receipt.order_id FOR UPDATE;
  IF v_order.order_status = 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La orden está cancelada.');
  END IF;
  SELECT * INTO v_user FROM users_profile WHERE id = v_order.user_id FOR UPDATE;

  UPDATE payment_receipts SET
    status = 'aprobado', verified_by = v_admin.id, verified_at = NOW(),
    notes = COALESCE(NULLIF(v_notes, ''), notes)
  WHERE id = p_receipt_id;

  -- #7: si la orden ya estaba pagada, no se acredita nada otra vez
  IF v_order.payment_status <> 'paid' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM orders WHERE user_id = v_user.id AND payment_status = 'paid' AND id <> v_order.id
    ) INTO v_is_first_paid_order;

    UPDATE orders SET
      payment_status = 'paid',
      order_status = CASE WHEN order_status IN ('pendiente', 'pendiente_de_pago') THEN 'pagado'::order_status ELSE order_status END,
      paid_at = NOW()
    WHERE id = v_order.id;

    -- Órdenes creadas antes de create_order(): canjear puntos ahora
    IF v_order.points_used > 0 AND NOT EXISTS (
      SELECT 1 FROM points_ledger WHERE order_id = v_order.id AND user_id = v_user.id AND movement = 'redeemed'
    ) THEN
      SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_user.id;
      v_redeem := LEAST(v_order.points_used, GREATEST(v_balance, 0));
      IF v_redeem > 0 THEN
        INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
        VALUES (v_user.id, v_order.id, 'redeemed', -v_redeem, v_balance - v_redeem,
                'Canje de puntos en orden ' || v_order.reference, v_admin.id);
      END IF;
    END IF;

    -- Órdenes creadas antes de create_order(): registrar el cupón ahora
    IF v_order.coupon_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM coupon_redemptions WHERE order_id = v_order.id
    ) THEN
      INSERT INTO coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
      VALUES (v_order.coupon_id, v_order.id, v_user.id, v_order.discount_amount);
      UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_order.coupon_id;
    END IF;

    -- Puntos ganados (una sola vez por orden)
    IF v_order.points_earned > 0 AND NOT EXISTS (
      SELECT 1 FROM points_ledger WHERE order_id = v_order.id AND user_id = v_user.id
        AND movement = 'earned' AND description LIKE 'Puntos por orden %'
    ) THEN
      SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_user.id;
      INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
      VALUES (v_user.id, v_order.id, 'earned', v_order.points_earned, v_balance + v_order.points_earned,
              'Puntos por orden ' || v_order.reference, v_admin.id);
      v_points_credited := v_order.points_earned;
    END IF;

    -- Bonos de referido en la primera compra pagada
    IF v_is_first_paid_order AND v_user.referred_by IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_user.id AND bonus_awarded_at IS NOT NULL) THEN
      v_referrer_bonus := setting_numeric('referral_bonus_points')::integer;
      v_welcome_bonus := setting_numeric('referred_welcome_points')::integer;

      IF v_referrer_bonus > 0 THEN
        SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_user.referred_by FOR UPDATE;
        INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
        VALUES (v_user.referred_by, v_order.id, 'earned', v_referrer_bonus, COALESCE(v_balance, 0) + v_referrer_bonus,
                'Bonus por referir a ' || v_user.name, v_admin.id);
      END IF;
      IF v_welcome_bonus > 0 THEN
        SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_user.id;
        INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
        VALUES (v_user.id, v_order.id, 'earned', v_welcome_bonus, COALESCE(v_balance, 0) + v_welcome_bonus,
                'Bonus de bienvenida por referido', v_admin.id);
      END IF;

      INSERT INTO referrals (referrer_id, referred_id, first_order_id, bonus_points_awarded, bonus_awarded_at)
      VALUES (v_user.referred_by, v_user.id, v_order.id, GREATEST(v_referrer_bonus, 0), NOW())
      ON CONFLICT (referred_id) DO UPDATE SET
        first_order_id = EXCLUDED.first_order_id,
        bonus_points_awarded = EXCLUDED.bonus_points_awarded,
        bonus_awarded_at = NOW();
    END IF;
  END IF;

  INSERT INTO order_notes (order_id, author_id, author_name, kind, content)
  VALUES (v_order.id, v_admin.id, v_admin.name, 'system',
          'Comprobante aprobado por ' || v_admin.name ||
          CASE WHEN v_notes <> '' THEN '. Nota: ' || v_notes ELSE '' END ||
          CASE WHEN v_order.payment_status = 'paid' THEN ' (la orden ya estaba pagada; no se acreditaron puntos)' ELSE '' END);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_reference', v_order.reference,
    'user_name', v_user.name,
    'user_phone', v_user.phone,
    'points_earned', v_points_credited,
    'total', v_order.total);
END;
$function$;

-- ---------- Rechazar comprobante ----------
CREATE OR REPLACE FUNCTION public.admin_reject_receipt(p_receipt_id uuid, p_rejection_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt payment_receipts%ROWTYPE;
  v_order orders%ROWTYPE;
  v_admin users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Se requiere motivo del rechazo.');
  END IF;

  SELECT * INTO v_receipt FROM payment_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Comprobante no encontrado.');
  END IF;
  IF v_receipt.status <> 'pendiente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este comprobante ya fue revisado.');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_receipt.order_id;

  UPDATE payment_receipts SET
    status = 'rechazado', verified_by = v_admin.id, verified_at = NOW(),
    rejection_reason = left(p_rejection_reason, 500)
  WHERE id = p_receipt_id;

  INSERT INTO order_notes (order_id, author_id, author_name, kind, content)
  VALUES (v_order.id, v_admin.id, v_admin.name, 'system',
          'Comprobante rechazado por ' || v_admin.name || '. Motivo: ' || left(p_rejection_reason, 500));

  RETURN jsonb_build_object('ok', true, 'order_reference', v_order.reference);
END;
$function$;

-- ---------- Cambiar estado (con cancelación completa) ----------
DROP FUNCTION IF EXISTS public.admin_update_order_status(uuid, order_status, text);
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_new_status order_status, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_order orders%ROWTYPE;
  v_balance integer;
  v_redeemed integer;
  v_returned integer;
  v_earned integer;
  v_reversed integer;
  v_extra text := '';
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orden no encontrada.');
  END IF;
  IF v_order.order_status = p_new_status THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La orden ya tiene ese estado.');
  END IF;
  IF v_order.order_status = 'cancelado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La orden está cancelada y no se puede modificar.');
  END IF;
  IF p_new_status IN ('pagado', 'en_revision', 'en_proceso', 'pendiente_de_documentos', 'completado', 'entregado')
     AND v_order.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Primero debe aprobarse el comprobante de pago.');
  END IF;
  IF p_new_status IN ('pendiente', 'pendiente_de_pago') AND v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La orden ya está pagada.');
  END IF;

  IF p_new_status = 'cancelado' THEN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;

    -- Devolver puntos canjeados
    SELECT COALESCE(-sum(points), 0) INTO v_redeemed FROM points_ledger
    WHERE order_id = v_order.id AND user_id = v_order.user_id AND movement = 'redeemed';
    SELECT COALESCE(sum(points), 0) INTO v_returned FROM points_ledger
    WHERE order_id = v_order.id AND user_id = v_order.user_id AND movement = 'adjusted'
      AND description LIKE 'Devolución de puntos%';
    IF v_redeemed - v_returned > 0 THEN
      SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_order.user_id FOR UPDATE;
      INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
      VALUES (v_order.user_id, v_order.id, 'adjusted', v_redeemed - v_returned, v_balance + v_redeemed - v_returned,
              'Devolución de puntos por cancelación de ' || v_order.reference, v_admin.id);
      v_extra := v_extra || '. Se devolvieron ' || (v_redeemed - v_returned) || ' puntos';
    END IF;

    -- Revertir puntos ganados (hasta donde alcance el saldo)
    SELECT COALESCE(sum(points), 0) INTO v_earned FROM points_ledger
    WHERE order_id = v_order.id AND user_id = v_order.user_id AND movement = 'earned'
      AND description LIKE 'Puntos por orden %';
    SELECT COALESCE(-sum(points), 0) INTO v_reversed FROM points_ledger
    WHERE order_id = v_order.id AND user_id = v_order.user_id AND movement = 'adjusted'
      AND description LIKE 'Reverso de puntos%';
    IF v_earned - v_reversed > 0 THEN
      SELECT points_balance INTO v_balance FROM users_profile WHERE id = v_order.user_id FOR UPDATE;
      v_earned := LEAST(v_earned - v_reversed, GREATEST(v_balance, 0));
      IF v_earned > 0 THEN
        INSERT INTO points_ledger (user_id, order_id, movement, points, balance_after, description, created_by)
        VALUES (v_order.user_id, v_order.id, 'adjusted', -v_earned, v_balance - v_earned,
                'Reverso de puntos por cancelación de ' || v_order.reference, v_admin.id);
        v_extra := v_extra || '. Se revirtieron ' || v_earned || ' puntos ganados';
      END IF;
    END IF;

    -- Liberar cupón
    IF EXISTS (SELECT 1 FROM coupon_redemptions WHERE order_id = v_order.id) THEN
      UPDATE coupons c SET usage_count = GREATEST(c.usage_count - r.n, 0)
      FROM (SELECT coupon_id, count(*) AS n FROM coupon_redemptions WHERE order_id = v_order.id GROUP BY coupon_id) r
      WHERE c.id = r.coupon_id;
      DELETE FROM coupon_redemptions WHERE order_id = v_order.id;
      v_extra := v_extra || '. Se liberó el cupón';
    END IF;

    UPDATE orders SET
      order_status = 'cancelado',
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded'::payment_status ELSE 'cancelled'::payment_status END
    WHERE id = v_order.id;

    IF v_order.payment_status = 'paid' THEN
      v_extra := v_extra || '. El pago quedó como REEMBOLSADO: realice la devolución del dinero al cliente';
    END IF;
  ELSE
    UPDATE orders SET
      order_status = p_new_status,
      completed_at = CASE WHEN p_new_status IN ('completado', 'entregado') AND completed_at IS NULL THEN NOW() ELSE completed_at END
    WHERE id = v_order.id;
  END IF;

  INSERT INTO order_notes (order_id, author_id, author_name, kind, content)
  VALUES (v_order.id, v_admin.id, v_admin.name, 'system',
          'Estado cambiado de "' || v_order.order_status || '" a "' || p_new_status || '"' || v_extra ||
          CASE WHEN COALESCE(p_note, '') <> '' THEN '. Nota: ' || left(p_note, 500) ELSE '' END);

  RETURN jsonb_build_object('ok', true, 'message', NULLIF(ltrim(v_extra, '. '), ''));
END;
$function$;

-- ---------- Notas (parámetros con prefijo p_) ----------
DROP FUNCTION IF EXISTS public.admin_add_order_note(uuid, text, note_kind);
CREATE OR REPLACE FUNCTION public.admin_add_order_note(p_order_id uuid, p_content text, p_kind note_kind DEFAULT 'internal'::note_kind)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  IF p_content IS NULL OR TRIM(p_content) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La nota no puede estar vacía.');
  END IF;
  IF p_kind = 'system' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tipo de nota inválido.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orden no encontrada.');
  END IF;

  INSERT INTO order_notes (order_id, author_id, author_name, kind, content)
  VALUES (p_order_id, v_admin.id, v_admin.name, p_kind, left(p_content, 2000));

  IF p_kind = 'whatsapp' THEN
    UPDATE orders SET last_contact_at = NOW() WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- Cupones: una sola columna de usos ----------
-- usage_count es la columna real; used_count era un duplicado que nadie actualizaba.
ALTER TABLE public.coupons DROP COLUMN IF EXISTS used_count;

-- ---------- Permisos de ejecución ----------
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, integer, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, integer, text, boolean, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coupon_error(coupons, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_reference() FROM PUBLIC, anon, authenticated;

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
