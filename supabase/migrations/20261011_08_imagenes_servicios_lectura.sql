-- ============================================================
-- Tramitá — 08: Corrige la subida de imágenes de servicios
-- Fecha: 2026-10-11
--
-- Problema: la migración 07 creó el bucket "service-images" con permisos
-- de INSERT/UPDATE/DELETE para el admin, pero sin permiso de SELECT.
-- Storage inserta el archivo y lo lee de vuelta (INSERT ... RETURNING), y
-- Postgres exige que esa fila también pase una política de SELECT, así que
-- toda subida fallaba con "new row violates row-level security policy".
--
-- Las imágenes de servicios son públicas (se muestran en el catálogo), así
-- que cualquiera puede leerlas; solo el admin puede subir, cambiar o borrar.
-- Idempotente.
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS service_images_public_select ON storage.objects;
CREATE POLICY service_images_public_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'service-images');

COMMIT;
