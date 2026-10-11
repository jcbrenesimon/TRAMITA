-- ============================================================
-- Tramitá — 06: Registro de errores de la web y del panel (#22)
-- Fecha: 2026-10-11
--
-- Las dos apps envían sus errores de JavaScript a log_client_error().
-- El panel los muestra en Sistema → Errores. Sin servicios externos.
-- Límite: 20 errores por minuto por usuario/visitante para evitar abuso.
-- Idempotente.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.client_errors (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  app text NOT NULL CHECK (app IN ('web', 'admin')),
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  user_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON public.client_errors (created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ce_select_staff ON public.client_errors;
CREATE POLICY ce_select_staff ON public.client_errors FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'operador', 'consulta'));
-- Sin políticas de INSERT/UPDATE/DELETE: solo vía funciones.

CREATE OR REPLACE FUNCTION public.log_client_error(p_app text, p_message text, p_stack text DEFAULT NULL, p_url text DEFAULT NULL, p_user_agent text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid := current_user_profile_id();
BEGIN
  IF p_app NOT IN ('web', 'admin') OR COALESCE(trim(p_message), '') = '' THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM client_errors
      WHERE created_at > now() - interval '1 minute'
        AND user_id IS NOT DISTINCT FROM v_profile_id) >= 20 THEN
    RETURN;
  END IF;
  INSERT INTO client_errors (app, message, stack, url, user_agent, user_id)
  VALUES (p_app, left(p_message, 1000), left(p_stack, 4000), left(p_url, 500), left(p_user_agent, 300), v_profile_id);
  -- Conservar solo los últimos 90 días
  DELETE FROM client_errors WHERE created_at < now() - interval '90 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_clear_errors()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_n integer;
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  DELETE FROM client_errors;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', v_n);
END;
$function$;

REVOKE ALL ON public.client_errors FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.client_errors FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_client_error(text, text, text, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_clear_errors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_errors() TO authenticated;

COMMIT;
