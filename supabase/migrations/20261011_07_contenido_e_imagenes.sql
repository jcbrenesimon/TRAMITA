-- ============================================================
-- Tramitá — 07: Contenido editable, imágenes de servicios y limpieza
-- Fecha: 2026-10-11
--
-- #18 Política de privacidad y términos en la base de datos (editables en
--     el panel → Configuración). El texto inicial es un BORRADOR que debe
--     revisar un abogado antes del lanzamiento.
-- #31 "Modalidad", "Cobertura" y el tiempo de verificación del comprobante
--     pasan a settings.
-- #32 Imágenes de servicios: columna services.image_url y bucket público
--     service-images (solo el admin sube archivos).
-- Limpieza: claves payment_* de la Entrega 1 que ya nadie usa
--     (reemplazadas por la tabla payment_accounts).
-- Idempotente.
-- ============================================================
BEGIN;

-- ---------- Textos y promesas del negocio ----------
INSERT INTO public.settings (key, value, description) VALUES
  ('service_modality', '"100% en línea"'::jsonb, 'Modalidad mostrada en el detalle de cada servicio'),
  ('service_coverage', '"Nacional"'::jsonb, 'Cobertura mostrada en el detalle de cada servicio'),
  ('receipt_verification_time', '"menos de 2 horas hábiles"'::jsonb, 'Tiempo prometido para verificar un comprobante'),
  ('privacy_policy', to_jsonb($txt$Última actualización: 11 de octubre de 2026

1. Responsable
Tramitá es responsable del tratamiento de los datos personales recopilados en este sitio, conforme a la Ley N.° 8968 de Protección de la Persona frente al Tratamiento de sus Datos Personales de Costa Rica y su reglamento.

2. Datos que recopilamos
Nombre, número de cédula, teléfono, correo electrónico, dirección, empresa (opcional), comprobantes de pago y la información necesaria para gestionar cada trámite contratado.

3. Para qué los usamos
Únicamente para crear y administrar su cuenta, gestionar los trámites que contrata, verificar sus pagos, comunicarnos con usted sobre el estado de sus órdenes y cumplir obligaciones legales y tributarias. No vendemos ni cedemos sus datos a terceros con fines comerciales.

4. Con quién los compartimos
Solo con las instituciones públicas o privadas ante las que se realiza el trámite que usted contrató y con los proveedores tecnológicos que alojan la plataforma, bajo obligaciones de confidencialidad.

5. Conservación
Conservamos sus datos mientras mantenga una cuenta activa y durante los plazos que exige la legislación costarricense para respaldos contables y tributarios.

6. Sus derechos
Puede solicitar en cualquier momento el acceso, la rectificación o la eliminación de sus datos, así como revocar su consentimiento, escribiendo al correo de contacto publicado en este sitio. Responderemos en un plazo máximo de cinco días hábiles.

7. Seguridad
Aplicamos medidas técnicas y organizativas razonables para proteger su información: conexiones cifradas, acceso restringido al personal autorizado y almacenamiento privado de los comprobantes.$txt$::text), 'Política de privacidad (BORRADOR: revisar con un abogado)'),
  ('terms_of_service', to_jsonb($txt$Última actualización: 11 de octubre de 2026

1. Servicio
Tramitá ofrece servicios de gestión de trámites ante instituciones públicas y privadas de Costa Rica. Tramitá actúa como gestor en nombre del cliente y no garantiza el resultado de las resoluciones que emitan dichas instituciones.

2. Cuenta
El cliente es responsable de la veracidad de los datos que registra y de mantener la confidencialidad de su contraseña.

3. Precios y pagos
Los precios publicados incluyen la gestión de Tramitá. Los trámites inician una vez verificado el pago. Los tiempos estimados son referenciales y pueden variar según la institución correspondiente.

4. Documentos
El cliente debe aportar los documentos requeridos para cada servicio. La falta de documentación puede retrasar o impedir la gestión.

5. Cancelaciones y reembolsos
El cliente puede solicitar la cancelación antes de que inicie la gestión del trámite. Si el pago ya fue verificado, Tramitá evaluará el reembolso según los costos en que haya incurrido.

6. Puntos y cupones
Los puntos y cupones no tienen valor en efectivo, no son transferibles y pueden estar sujetos a condiciones y vencimientos. Al cancelarse una orden, los puntos y cupones utilizados se devuelven y los puntos ganados se revierten.

7. Contacto
Para consultas o reclamos, utilice los medios de contacto publicados en este sitio.$txt$::text), 'Términos y condiciones (BORRADOR: revisar con un abogado)')
ON CONFLICT (key) DO NOTHING;

