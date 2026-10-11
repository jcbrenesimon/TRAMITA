-- ============================================================
-- Tramitá — 05: Búsqueda paginada en el servidor y dashboard en hora de Costa Rica
-- Fecha: 2026-10-11
--
-- H13/#19 admin_search_orders / admin_search_users: búsqueda, filtros y
--         paginación en la base de datos (antes: 200 órdenes / 500 usuarios
--         filtrados en el navegador).
-- #20     admin_dashboard_kpis: "hoy" y "este mes" en America/Costa_Rica.
-- Idempotente.
-- ============================================================
BEGIN;

CREATE INDEX IF NOT EXISTS idx_users_profile_name ON public.users_profile (lower(name));

-- Escapa % y _ para usar el texto del usuario dentro de ILIKE
CREATE OR REPLACE FUNCTION public.like_escape(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT replace(replace(replace(COALESCE(p, ''), '\', '\\'), '%', '\%'), '_', '\_');
$function$;

CREATE OR REPLACE FUNCTION public.admin_search_orders(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_q text := '%' || like_escape(lower(unaccent(trim(COALESCE(p_search, ''))))) || '%';
  v_has_q boolean := trim(COALESCE(p_search, '')) <> '';
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador', 'consulta']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;

  WITH f AS (
    SELECT o.*
    FROM orders o
    JOIN users_profile u ON u.id = o.user_id
    WHERE (p_status IS NULL OR p_status = 'all' OR o.order_status::text = p_status)
      AND (NOT v_has_q
        OR lower(o.reference) LIKE v_q
        OR lower(unaccent(u.name)) LIKE v_q
        OR lower(u.email) LIKE v_q
        OR lower(COALESCE(u.id_card, '')) LIKE v_q
        OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') LIKE '%' || NULLIF(regexp_replace(p_search, '\D', '', 'g'), '') || '%')
  )
  SELECT
    (SELECT count(*) FROM f),
    COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'created_at') DESC) FROM (
      SELECT jsonb_build_object(
        'id', f.id, 'reference', f.reference, 'total', f.total,
        'order_status', f.order_status, 'payment_status', f.payment_status, 'created_at', f.created_at,
        'users_profile', (SELECT jsonb_build_object('name', u.name, 'phone', u.phone, 'email', u.email)
                          FROM users_profile u WHERE u.id = f.user_id),
        'order_items', COALESCE((SELECT jsonb_agg(jsonb_build_object('service_name', i.service_name, 'quantity', i.quantity))
                                 FROM order_items i WHERE i.order_id = f.id), '[]'::jsonb),
        'payment_receipts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'created_at', r.created_at)
                                      ORDER BY r.created_at) FROM payment_receipts r WHERE r.order_id = f.id), '[]'::jsonb)
      ) AS row
      FROM f ORDER BY f.created_at DESC LIMIT v_limit OFFSET v_offset
    ) s), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_search text DEFAULT '',
  p_role text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_q text := '%' || like_escape(lower(unaccent(trim(COALESCE(p_search, ''))))) || '%';
  v_has_q boolean := trim(COALESCE(p_search, '')) <> '';
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador', 'consulta']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;

  WITH f AS (
    SELECT u.* FROM users_profile u
    WHERE (p_role IS NULL OR p_role = 'all' OR u.role::text = p_role)
      AND (NOT v_has_q
        OR lower(unaccent(u.name)) LIKE v_q
        OR lower(u.email) LIKE v_q
        OR lower(COALESCE(u.id_card, '')) LIKE v_q
        OR regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') LIKE '%' || NULLIF(regexp_replace(p_search, '\D', '', 'g'), '') || '%')
  )
  SELECT
    (SELECT count(*) FROM f),
    COALESCE((SELECT jsonb_agg(row ORDER BY (row->>'created_at') DESC) FROM (
      SELECT jsonb_build_object(
        'id', f.id, 'name', f.name, 'email', f.email, 'phone', f.phone, 'id_card', f.id_card,
        'role', f.role, 'active', f.active, 'points_balance', f.points_balance, 'created_at', f.created_at) AS row
      FROM f ORDER BY f.created_at DESC LIMIT v_limit OFFSET v_offset
    ) s), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  tz constant text := 'America/Costa_Rica';
  v_today date := (now() AT TIME ZONE tz)::date;
  v_month date := date_trunc('month', now() AT TIME ZONE tz)::date;
  v_last_month date := (date_trunc('month', now() AT TIME ZONE tz) - interval '1 month')::date;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin', 'operador', 'consulta']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  RETURN jsonb_build_object(
    'orders_today', (SELECT count(*) FROM orders WHERE (created_at AT TIME ZONE tz)::date = v_today),
    'orders_this_month', (SELECT count(*) FROM orders WHERE date_trunc('month', created_at AT TIME ZONE tz)::date = v_month),
    'pending_receipts', (SELECT count(*) FROM payment_receipts WHERE status = 'pendiente'),
    'pending_payment', (SELECT count(*) FROM orders WHERE payment_status = 'pending' AND order_status <> 'cancelado'),
    'in_progress', (SELECT count(*) FROM orders WHERE order_status IN ('pagado', 'en_revision', 'en_proceso', 'pendiente_de_documentos')),
    'completed_this_month', (SELECT count(*) FROM orders
      WHERE order_status IN ('completado', 'entregado') AND completed_at IS NOT NULL
        AND date_trunc('month', completed_at AT TIME ZONE tz)::date = v_month),
    'revenue_this_month', (SELECT COALESCE(sum(total), 0) FROM orders
      WHERE payment_status = 'paid' AND paid_at IS NOT NULL AND date_trunc('month', paid_at AT TIME ZONE tz)::date = v_month),
    'revenue_last_month', (SELECT COALESCE(sum(total), 0) FROM orders
      WHERE payment_status = 'paid' AND paid_at IS NOT NULL AND date_trunc('month', paid_at AT TIME ZONE tz)::date = v_last_month),
    'active_users', (SELECT count(*) FROM users_profile WHERE active = true AND role = 'cliente'),
    'new_users_this_month', (SELECT count(*) FROM users_profile
      WHERE role = 'cliente' AND date_trunc('month', created_at AT TIME ZONE tz)::date = v_month)
  );
END;
$function$;

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
