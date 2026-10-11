// ============================================================
// Tramitá — Edge Function: aviso por correo cuando se aprueba un pago (#30)
//
// El panel la llama justo después de admin_approve_receipt(). Verifica que
// quien llama sea del equipo, lee la orden con la service role (solo existe
// en el servidor de Supabase) y envía el correo con Resend.
//
// Despliegue (una vez):
//   1. Crear cuenta en https://resend.com, verificar el dominio y crear una API key.
//   2. supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Tramitá <avisos@tudominio.cr>"
//   3. supabase functions deploy notify-payment-approved
// Si no está desplegada, el panel sigue funcionando igual (solo no se envía correo).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean);

function cors(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const crc = (n: number) => '₡' + Number(n || 0).toLocaleString('es-CR');

Deno.serve(async req => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, headers);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!resendKey || !from) return json({ error: 'Correo no configurado' }, 503, headers);

  // 1. ¿Quién llama? Debe ser admin u operador (misma regla que la base de datos)
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: 'No autenticado' }, 401, headers);
  const { data: role } = await asUser.rpc('current_user_role');
  if (!['admin', 'operador'].includes(role)) return json({ error: 'Sin permisos' }, 403, headers);

  // 2. Datos de la orden (service role: solo en el servidor)
  const { order_id } = await req.json().catch(() => ({}));
  if (!order_id) return json({ error: 'Falta order_id' }, 400, headers);
  const admin = createClient(url, serviceKey);
  const { data: order } = await admin
    .from('orders')
    .select('reference, total, payment_status, points_earned, users_profile!orders_user_id_fkey(name, email), order_items(service_name, quantity)')
    .eq('id', order_id)
    .single();
  if (!order || order.payment_status !== 'paid') return json({ error: 'Orden no pagada' }, 409, headers);
  const client = order.users_profile as unknown as { name: string; email: string };
  if (!client?.email) return json({ error: 'Cliente sin correo' }, 422, headers);

  const { data: biz } = await admin.from('settings').select('key, value').in('key', ['business_name', 'business_phone']);
  const settings = Object.fromEntries((biz ?? []).map(r => [r.key, r.value]));
  const businessName = String(settings.business_name || 'Tramitá');
  const firstName = (client.name || '').split(' ')[0];
  const items = (order.order_items as { service_name: string; quantity: number }[])
    .map(i => `<li>${esc(i.service_name)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</li>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0B1F3F">
      <h2 style="font-weight:normal">Hola ${esc(firstName)}, confirmamos su pago ✓</h2>
      <p>Recibimos el pago de su orden <strong>${esc(order.reference)}</strong> por <strong>${esc(crc(order.total))}</strong>. Ya iniciamos la gestión de:</p>
      <ul>${items}</ul>
      ${order.points_earned > 0 ? `<p>Ganó <strong>${esc(order.points_earned)}</strong> puntos con esta compra.</p>` : ''}
      <p>Puede ver el avance en "Mis compras". Le estaremos informando.</p>
      <p style="color:#5f687c;font-size:13px">— ${esc(businessName)}</p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [client.email], subject: `Pago confirmado — orden ${order.reference}`, html }),
  });
  if (!res.ok) return json({ error: 'No se pudo enviar el correo', detail: await res.text() }, 502, headers);
  return json({ ok: true }, 200, headers);
});
