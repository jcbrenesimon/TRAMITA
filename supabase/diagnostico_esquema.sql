-- ============================================================
-- Tramitá — Diagnóstico del esquema (SOLO LECTURA, no modifica nada)
-- Devuelve una sola celda con un JSON que describe tablas, columnas,
-- enums, políticas RLS y de Storage, funciones, triggers, restricciones,
-- buckets y conteos. Se usa para escribir migraciones exactas.
-- Ejecutar en Supabase → SQL Editor. Luego Export → Download CSV.
-- ============================================================
SELECT jsonb_pretty(jsonb_build_object(
  'columns', (
    SELECT jsonb_agg(jsonb_build_object(
      't', table_name, 'c', column_name, 'type', data_type, 'udt', udt_name,
      'null', is_nullable, 'def', column_default) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'public'),
  'enums', (
    SELECT jsonb_agg(jsonb_build_object('enum', t.typname, 'vals',
      (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)))
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'),
  'rls', (
    SELECT jsonb_agg(jsonb_build_object('t', relname, 'rls', relrowsecurity))
    FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'),
  'policies', (
    SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 't', tablename, 'name', policyname,
      'cmd', cmd, 'roles', roles, 'using', qual, 'check', with_check))
    FROM pg_policies WHERE schemaname IN ('public', 'storage')),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object('name', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
      'def', pg_get_functiondef(p.oid)) ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')),
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object('table', event_object_schema || '.' || event_object_table,
      'name', trigger_name, 'timing', action_timing, 'event', event_manipulation, 'action', action_statement))
    FROM information_schema.triggers WHERE event_object_schema IN ('public', 'auth')),
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object('t', conrelid::regclass::text, 'name', conname, 'def', pg_get_constraintdef(oid)))
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace),
  'indexes', (
    SELECT jsonb_agg(jsonb_build_object('t', tablename, 'def', indexdef))
    FROM pg_indexes WHERE schemaname = 'public'),
  'buckets', (
    SELECT jsonb_agg(jsonb_build_object('id', id, 'public', public, 'size', file_size_limit, 'mime', allowed_mime_types))
    FROM storage.buckets),
  'extensions', (SELECT jsonb_agg(jsonb_build_object('name', extname, 'schema', extnamespace::regnamespace::text)) FROM pg_extension),
  'setting_keys', (SELECT jsonb_agg(key ORDER BY key) FROM public.settings),
  'row_counts', jsonb_build_object(
    'users_profile', (SELECT count(*) FROM public.users_profile),
    'orders', (SELECT count(*) FROM public.orders),
    'order_items', (SELECT count(*) FROM public.order_items),
    'payment_receipts', (SELECT count(*) FROM public.payment_receipts),
    'points_ledger', (SELECT count(*) FROM public.points_ledger),
    'coupons', (SELECT count(*) FROM public.coupons),
    'coupon_redemptions', (SELECT count(*) FROM public.coupon_redemptions)),
  'auth_users', (
    SELECT jsonb_agg(jsonb_build_object('email', u.email, 'confirmed', u.email_confirmed_at IS NOT NULL,
      'identities', (SELECT count(*) FROM auth.identities i WHERE i.user_id = u.id),
      'role', (SELECT p.role FROM public.users_profile p WHERE p.user_id = u.id)))
    FROM auth.users u)
)) AS esquema;
