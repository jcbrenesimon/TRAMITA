-- ============================================================
-- Tramitá — Datos del negocio 100% desde la base de datos
-- Fecha: 2026-10-10
--
-- 1. Unifica la clave de "combinar cupón + puntos" (hallazgo H4 del manual):
--    el admin guardaba allow_combine_coupon_points y la app pública leía
--    allow_combine_coupon_and_points. Queda solo allow_combine_coupon_and_points.
-- 2. Carga en settings los datos que antes estaban escritos en el código
--    (solo si no existen; no sobrescribe lo que ya esté configurado).
-- 3. Permite que visitantes sin sesión lean ÚNICAMENTE las claves públicas.
--    Cédula jurídica, bonos de referido y cualquier otra clave siguen
--    siendo solo para el equipo.
--
-- Idempotente: se puede ejecutar varias veces.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

BEGIN;

-- 1. Unificar clave de combinar cupón + puntos
INSERT INTO public.settings (key, value, description)
SELECT 'allow_combine_coupon_and_points', value, 'Permitir usar cupón y puntos en la misma compra'
FROM public.settings
WHERE key = 'allow_combine_coupon_points'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

DELETE FROM public.settings WHERE key = 'allow_combine_coupon_points';

-- 2. Datos que estaban fijos en el código de la app pública
INSERT INTO public.settings (key, value, description) VALUES
  ('business_name',    '"Tramitá"'::jsonb,                            'Nombre comercial'),
  ('business_phone',   '"50672195787"'::jsonb,                        'WhatsApp del negocio (formato 506XXXXXXXX)'),
  ('business_email',   '"contacto@tramita.app"'::jsonb,               'Correo de contacto'),
  ('business_address', '"San José, Costa Rica"'::jsonb,               'Dirección mostrada en el footer'),
  ('business_hours',   '"Lun – Vie, 8:00 a.m. – 5:00 p.m."'::jsonb,   'Horario de atención'),
  ('point_value_crc',  '10'::jsonb,                                   'Colones por punto al canjear'),
  ('allow_combine_coupon_and_points', 'false'::jsonb,                 'Permitir usar cupón y puntos en la misma compra'),
  ('hero_stats', '[
      {"value": "+2.400", "label": "Trámites gestionados"},
      {"value": "48h",    "label": "Respuesta promedio"},
      {"value": "4,9", "suffix": "/5", "label": "Satisfacción"}
   ]'::jsonb,                                                          'Estadísticas del inicio de la app pública')
ON CONFLICT (key) DO NOTHING;

-- 3. Lectura pública solo de claves no sensibles
DROP POLICY IF EXISTS settings_public_read ON public.settings;
CREATE POLICY settings_public_read ON public.settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN (
    'business_name',
    'business_email',
    'business_phone',
    'business_address',
    'business_hours',
    'hero_stats',
    'point_value_crc',
    'allow_combine_coupon_and_points'
  ));

COMMIT;
