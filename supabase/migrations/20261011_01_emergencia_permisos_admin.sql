-- ============================================================
-- Tramitá — PARCHE DE EMERGENCIA (ejecutar primero)
-- Fecha: 2026-10-11
--
-- Problema: las funciones admin_* validan permisos con
--   IF v_admin.role NOT IN ('admin','operador') THEN ...
-- Sin sesión, v_admin.role es NULL y la comparación da NULL (no TRUE),
-- así que la validación se salta. Cualquiera con la publishable key
-- podía crear administradores, darse puntos o aprobar comprobantes.
--
-- Este parche quita el permiso de ejecutar funciones admin_* a los
-- visitantes sin sesión (anon). La corrección de fondo de cada función
-- viene en la migración 02.
-- Idempotente.
-- ============================================================
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

-- Verificación: debe devolver 0 filas
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'admin\_%'
  AND has_function_privilege('anon', p.oid, 'EXECUTE');
