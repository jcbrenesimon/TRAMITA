// ============ CONFIG ============
// La publishable key es pública por diseño (la seguridad está en RLS y en
// las funciones admin_* de la base de datos). Nunca usar la secret key.
const SUPABASE_URL = 'https://kltpwbsdcdegrwegxhem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z8RK_z4UfJaXoVld-MKygQ_Y091VYTk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// URL de la app pública para clientes (enlace en la pantalla de ingreso)
const PUBLIC_APP_URL = '../Web app view/tramita-app-v2.html';

const MIN_PASSWORD = 8;
const PAGE_SIZE = 25;
const SERVICE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
