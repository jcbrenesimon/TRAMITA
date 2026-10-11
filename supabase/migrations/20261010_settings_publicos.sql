-- ============================================================
-- Tramitá — Datos del negocio en settings
-- Fecha: 2026-10-10
--
-- Clave única para "combinar cupón + puntos", datos de contacto y
-- estadísticas del inicio, y lectura pública de las claves no sensibles.
-- Idempotente.
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
