// ============================================================
// CONFIGURACIÓN SUPABASE
// ============================================================
// La publishable key es pública por diseño: la seguridad está en las
// políticas RLS y funciones de la base de datos. Nunca usar aquí la
// secret / service_role key.
const SUPABASE_URL = 'https://kltpwbsdcdegrwegxhem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z8RK_z4UfJaXoVld-MKygQ_Y091VYTk';

// PKCE: los enlaces de los correos (confirmar cuenta, recuperar contraseña)
// vuelven con ?code=... y no chocan con las rutas #/... de la app.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

// Límites de archivos de comprobante (iguales a los del bucket "receipts")
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MIN_PASSWORD = 8;
