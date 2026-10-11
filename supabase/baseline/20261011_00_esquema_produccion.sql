-- ============================================================
-- Tramitá — Snapshot del esquema de producción ANTES de las migraciones 20261011_*
-- Generado desde supabase/diagnostico_esquema.sql (2026-10-11).
-- Es documentación/respaldo: NO ejecutar sobre la base de producción.
-- Para recrear la base desde cero en un proyecto nuevo: ejecutar este archivo y
-- luego todas las migraciones de supabase/migrations en orden.
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
SET search_path = public, extensions;

-- Tipos
CREATE TYPE public.user_role AS ENUM ('cliente', 'operador', 'admin', 'consulta');
CREATE TYPE public.order_status AS ENUM ('pendiente', 'pendiente_de_pago', 'pagado', 'pendiente_de_documentos', 'en_revision', 'en_proceso', 'completado', 'entregado', 'cancelado');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('sinpe', 'transferencia', 'deposito', 'link_bancario');
CREATE TYPE public.receipt_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE public.document_status AS ENUM ('recibido', 'pendiente', 'invalido', 'aprobado');
CREATE TYPE public.note_kind AS ENUM ('internal', 'whatsapp', 'system', 'email', 'call');
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed');
CREATE TYPE public.points_movement AS ENUM ('earned', 'redeemed', 'expired', 'adjusted');

-- Secuencias
CREATE SEQUENCE public.categories_id_seq;
CREATE SEQUENCE public.coupon_redemptions_id_seq;
CREATE SEQUENCE public.coupons_id_seq;
CREATE SEQUENCE public.order_items_id_seq;
CREATE SEQUENCE public.order_notes_id_seq;
CREATE SEQUENCE public.payment_accounts_id_seq;
CREATE SEQUENCE public.points_ledger_id_seq;
CREATE SEQUENCE public.referrals_id_seq;
CREATE SEQUENCE public.services_id_seq;