-- ---------- Claves legadas de la Entrega 1 ----------
DELETE FROM public.settings WHERE key IN (
  'payment_account_holder', 'payment_account_id', 'payment_bank', 'payment_iban',
  'payment_link_url', 'payment_sinpe_name', 'payment_sinpe_number');

-- ---------- Lectura pública solo de claves no sensibles ----------
DROP POLICY IF EXISTS settings_public_read ON public.settings;
CREATE POLICY settings_public_read ON public.settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN (
    'business_name', 'business_email', 'business_phone', 'business_address', 'business_hours',
    'hero_stats', 'point_value_crc', 'allow_combine_coupon_and_points',
    'service_modality', 'service_coverage', 'receipt_verification_time',
    'privacy_policy', 'terms_of_service'
  ));

-- ---------- #32: imágenes de servicios ----------
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-images', 'service-images', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS service_images_admin_insert ON storage.objects;
DROP POLICY IF EXISTS service_images_admin_update ON storage.objects;
DROP POLICY IF EXISTS service_images_admin_delete ON storage.objects;
CREATE POLICY service_images_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-images' AND public.current_user_role() = 'admin');
CREATE POLICY service_images_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-images' AND public.current_user_role() = 'admin');
CREATE POLICY service_images_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-images' AND public.current_user_role() = 'admin');

DROP FUNCTION IF EXISTS public.admin_save_service(integer, text, integer, integer, text, text, text, jsonb, text, numeric, boolean, boolean);
CREATE OR REPLACE FUNCTION public.admin_save_service(
  p_id integer, p_name text, p_category_id integer, p_price integer,
  p_short_description text, p_long_description text, p_estimated_time text,
  p_required_documents jsonb, p_icon text, p_points_percentage numeric,
  p_active boolean, p_featured boolean, p_image_url text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_slug text;
  v_result_id integer;
  v_image text := NULLIF(trim(COALESCE(p_image_url, '')), '');
BEGIN
  v_admin := public.staff_profile(ARRAY['admin']::user_role[]);
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden gestionar servicios.');
  END IF;
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El nombre es requerido.');
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El precio debe ser positivo.');
  END IF;
  IF p_points_percentage IS NULL OR p_points_percentage < 0 OR p_points_percentage > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El % de puntos debe estar entre 0 y 100.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_category_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Seleccione una categoría válida.');
  END IF;
  IF v_image IS NOT NULL AND v_image !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La imagen debe ser una dirección https.');
  END IF;
  IF jsonb_typeof(COALESCE(p_required_documents, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Documentos requeridos inválidos.');
  END IF;

  v_slug := trim(both '-' FROM lower(regexp_replace(unaccent(p_name), '[^a-z0-9]+', '-', 'gi')));

  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM services WHERE slug = v_slug) THEN
      v_slug := v_slug || '-' || floor(random() * 1000)::text;
    END IF;
    INSERT INTO services (
      name, slug, category_id, price, short_description, long_description,
      estimated_time, required_documents, icon, points_percentage, active, featured, image_url
    ) VALUES (
      left(p_name, 150), v_slug, p_category_id, p_price, left(COALESCE(p_short_description, ''), 300),
      left(COALESCE(p_long_description, ''), 5000), left(COALESCE(p_estimated_time, ''), 100),
      COALESCE(p_required_documents, '[]'::jsonb), left(COALESCE(NULLIF(p_icon, ''), 'doc'), 8),
      p_points_percentage, COALESCE(p_active, true), COALESCE(p_featured, false), v_image
    ) RETURNING id INTO v_result_id;
  ELSE
    UPDATE services SET
      name = left(p_name, 150),
      category_id = p_category_id,
      price = p_price,
      short_description = left(COALESCE(p_short_description, ''), 300),
      long_description = left(COALESCE(p_long_description, ''), 5000),
      estimated_time = left(COALESCE(p_estimated_time, ''), 100),
      required_documents = COALESCE(p_required_documents, '[]'::jsonb),
      icon = left(COALESCE(NULLIF(p_icon, ''), 'doc'), 8),
      points_percentage = p_points_percentage,
      active = COALESCE(p_active, active),
      featured = COALESCE(p_featured, featured),
      image_url = v_image
    WHERE id = p_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Servicio no encontrado.');
    END IF;
    v_result_id := p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
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
