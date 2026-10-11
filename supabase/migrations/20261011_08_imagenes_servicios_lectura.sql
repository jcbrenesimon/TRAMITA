-- ============================================================
-- Tramitá — 08: Lectura pública de las imágenes de servicios
-- Fecha: 2026-10-11
--
-- Las imágenes de servicios se muestran en el catálogo: cualquiera puede
-- leerlas; solo el admin puede subirlas, cambiarlas o borrarlas.
-- Idempotente.
-- ============================================================
BEGIN;

DROP POLICY IF EXISTS service_images_public_select ON storage.objects;
CREATE POLICY service_images_public_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'service-images');

COMMIT;