-- Tablas
CREATE TABLE public.categories (
  id integer DEFAULT nextval('categories_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.coupon_redemptions (
  id integer DEFAULT nextval('coupon_redemptions_id_seq'::regclass) NOT NULL,
  coupon_id integer NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  discount_amount integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.coupons (
  id integer DEFAULT nextval('coupons_id_seq'::regclass) NOT NULL,
  code text NOT NULL,
  description text DEFAULT ''::text,
  coupon_type coupon_type NOT NULL,
  value integer NOT NULL,
  min_purchase integer DEFAULT 0,
  max_discount integer,
  valid_from timestamptz DEFAULT now() NOT NULL,
  valid_until timestamptz,
  usage_limit integer,
  usage_count integer DEFAULT 0 NOT NULL,
  per_user_limit integer DEFAULT 1,
  applicable_services jsonb DEFAULT '[]'::jsonb,
  applicable_categories jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  used_count integer DEFAULT 0
);
CREATE TABLE public.documents (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_id uuid,
  user_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  display_name text NOT NULL,
  document_type text DEFAULT 'Otro'::text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  status document_status DEFAULT 'recibido'::document_status NOT NULL,
  notes text DEFAULT ''::text,
  is_internal boolean DEFAULT false NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.order_items (
  id integer DEFAULT nextval('order_items_id_seq'::regclass) NOT NULL,
  order_id uuid NOT NULL,
  service_id integer NOT NULL,
  service_name text NOT NULL,
  service_price integer NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  subtotal integer NOT NULL,
  points_earned integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.order_notes (
  id integer DEFAULT nextval('order_notes_id_seq'::regclass) NOT NULL,
  order_id uuid NOT NULL,
  author_id uuid,
  author_name text DEFAULT 'Sistema'::text NOT NULL,
  kind note_kind DEFAULT 'internal'::note_kind NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.orders (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  reference text NOT NULL,
  user_id uuid NOT NULL,
  order_status order_status DEFAULT 'pendiente'::order_status NOT NULL,
  payment_status payment_status DEFAULT 'pending'::payment_status NOT NULL,
  payment_method payment_method,
  subtotal integer DEFAULT 0 NOT NULL,
  discount_amount integer DEFAULT 0 NOT NULL,
  points_used integer DEFAULT 0 NOT NULL,
  points_discount integer DEFAULT 0 NOT NULL,
  points_earned integer DEFAULT 0 NOT NULL,
  total integer DEFAULT 0 NOT NULL,
  coupon_id integer,
  coupon_code text,
  assigned_to uuid,
  last_contact_at timestamptz,
  shipping_address text DEFAULT ''::text,
  customer_notes text DEFAULT ''::text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  paid_at timestamptz,
  completed_at timestamptz,
  payment_account_id integer
);
CREATE TABLE public.payment_accounts (
  id integer DEFAULT nextval('payment_accounts_id_seq'::regclass) NOT NULL,
  display_name text NOT NULL,
  payment_method payment_method NOT NULL,
  bank text DEFAULT ''::text,
  currency text DEFAULT 'CRC'::text NOT NULL,
  iban text DEFAULT ''::text,
  account_number text DEFAULT ''::text,
  account_holder text DEFAULT ''::text,
  holder_id text DEFAULT ''::text,
  sinpe_number text DEFAULT ''::text,
  payment_link_url text DEFAULT ''::text,
  instructions text DEFAULT ''::text,
  display_order integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.payment_receipts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  order_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  payment_method payment_method NOT NULL,
  reference_number text,
  amount integer NOT NULL,
  payment_date date,
  status receipt_status DEFAULT 'pendiente'::receipt_status NOT NULL,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  notes text DEFAULT ''::text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  payment_account_id integer
);
CREATE TABLE public.points_ledger (
  id integer DEFAULT nextval('points_ledger_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  order_id uuid,
  movement points_movement NOT NULL,
  points integer NOT NULL,
  balance_after integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);
CREATE TABLE public.referrals (
  id integer DEFAULT nextval('referrals_id_seq'::regclass) NOT NULL,
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  first_order_id uuid,
  bonus_points_awarded integer DEFAULT 0 NOT NULL,
  bonus_awarded_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.services (
  id integer DEFAULT nextval('services_id_seq'::regclass) NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  category_id integer NOT NULL,
  price integer NOT NULL,
  short_description text DEFAULT ''::text NOT NULL,
  long_description text DEFAULT ''::text NOT NULL,
  estimated_time text DEFAULT ''::text NOT NULL,
  required_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
  icon text DEFAULT 'doc'::text,
  points_percentage numeric DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  featured boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  display_order integer DEFAULT 0
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text DEFAULT ''::text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.users_profile (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  name text DEFAULT ''::text NOT NULL,
  email text DEFAULT ''::text NOT NULL,
  id_card text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  company text DEFAULT ''::text,
  address text DEFAULT ''::text,
  billing_email text DEFAULT ''::text,
  role user_role DEFAULT 'cliente'::user_role NOT NULL,
  active boolean DEFAULT true NOT NULL,
  referral_code text,
  referred_by uuid,
  points_balance integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;
ALTER SEQUENCE public.coupon_redemptions_id_seq OWNED BY public.coupon_redemptions.id;
ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;
ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;
ALTER SEQUENCE public.order_notes_id_seq OWNED BY public.order_notes.id;
ALTER SEQUENCE public.payment_accounts_id_seq OWNED BY public.payment_accounts.id;
ALTER SEQUENCE public.points_ledger_id_seq OWNED BY public.points_ledger.id;
ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;
ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;

-- Restricciones
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_pkey PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_pkey PRIMARY KEY (id);
ALTER TABLE public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);
ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE public.order_notes ADD CONSTRAINT order_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_pkey PRIMARY KEY (id);
ALTER TABLE public.referrals ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key);
ALTER TABLE public.payment_accounts ADD CONSTRAINT payment_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_user_id_key UNIQUE (user_id);
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_referral_code_key UNIQUE (referral_code);
ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
ALTER TABLE public.services ADD CONSTRAINT services_slug_key UNIQUE (slug);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);
ALTER TABLE public.orders ADD CONSTRAINT orders_reference_key UNIQUE (reference);
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users_profile ADD CONSTRAINT users_profile_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.services ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.orders ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD CONSTRAINT documents_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.documents ADD CONSTRAINT documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.order_notes ADD CONSTRAINT order_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_notes ADD CONSTRAINT order_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE RESTRICT;
ALTER TABLE public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users_profile(id) ON DELETE RESTRICT;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users_profile(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users_profile(id) ON DELETE CASCADE;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_first_order_id_fkey FOREIGN KEY (first_order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public.settings ADD CONSTRAINT settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users_profile(id) ON DELETE SET NULL;
ALTER TABLE public.payment_receipts ADD CONSTRAINT payment_receipts_payment_account_id_fkey FOREIGN KEY (payment_account_id) REFERENCES payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_account_id_fkey FOREIGN KEY (payment_account_id) REFERENCES payment_accounts(id) ON DELETE SET NULL;

-- Índices (los de PK/UNIQUE los crean las restricciones)
CREATE INDEX idx_users_profile_referral_code ON public.users_profile USING btree (referral_code);
CREATE INDEX idx_users_profile_user_id ON public.users_profile USING btree (user_id);
CREATE INDEX idx_users_profile_role ON public.users_profile USING btree (role);
CREATE INDEX idx_users_profile_email ON public.users_profile USING btree (email);
CREATE INDEX idx_users_profile_id_card ON public.users_profile USING btree (id_card);
CREATE INDEX idx_users_profile_phone ON public.users_profile USING btree (phone);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_service ON public.order_items USING btree (service_id);
CREATE INDEX idx_receipts_order ON public.payment_receipts USING btree (order_id);
CREATE INDEX idx_receipts_status ON public.payment_receipts USING btree (status);
CREATE INDEX idx_receipts_uploaded_by ON public.payment_receipts USING btree (uploaded_by);
CREATE INDEX idx_orders_reference ON public.orders USING btree (reference);
CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);
CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);
CREATE INDEX idx_orders_assigned ON public.orders USING btree (assigned_to);
CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);
CREATE INDEX idx_documents_order ON public.documents USING btree (order_id);
CREATE INDEX idx_documents_user ON public.documents USING btree (user_id);
CREATE INDEX idx_documents_status ON public.documents USING btree (status);
CREATE INDEX idx_documents_internal ON public.documents USING btree (is_internal);
CREATE INDEX idx_notes_order ON public.order_notes USING btree (order_id);
CREATE INDEX idx_notes_kind ON public.order_notes USING btree (kind);
CREATE INDEX idx_notes_created ON public.order_notes USING btree (created_at DESC);
CREATE INDEX idx_redemptions_coupon ON public.coupon_redemptions USING btree (coupon_id);
CREATE INDEX idx_redemptions_user ON public.coupon_redemptions USING btree (user_id);
CREATE INDEX idx_points_user ON public.points_ledger USING btree (user_id);
CREATE INDEX idx_points_order ON public.points_ledger USING btree (order_id);
CREATE INDEX idx_points_movement ON public.points_ledger USING btree (movement);
CREATE INDEX idx_points_created ON public.points_ledger USING btree (created_at DESC);
CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);
CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);
CREATE INDEX idx_categories_active ON public.categories USING btree (active);
CREATE INDEX idx_categories_order ON public.categories USING btree (display_order);
CREATE INDEX idx_payment_accounts_method ON public.payment_accounts USING btree (payment_method);
CREATE INDEX idx_payment_accounts_active ON public.payment_accounts USING btree (active);
CREATE INDEX idx_payment_accounts_order ON public.payment_accounts USING btree (display_order);
CREATE INDEX idx_services_slug ON public.services USING btree (slug);
CREATE INDEX idx_services_category ON public.services USING btree (category_id);
CREATE INDEX idx_services_active ON public.services USING btree (active);
CREATE INDEX idx_services_featured ON public.services USING btree (featured);
CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);
CREATE INDEX idx_coupons_active ON public.coupons USING btree (active);
CREATE INDEX idx_coupons_valid ON public.coupons USING btree (valid_from, valid_until);

-- Funciones
CREATE OR REPLACE FUNCTION public.admin_add_order_note(order_id uuid, note_content text, note_kind_param note_kind DEFAULT 'internal'::note_kind)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role NOT IN ('admin', 'operador') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF note_content IS NULL OR TRIM(note_content) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La nota no puede estar vacía.');
  END IF;
  
  INSERT INTO order_notes (
    order_id, author_id, author_name, kind, content
  ) VALUES (
    order_id, v_admin.id, v_admin.name, note_kind_param, note_content
  );
  
  -- Si la nota es por WhatsApp, actualizar last_contact_at
  IF note_kind_param = 'whatsapp' THEN
    UPDATE orders SET last_contact_at = NOW() WHERE id = order_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_points(profile_id uuid, points_delta integer, description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user users_profile%ROWTYPE;
  v_admin users_profile%ROWTYPE;
  v_new_balance INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo admin puede ajustar puntos.');
  END IF;
  
  SELECT * INTO v_user FROM users_profile WHERE id = profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  v_new_balance := COALESCE(v_user.points_balance, 0) + points_delta;
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El balance no puede quedar negativo.');
  END IF;
  
  INSERT INTO points_ledger (
    user_id, movement, points, balance_after, description, created_by
  ) VALUES (
    profile_id, 'adjusted', points_delta, v_new_balance,
    COALESCE(description, 'Ajuste manual'), v_admin.id
  );
  
  RETURN jsonb_build_object('ok', true, 'new_balance', v_new_balance);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_approve_receipt(p_receipt_id uuid, p_admin_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_receipt payment_receipts%ROWTYPE;
  v_order orders%ROWTYPE;
  v_user users_profile%ROWTYPE;
  v_admin users_profile%ROWTYPE;
  v_referrer_bonus INTEGER;
  v_welcome_bonus INTEGER;
  v_new_balance INTEGER;
  v_is_first_paid_order BOOLEAN;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role NOT IN ('admin', 'operador') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT * INTO v_receipt FROM payment_receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Comprobante no encontrado.');
  END IF;
  
  IF v_receipt.status = 'aprobado' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este comprobante ya fue aprobado.');
  END IF;
  
  SELECT * INTO v_order FROM orders WHERE id = v_receipt.order_id;
  SELECT * INTO v_user FROM users_profile WHERE id = v_order.user_id;
  
  SELECT NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE user_id = v_user.id 
    AND payment_status = 'paid' 
    AND id != v_order.id
  ) INTO v_is_first_paid_order;
  
  UPDATE payment_receipts AS r SET
    status = 'aprobado',
    verified_by = v_admin.id,
    verified_at = NOW(),
    notes = COALESCE(NULLIF(p_admin_notes, ''), r.notes)
  WHERE r.id = p_receipt_id;
  
  IF v_order.payment_status != 'paid' THEN
    UPDATE orders SET
      payment_status = 'paid',
      order_status = CASE 
        WHEN order_status IN ('pendiente', 'pendiente_de_pago') THEN 'pagado'::order_status 
        ELSE order_status 
      END,
      paid_at = NOW()
    WHERE id = v_order.id;
    
    IF v_order.points_earned > 0 THEN
      v_new_balance := COALESCE(v_user.points_balance, 0) + v_order.points_earned;
      INSERT INTO points_ledger (
        user_id, order_id, movement, points, balance_after, description, created_by
      ) VALUES (
        v_user.id, v_order.id, 'earned', v_order.points_earned, v_new_balance,
        'Puntos por orden ' || v_order.reference, v_admin.id
      );
    END IF;
    
    IF v_order.points_used > 0 THEN
      SELECT points_balance INTO v_new_balance FROM users_profile WHERE id = v_user.id;
      v_new_balance := v_new_balance - v_order.points_used;
      INSERT INTO points_ledger (
        user_id, order_id, movement, points, balance_after, description, created_by
      ) VALUES (
        v_user.id, v_order.id, 'redeemed', -v_order.points_used, v_new_balance,
        'Canje de puntos en orden ' || v_order.reference, v_admin.id
      );
    END IF;
    
    IF v_is_first_paid_order AND v_user.referred_by IS NOT NULL THEN
      SELECT 
        (SELECT value::integer FROM settings WHERE key = 'referral_bonus_points'),
        (SELECT value::integer FROM settings WHERE key = 'referred_welcome_points')
      INTO v_referrer_bonus, v_welcome_bonus;
      
      v_referrer_bonus := COALESCE(v_referrer_bonus, 500);
      v_welcome_bonus := COALESCE(v_welcome_bonus, 200);
      
      IF v_referrer_bonus > 0 THEN
        SELECT points_balance INTO v_new_balance FROM users_profile WHERE id = v_user.referred_by;
        v_new_balance := COALESCE(v_new_balance, 0) + v_referrer_bonus;
        INSERT INTO points_ledger (
          user_id, order_id, movement, points, balance_after, description, created_by
        ) VALUES (
          v_user.referred_by, v_order.id, 'earned', v_referrer_bonus, v_new_balance,
          'Bonus por referir a ' || v_user.name, v_admin.id
        );
      END IF;
      
      IF v_welcome_bonus > 0 THEN
        SELECT points_balance INTO v_new_balance FROM users_profile WHERE id = v_user.id;
        v_new_balance := COALESCE(v_new_balance, 0) + v_welcome_bonus;
        INSERT INTO points_ledger (
          user_id, order_id, movement, points, balance_after, description, created_by
        ) VALUES (
          v_user.id, v_order.id, 'earned', v_welcome_bonus, v_new_balance,
          'Bonus de bienvenida por referido', v_admin.id
        );
      END IF;
      
      INSERT INTO referrals (
        referrer_id, referred_id, first_order_id, bonus_points_awarded, bonus_awarded_at
      ) VALUES (
        v_user.referred_by, v_user.id, v_order.id, v_referrer_bonus, NOW()
      ) ON CONFLICT (referred_id) DO UPDATE SET
        first_order_id = EXCLUDED.first_order_id,
        bonus_points_awarded = EXCLUDED.bonus_points_awarded,
        bonus_awarded_at = NOW();
    END IF;
  END IF;
  
  INSERT INTO order_notes (
    order_id, author_id, author_name, kind, content
  ) VALUES (
    v_order.id, v_admin.id, v_admin.name, 'system',
    'Comprobante aprobado por ' || v_admin.name || 
    CASE WHEN p_admin_notes != '' THEN '. Nota: ' || p_admin_notes ELSE '' END
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'order_reference', v_order.reference,
    'user_name', v_user.name,
    'user_phone', v_user.phone,
    'points_earned', v_order.points_earned,
    'total', v_order.total
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_name text, p_phone text DEFAULT ''::text, p_id_card text DEFAULT ''::text, p_role text DEFAULT 'operador'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_new_user_id UUID;
  v_referral_code TEXT;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden crear usuarios.');
  END IF;
  
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Correo requerido.');
  END IF;
  IF LENGTH(p_password) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
  END IF;
  IF p_role NOT IN ('cliente', 'operador', 'admin', 'consulta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rol inválido.');
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(p_email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un usuario con ese correo.');
  END IF;
  
  v_new_user_id := gen_random_uuid();
  
  -- Usar extensions.crypt y extensions.gen_salt explícitamente
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    LOWER(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name)
  );
  
  SELECT referral_code INTO v_referral_code 
  FROM users_profile 
  WHERE user_id = v_new_user_id;
  
  IF v_referral_code IS NULL THEN
    v_referral_code := generate_referral_code();
    INSERT INTO users_profile (user_id, email, name, phone, id_card, role, referral_code)
    VALUES (v_new_user_id, LOWER(p_email), p_name, p_phone, p_id_card, p_role::user_role, v_referral_code);
  ELSE
    UPDATE users_profile SET
      name = p_name,
      phone = p_phone,
      id_card = p_id_card,
      role = p_role::user_role
    WHERE user_id = v_new_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_new_user_id,
    'email', LOWER(p_email),
    'name', p_name,
    'role', p_role
  );
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
  v_result JSONB;
BEGIN
  -- Validar que el llamador es staff
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF NOT FOUND OR v_admin.role NOT IN ('admin', 'operador', 'consulta') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;
  
  -- Ahora las consultas corren con permisos de postgres (bypass RLS)
  SELECT jsonb_build_object(
    'orders_today', (
      SELECT COUNT(*) FROM orders 
      WHERE created_at::date = CURRENT_DATE
    ),
    'orders_this_month', (
      SELECT COUNT(*) FROM orders 
      WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    ),
    'pending_receipts', (
      SELECT COUNT(*) FROM payment_receipts 
      WHERE status = 'pendiente'
    ),
    'pending_payment', (
      SELECT COUNT(*) FROM orders 
      WHERE payment_status = 'pending' AND order_status != 'cancelado'
    ),
    'in_progress', (
      SELECT COUNT(*) FROM orders 
      WHERE order_status IN ('pagado', 'en_revision', 'en_proceso', 'pendiente_de_documentos')
    ),
    'completed_this_month', (
      SELECT COUNT(*) FROM orders 
      WHERE order_status IN ('completado','entregado') 
      AND completed_at IS NOT NULL
      AND date_trunc('month', completed_at) = date_trunc('month', CURRENT_DATE)
    ),
    'revenue_this_month', (
      SELECT COALESCE(SUM(total), 0) FROM orders 
      WHERE payment_status = 'paid' 
      AND paid_at IS NOT NULL
      AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)
    ),
    'revenue_last_month', (
      SELECT COALESCE(SUM(total), 0) FROM orders 
      WHERE payment_status = 'paid' 
      AND paid_at IS NOT NULL
      AND date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
    ),
    'active_users', (
      SELECT COUNT(*) FROM users_profile 
      WHERE active = true AND role = 'cliente'
    ),
    'new_users_this_month', (
      SELECT COUNT(*) FROM users_profile 
      WHERE role = 'cliente' 
      AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_category(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_svc_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_svc_count FROM services WHERE category_id = p_id;
  IF v_svc_count > 0 THEN
    UPDATE categories SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Categoría desactivada (tiene ' || v_svc_count || ' servicios asociados).'
    );
  END IF;
  
  DELETE FROM categories WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Categoría eliminada.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_coupon(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_used_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_used_count FROM coupon_redemptions WHERE coupon_id = p_id;
  IF v_used_count > 0 THEN
    UPDATE coupons SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Cupón desactivado (ya fue usado ' || v_used_count || ' veces).'
    );
  END IF;
  
  DELETE FROM coupons WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Cupón eliminado.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_payment_account(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_used_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT COUNT(*) INTO v_used_count FROM orders WHERE payment_account_id = p_id;
  IF v_used_count > 0 THEN
    UPDATE payment_accounts SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Cuenta desactivada (usada en ' || v_used_count || ' órdenes).'
    );
  END IF;
  
  DELETE FROM payment_accounts WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Cuenta eliminada.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_service(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_order_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  -- Verificar si hay órdenes con este servicio
  SELECT COUNT(*) INTO v_order_count FROM order_items WHERE service_id = p_id;
  IF v_order_count > 0 THEN
    -- Solo desactivar en lugar de borrar
    UPDATE services SET active = false WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'soft_delete', true,
      'message', 'Servicio desactivado (tiene ' || v_order_count || ' órdenes asociadas, no se puede eliminar definitivamente).'
    );
  END IF;
  
  -- Sin órdenes: borrado completo
  DELETE FROM services WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'message', 'Servicio eliminado.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_profile_id uuid, p_hard_delete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
  v_order_count INTEGER;
  v_paid_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden eliminar usuarios.');
  END IF;
  
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  -- Proteger: no auto-eliminarse
  IF v_target.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puede eliminarse a sí mismo.');
  END IF;
  
  -- Contar órdenes del usuario
  SELECT COUNT(*) INTO v_order_count FROM orders WHERE user_id = p_profile_id;
  SELECT COUNT(*) INTO v_paid_count FROM orders WHERE user_id = p_profile_id AND payment_status = 'paid';
  
  -- Si tiene órdenes pagadas, solo permitir borrado suave
  IF v_paid_count > 0 AND p_hard_delete = true THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'error', 'No se puede eliminar definitivamente: el usuario tiene ' || v_paid_count || ' orden(es) pagada(s). Use desactivar en su lugar para preservar el histórico.'
    );
  END IF;
  
  IF p_hard_delete = true THEN
    -- BORRADO DURO: eliminar todo (solo si no tiene órdenes pagadas)
    -- Primero borrar del auth (cascada borra el perfil)
    DELETE FROM auth.users WHERE id = v_target.user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'hard_delete', true,
      'message', 'Usuario eliminado definitivamente.'
    );
  ELSE
    -- BORRADO SUAVE: desactivar y anonimizar datos personales
    UPDATE users_profile SET
      active = false,
      name = 'Usuario eliminado',
      phone = '',
      id_card = '',
      company = '',
      address = '',
      billing_email = ''
    WHERE id = p_profile_id;
    
    -- Cambiar email en auth a uno anónimo único
    UPDATE auth.users SET
      email = 'eliminado_' || v_target.id || '@tramita.app',
      banned_until = 'infinity'::timestamptz
    WHERE id = v_target.user_id;
    
    RETURN jsonb_build_object(
      'ok', true,
      'hard_delete', false,
      'message', 'Usuario eliminado (borrado suave). Se preserva el histórico de órdenes.'
    );
  END IF;
END;
$function$;

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
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role NOT IN ('admin', 'operador') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Se requiere motivo del rechazo.');
  END IF;
  
  SELECT * INTO v_receipt FROM payment_receipts WHERE id = p_receipt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Comprobante no encontrado.');
  END IF;
  
  SELECT * INTO v_order FROM orders WHERE id = v_receipt.order_id;
  
  UPDATE payment_receipts AS r SET
    status = 'rechazado',
    verified_by = v_admin.id,
    verified_at = NOW(),
    rejection_reason = p_rejection_reason
  WHERE r.id = p_receipt_id;
  
  INSERT INTO order_notes (
    order_id, author_id, author_name, kind, content
  ) VALUES (
    v_order.id, v_admin.id, v_admin.name,
    'system',
    'Comprobante rechazado por ' || v_admin.name || '. Motivo: ' || p_rejection_reason
  );
  
  RETURN jsonb_build_object(
    'ok', true,
    'order_reference', v_order.reference
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_profile_id uuid, p_new_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden resetear contraseñas.');
  END IF;
  
  IF LENGTH(p_new_password) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
  END IF;
  
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  UPDATE auth.users 
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf'))
  WHERE id = v_target.user_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'email', v_target.email,
    'message', 'Contraseña actualizada'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_category(p_id integer, p_name text, p_display_order integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_slug TEXT;
  v_result_id INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nombre requerido.');
  END IF;
  
  v_slug := lower(regexp_replace(unaccent(p_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM categories WHERE slug = v_slug) THEN
      v_slug := v_slug || '-' || floor(random() * 1000)::text;
    END IF;
    INSERT INTO categories (name, slug, display_order, active)
    VALUES (p_name, v_slug, COALESCE(p_display_order, 0), COALESCE(p_active, true))
    RETURNING id INTO v_result_id;
  ELSE
    UPDATE categories SET
      name = p_name,
      display_order = COALESCE(p_display_order, display_order),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_coupon(p_id integer, p_code text, p_description text, p_coupon_type text, p_value integer, p_min_purchase integer, p_max_discount integer, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_usage_limit integer, p_per_user_limit integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_result_id INTEGER;
  v_code TEXT;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código requerido.');
  END IF;
  IF p_value IS NULL OR p_value <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Valor debe ser positivo.');
  END IF;
  IF p_coupon_type NOT IN ('percent', 'fixed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tipo inválido.');
  END IF;
  IF p_coupon_type = 'percent' AND p_value > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El porcentaje no puede superar 100%.');
  END IF;
  
  v_code := UPPER(TRIM(p_code));
  
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM coupons WHERE code = v_code) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ya existe un cupón con ese código.');
    END IF;
    INSERT INTO coupons (
      code, description, coupon_type, value, min_purchase, max_discount,
      valid_from, valid_until, usage_limit, per_user_limit, active, created_by
    ) VALUES (
      v_code, p_description, p_coupon_type::coupon_type, p_value,
      COALESCE(p_min_purchase, 0), p_max_discount,
      COALESCE(p_valid_from, NOW()), p_valid_until,
      p_usage_limit, COALESCE(p_per_user_limit, 1),
      COALESCE(p_active, true), v_admin.id
    ) RETURNING id INTO v_result_id;
  ELSE
    UPDATE coupons SET
      code = v_code,
      description = p_description,
      coupon_type = p_coupon_type::coupon_type,
      value = p_value,
      min_purchase = COALESCE(p_min_purchase, 0),
      max_discount = p_max_discount,
      valid_from = COALESCE(p_valid_from, valid_from),
      valid_until = p_valid_until,
      usage_limit = p_usage_limit,
      per_user_limit = COALESCE(p_per_user_limit, 1),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_payment_account(p_id integer, p_display_name text, p_payment_method text, p_bank text, p_currency text, p_iban text, p_account_number text, p_account_holder text, p_holder_id text, p_sinpe_number text, p_payment_link_url text, p_instructions text, p_display_order integer, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_result_id INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nombre requerido.');
  END IF;
  IF p_payment_method NOT IN ('sinpe', 'transferencia', 'deposito', 'link_bancario') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Método de pago inválido.');
  END IF;
  
  IF p_id IS NULL THEN
    INSERT INTO payment_accounts (
      display_name, payment_method, bank, currency, iban, account_number,
      account_holder, holder_id, sinpe_number, payment_link_url, instructions,
      display_order, active
    ) VALUES (
      p_display_name, p_payment_method::payment_method, p_bank, p_currency,
      p_iban, p_account_number, p_account_holder, p_holder_id, p_sinpe_number,
      p_payment_link_url, p_instructions, COALESCE(p_display_order, 0),
      COALESCE(p_active, true)
    ) RETURNING id INTO v_result_id;
  ELSE
    UPDATE payment_accounts SET
      display_name = p_display_name,
      payment_method = p_payment_method::payment_method,
      bank = p_bank,
      currency = p_currency,
      iban = p_iban,
      account_number = p_account_number,
      account_holder = p_account_holder,
      holder_id = p_holder_id,
      sinpe_number = p_sinpe_number,
      payment_link_url = p_payment_link_url,
      instructions = p_instructions,
      display_order = COALESCE(p_display_order, display_order),
      active = COALESCE(p_active, active)
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_service(p_id integer, p_name text, p_category_id integer, p_price integer, p_short_description text, p_long_description text, p_estimated_time text, p_required_documents jsonb, p_icon text, p_points_percentage numeric, p_active boolean, p_featured boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_slug TEXT;
  v_result_id INTEGER;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden gestionar servicios.');
  END IF;
  
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El nombre es requerido.');
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El precio debe ser positivo.');
  END IF;
  
  -- Generar slug desde el nombre
  v_slug := lower(regexp_replace(unaccent(p_name), '[^a-z0-9]+', '-', 'gi'));
  v_slug := trim(both '-' from v_slug);
  
  IF p_id IS NULL THEN
    -- CREAR NUEVO
    -- Si slug ya existe, agregarle sufijo numérico
    IF EXISTS (SELECT 1 FROM services WHERE slug = v_slug) THEN
      v_slug := v_slug || '-' || floor(random() * 1000)::text;
    END IF;
    
    INSERT INTO services (
      name, slug, category_id, price, short_description, long_description,
      estimated_time, required_documents, icon, points_percentage, active, featured
    ) VALUES (
      p_name, v_slug, p_category_id, p_price, p_short_description, p_long_description,
      p_estimated_time, p_required_documents, p_icon, p_points_percentage, p_active, p_featured
    ) RETURNING id INTO v_result_id;
  ELSE
    -- ACTUALIZAR
    UPDATE services SET
      name = p_name,
      category_id = p_category_id,
      price = p_price,
      short_description = p_short_description,
      long_description = p_long_description,
      estimated_time = p_estimated_time,
      required_documents = p_required_documents,
      icon = p_icon,
      points_percentage = p_points_percentage,
      active = p_active,
      featured = p_featured
    WHERE id = p_id;
    v_result_id := p_id;
  END IF;
  
  RETURN jsonb_build_object('ok', true, 'id', v_result_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_setting(p_key text, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  INSERT INTO settings (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, v_admin.id, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(profile_id uuid, new_role user_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo admin puede cambiar roles.');
  END IF;
  
  UPDATE users_profile SET role = new_role WHERE id = profile_id;
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(p_profile_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
  v_target users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role != 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo administradores pueden activar/desactivar usuarios.');
  END IF;
  
  SELECT * INTO v_target FROM users_profile WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario no encontrado.');
  END IF;
  
  -- Proteger: no auto-desactivarse
  IF v_target.user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puede desactivarse a sí mismo.');
  END IF;
  
  -- Actualizar el flag active en el perfil
  UPDATE users_profile SET active = p_active WHERE id = p_profile_id;
  
  -- Si se desactiva: invalidar sesión actual banneando el auth
  IF p_active = false THEN
    UPDATE auth.users 
    SET banned_until = 'infinity'::timestamptz
    WHERE id = v_target.user_id;
  ELSE
    UPDATE auth.users 
    SET banned_until = NULL
    WHERE id = v_target.user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'active', p_active,
    'message', CASE WHEN p_active THEN 'Usuario activado' ELSE 'Usuario desactivado' END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(order_id uuid, new_status order_status, note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_admin users_profile%ROWTYPE;
  v_old_status order_status;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role NOT IN ('admin', 'operador') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  SELECT * INTO v_order FROM orders WHERE id = order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Orden no encontrada.');
  END IF;
  
  v_old_status := v_order.order_status;
  
  UPDATE orders SET
    order_status = new_status,
    completed_at = CASE 
      WHEN new_status IN ('completado', 'entregado') AND completed_at IS NULL 
      THEN NOW() ELSE completed_at END
  WHERE id = order_id;
  
  INSERT INTO order_notes (
    order_id, author_id, author_name, kind, content
  ) VALUES (
    order_id, v_admin.id, v_admin.name, 'system',
    'Estado cambiado de "' || v_old_status || '" a "' || new_status || '"' ||
    CASE WHEN note != '' THEN '. Nota: ' || note ELSE '' END
  );
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_user(p_profile_id uuid, p_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_id_card text DEFAULT NULL::text, p_company text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_billing_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin users_profile%ROWTYPE;
BEGIN
  SELECT * INTO v_admin FROM users_profile WHERE user_id = auth.uid();
  IF v_admin.role NOT IN ('admin', 'operador') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permisos.');
  END IF;
  
  UPDATE users_profile SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    id_card = COALESCE(p_id_card, id_card),
    company = COALESCE(p_company, company),
    address = COALESCE(p_address, address),
    billing_email = COALESCE(p_billing_email, billing_email)
  WHERE id = p_profile_id;
  
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM users_profile WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM users_profile WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_reference()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE new_ref TEXT; attempts INTEGER := 0;
BEGIN
  LOOP
    new_ref := 'ORD-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE reference = new_ref);
    attempts := attempts + 1;
    IF attempts > 20 THEN new_ref := 'ORD-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS'); EXIT; END IF;
  END LOOP;
  RETURN new_ref;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; new_code TEXT; attempts INTEGER := 0;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..6 LOOP
      new_code := new_code || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars))::INTEGER + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM users_profile WHERE referral_code = new_code);
    attempts := attempts + 1;
    EXIT WHEN attempts > 20;
  END LOOP;
  RETURN new_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users_profile (user_id, email, name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    public.generate_referral_code()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si falla por cualquier razón, dejamos que el usuario se cree igual
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_points_balance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE users_profile SET points_balance = NEW.balance_after WHERE id = NEW.user_id;
  RETURN NEW;
END;
$function$;

-- Triggers
CREATE TRIGGER tg_users_profile_updated_at BEFORE UPDATE ON public.users_profile FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_receipts_updated_at BEFORE UPDATE ON public.payment_receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_update_points_balance AFTER INSERT ON public.points_ledger FOR EACH ROW EXECUTE FUNCTION update_user_points_balance();
CREATE TRIGGER tg_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER tg_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY cat_select ON public.categories AS PERMISSIVE FOR SELECT TO public
  USING (((active = true) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY cat_all ON public.categories AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY svc_select ON public.services AS PERMISSIVE FOR SELECT TO public
  USING (((active = true) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY svc_all ON public.services AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY cpn_select ON public.coupons AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role])));
CREATE POLICY cpn_all ON public.coupons AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY set_select ON public.settings AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role])));
CREATE POLICY set_all ON public.settings AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY receipts_authenticated_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'receipts'::text));
CREATE POLICY doc_select ON public.documents AS PERMISSIVE FOR SELECT TO public
  USING ((((user_id = current_user_profile_id()) AND (is_internal = false)) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY doc_insert ON public.documents AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role]))));
CREATE POLICY doc_update ON public.documents AS PERMISSIVE FOR UPDATE TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY cr_select ON public.coupon_redemptions AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY up_delete_admin ON public.users_profile AS PERMISSIVE FOR DELETE TO authenticated
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY ord_select ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY cr_insert ON public.coupon_redemptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role]))));
CREATE POLICY pl_select ON public.points_ledger AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY pl_insert ON public.points_ledger AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY ref_select ON public.referrals AS PERMISSIVE FOR SELECT TO public
  USING (((referrer_id = current_user_profile_id()) OR (referred_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY pa_select_active ON public.payment_accounts AS PERMISSIVE FOR SELECT TO public
  USING ((active = true));
CREATE POLICY pa_select_staff ON public.payment_accounts AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role])));
CREATE POLICY pa_all_admin ON public.payment_accounts AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY receipts_authenticated_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'receipts'::text));
CREATE POLICY receipts_authenticated_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'receipts'::text) AND ((owner = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])))));
CREATE POLICY documents_authenticated_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'documents'::text));
CREATE POLICY documents_authenticated_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'documents'::text));
CREATE POLICY documents_authenticated_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'documents'::text) AND ((owner = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])))));
CREATE POLICY up_select ON public.users_profile AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY up_update_own ON public.users_profile AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK (((user_id = auth.uid()) AND (role = 'cliente'::user_role)));
CREATE POLICY up_update_staff ON public.users_profile AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY up_insert_admin ON public.users_profile AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = 'admin'::user_role));
CREATE POLICY ord_insert ON public.orders AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = current_user_profile_id()) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role]))));
CREATE POLICY ord_update ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY ord_delete ON public.orders AS PERMISSIVE FOR DELETE TO authenticated
  USING ((current_user_role() = 'admin'::user_role));
CREATE POLICY oi_select ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = current_user_profile_id()))) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY oi_insert ON public.order_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = current_user_profile_id()))) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role]))));
CREATE POLICY pr_select ON public.payment_receipts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = current_user_profile_id()))) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role]))));
CREATE POLICY pr_insert ON public.payment_receipts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = current_user_profile_id()))) OR (current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role]))));
CREATE POLICY pr_update ON public.payment_receipts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY on_select ON public.order_notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role, 'consulta'::user_role])) OR ((kind <> 'internal'::note_kind) AND (order_id IN ( SELECT orders.id
   FROM orders
  WHERE (orders.user_id = current_user_profile_id()))))));
CREATE POLICY on_insert ON public.order_notes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::user_role, 'operador'::user_role])));
CREATE POLICY settings_public_read ON public.settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((key = ANY (ARRAY['business_name'::text, 'business_email'::text, 'business_phone'::text, 'business_address'::text, 'business_hours'::text, 'hero_stats'::text, 'point_value_crc'::text, 'allow_combine_coupon_and_points'::text])));

-- Buckets de Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('documents', 'documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]) ON CONFLICT (id) DO NOTHING;
