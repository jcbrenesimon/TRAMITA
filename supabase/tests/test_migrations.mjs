import { createDb, runFile, createAuthUser, as, rpc, q } from './env.mjs';

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail !== undefined ? JSON.stringify(detail) : ''); }
};

const db = await createDb();

// ---------- Datos parecidos a producción (ANTES de migrar) ----------
await db.exec(`
  insert into categories (name, slug, display_order) values ('Trámites Vehiculares','vehiculares',1),('Documentos','documentos',2);
  insert into services (name, slug, category_id, price, points_percentage, active, featured) values
    ('Recuperación de Placas','placas',1,35000,1,true,true),
    ('Apostilla','apostilla',2,25000,2,true,false),
    ('Servicio inactivo','inactivo',2,1000,0,false,false);
  insert into payment_accounts (display_name, payment_method, bank, sinpe_number, display_order) values ('SINPE Móvil','sinpe','BN','8888-8888',1);
  insert into settings (key, value) values ('point_value_crc','10'),('allow_combine_coupon_and_points','false'),
    ('referral_bonus_points','500'),('referred_welcome_points','200'),('business_phone','"50672195787"'),
    ('payment_iban','"CR00"'),('business_tax_id','"3-101-000000"');
  insert into coupons (code, coupon_type, value, min_purchase, usage_limit, per_user_limit, active)
    values ('BIENVENIDA10','percent',10,10000,100,1,true), ('VENCIDO','fixed',5000,0,null,1,true);
  update coupons set valid_until = now() - interval '1 day' where code='VENCIDO';
`);

const client = await createAuthUser(db, 'cliente@test.cr', 'cliente', { name: 'Cliente Uno' });
const other = await createAuthUser(db, 'otro@test.cr');
const admin = await createAuthUser(db, 'admin@test.cr', 'admin', { name: 'Admin' });
const oper = await createAuthUser(db, 'oper@test.cr', 'operador', { name: 'Oper' });
const cons = await createAuthUser(db, 'consulta@test.cr', 'consulta');

// Usuario sin identity (como operador@tramita.app en producción)
await db.exec(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated','sinidentity@test.cr','x',now(),now(),now(),'{}','{"name":"Sin Identity"}')`);
// Las identities de los demás usuarios de prueba (como en producción)
await db.exec(`insert into auth.identities (provider_id,user_id,identity_data,provider) select id::text,id,jsonb_build_object('sub',id::text,'email',email),'email' from auth.users where email <> 'sinidentity@test.cr'`);

// Saldo inicial del cliente: 300 puntos
await db.query(`insert into points_ledger (user_id, movement, points, balance_after, description) values ($1,'adjusted',300,300,'saldo inicial')`, [client.profileId]);

// Orden "legada" creada como lo hacía la web vieja: con 100 puntos usados y cupón, sin ledger ni redención
const legacy = (await db.query(`insert into orders (reference,user_id,order_status,payment_status,payment_method,payment_account_id,subtotal,discount_amount,points_used,points_discount,points_earned,total,coupon_id,coupon_code)
  values ('ORD-LEGACY',$1,'pendiente_de_pago','pending','sinpe',1,35000,3500,100,1000,350,30500,(select id from coupons where code='BIENVENIDA10'),'BIENVENIDA10') returning id`, [client.profileId])).rows[0].id;
await db.query(`insert into order_items (order_id,service_id,service_name,service_price,quantity,subtotal,points_earned) values ($1,1,'Recuperación de Placas',35000,1,35000,350)`, [legacy]);
const legacyReceipt = (await db.query(`insert into payment_receipts (order_id,uploaded_by,storage_path,original_filename,mime_type,file_size,payment_method,amount,status)
  values ($1,$2,$3,'r.pdf','application/pdf',100,'sinpe',30500,'pendiente') returning id`, [legacy, client.profileId, `${client.profileId}/${legacy}/1_r.pdf`])).rows[0].id;

// ---------- Migraciones ----------
for (const f of ['01_emergencia_permisos_admin', '02_permisos_equipo', '03_perfiles_y_usuarios', '04_ordenes_pagos_puntos', '05_busqueda_y_dashboard', '06_registro_errores', '07_contenido_e_imagenes', '08_imagenes_servicios_lectura']) {
  try { await runFile(db, `supabase/migrations/20261011_${f}.sql`); console.log('migración', f, 'OK'); }
  catch (e) { console.log('migración', f, 'FALLÓ:', e.message); process.exit(1); }
}
// Segunda ejecución: deben ser idempotentes
for (const f of ['01_emergencia_permisos_admin', '02_permisos_equipo', '03_perfiles_y_usuarios', '04_ordenes_pagos_puntos', '05_busqueda_y_dashboard', '06_registro_errores', '07_contenido_e_imagenes', '08_imagenes_servicios_lectura']) {
  try { await runFile(db, `supabase/migrations/20261011_${f}.sql`); }
  catch (e) { console.log('re-ejecución', f, 'FALLÓ:', e.message); process.exit(1); }
}
console.log('re-ejecución de todas las migraciones OK (idempotentes)\n');

console.log('== Ataques que deben fallar');
let r = await as(db, null, () => rpc(db, 'admin_adjust_points', { p_profile_id: client.profileId, p_points_delta: 1000000, p_description: 'x' }));
check('anon no puede ajustar puntos', r.error && /permission denied/.test(r.error), r);
r = await as(db, null, () => rpc(db, 'admin_create_user', { p_email: 'evil@x.com', p_password: '12345678', p_name: 'E', p_role: 'admin' }));
check('anon no puede crear admins', r.error && /permission denied/.test(r.error), r);
r = await as(db, client.uid, () => rpc(db, 'admin_create_user', { p_email: 'evil@x.com', p_password: '12345678', p_name: 'E', p_role: 'admin' }));
check('cliente no puede crear admins', r.data && r.data.ok === false, r);
r = await as(db, client.uid, () => rpc(db, 'admin_approve_receipt', { p_receipt_id: legacyReceipt, p_admin_notes: '' }));
check('cliente no puede aprobar su comprobante', r.data && r.data.ok === false, r);
r = await as(db, client.uid, () => q(db, `update users_profile set points_balance = 999999 where user_id = auth.uid()`));
check('cliente no puede editar su saldo de puntos', r.error && /No se permite/.test(r.error), r);
r = await as(db, client.uid, () => q(db, `update users_profile set role = 'admin' where user_id = auth.uid()`));
check('cliente no puede volverse admin', !!r.error, r);
r = await as(db, client.uid, () => q(db, `update users_profile set name = 'Cliente Editado', phone = '8888-0000' where user_id = auth.uid() returning name`));
check('cliente SÍ puede editar sus datos personales', r.rows && r.rows[0]?.name === 'Cliente Editado', r);
r = await as(db, oper.uid, () => q(db, `update users_profile set role = 'admin' where id = $1 returning id`, [client.profileId]));
check('operador no puede editar perfiles ajenos (H3)', r.rows && r.rows.length === 0, r);
r = await as(db, client.uid, () => q(db, `insert into orders (reference,user_id,total) values ('ORD-HACK',$1,1) returning id`, [client.profileId]));
check('cliente no puede insertar órdenes directo (H1)', !!r.error, r);
r = await as(db, client.uid, () => q(db, `select code from coupons`));
check('cliente no puede listar cupones', r.rows && r.rows.length === 0, r);
r = await as(db, null, () => q(db, `select key from settings order by key`));
check('visitante solo lee claves públicas', r.rows && !r.rows.some(x => ['business_tax_id', 'referral_bonus_points', 'require_staff_mfa'].includes(x.key)), r.rows?.map(x => x.key));
check('claves payment_* legadas eliminadas', !(await q(db, `select 1 from settings where key='payment_iban'`)).rows.length);

// Storage
await q(db, `insert into storage.objects (bucket_id, name, owner) values ('receipts', $1, $2)`, [`${other.profileId}/x/recibo.pdf`, other.uid]);
r = await as(db, client.uid, () => q(db, `select name from storage.objects where bucket_id='receipts' and name like $1`, [`${other.profileId}%`]));
check('cliente no lee comprobantes de otros (Storage)', r.rows && r.rows.length === 0, r);
r = await as(db, client.uid, () => q(db, `insert into storage.objects (bucket_id, name, owner) values ('receipts', $1, auth.uid())`, [`${other.profileId}/x/falso.pdf`]));
check('cliente no sube archivos a la carpeta de otro', !!r.error, r);
r = await as(db, client.uid, () => q(db, `insert into storage.objects (bucket_id, name, owner) values ('receipts', $1, auth.uid()) returning name`, [`${client.profileId}/y/mio.pdf`]));
check('cliente SÍ sube a su propia carpeta', r.rows && r.rows.length === 1, r);
r = await as(db, admin.uid, () => q(db, `select count(*)::int as n from storage.objects where bucket_id='receipts'`));
check('admin ve todos los comprobantes', r.rows && r.rows[0].n >= 2, r);

console.log('\n== Cupones');
r = await as(db, client.uid, () => rpc(db, 'validate_coupon', { p_code: 'bienvenida10', p_subtotal: 35000 }));
check('validate_coupon válido (minúsculas) → 10% = 3500', r.data?.ok && r.data.discount === 3500, r);
r = await as(db, client.uid, () => rpc(db, 'validate_coupon', { p_code: 'BIENVENIDA10', p_subtotal: 5000 }));
check('validate_coupon compra mínima', r.data?.ok === false && /Compra mínima de ₡10.000/.test(r.data.error), r);
r = await as(db, client.uid, () => rpc(db, 'validate_coupon', { p_code: 'VENCIDO', p_subtotal: 50000 }));
check('validate_coupon expirado', r.data?.ok === false && r.data.error === 'Cupón expirado', r);
r = await as(db, null, () => rpc(db, 'validate_coupon', { p_code: 'BIENVENIDA10', p_subtotal: 50000 }));
check('anon no puede validar cupones', !!r.error, r);

console.log('\n== Crear orden (servidor)');
const bal0 = (await q(db, 'select points_balance from users_profile where id=$1', [client.profileId])).rows[0].points_balance;
r = await as(db, client.uid, () => rpc(db, 'create_order', {
  p_items: [{ service_id: 1, quantity: 1, price: 1 }, { service_id: 2, quantity: 2, price: 1 }, { service_id: 1 }],
  p_payment_account_id: 1, p_coupon_code: null, p_use_points: true, p_shipping_address: 'San José' }));
const o1 = r.data?.order;
check('create_order ok', r.data?.ok, r);
check('precios desde la BD (ignora price=1 del navegador): 2×35000 + 2×25000 = 120000', o1?.subtotal === 120000, o1);
check('puntos usados = saldo (' + bal0 + ') y descuento = ' + bal0 * 10, o1?.points_used === bal0 && o1?.points_discount === bal0 * 10, o1);
check('total = subtotal − puntos', o1?.total === 120000 - bal0 * 10, o1);
check('puntos ganados = 1%·70000 + 2%·50000 = 1700', o1?.points_earned === 1700, o1);
const items1 = (await q(db, 'select service_id, quantity from order_items where order_id=$1 order by service_id', [o1.id])).rows;
check('items agrupados con cantidades (1→2, 2→2)', JSON.stringify(items1) === JSON.stringify([{ service_id: 1, quantity: 2 }, { service_id: 2, quantity: 2 }]), items1);
const bal1 = (await q(db, 'select points_balance from users_profile where id=$1', [client.profileId])).rows[0].points_balance;
check('puntos reservados al crear la orden (saldo 0)', bal1 === 0, bal1);
r = await as(db, client.uid, () => rpc(db, 'create_order', { p_items: [{ service_id: 3 }], p_payment_account_id: 1 }));
check('servicio inactivo rechazado', r.data?.ok === false, r);
r = await as(db, client.uid, () => rpc(db, 'create_order', { p_items: [{ service_id: 1 }], p_payment_account_id: 999 }));
check('cuenta de pago inválida rechazada', r.data?.ok === false, r);

r = await as(db, other.uid, () => rpc(db, 'create_order', { p_items: [{ service_id: 2 }], p_payment_account_id: 1, p_coupon_code: 'BIENVENIDA10' }));
const o2 = r.data?.order;
check('orden con cupón: total 25000 − 2500 = 22500', o2?.total === 22500 && o2?.discount_amount === 2500, r);
check('uso del cupón registrado (usage_count=1)', (await q(db, `select usage_count from coupons where code='BIENVENIDA10'`)).rows[0].usage_count === 1);
r = await as(db, other.uid, () => rpc(db, 'create_order', { p_items: [{ service_id: 2 }], p_payment_account_id: 1, p_coupon_code: 'BIENVENIDA10' }));
check('límite por usuario del cupón respetado', r.data?.ok === false && r.data.error === 'Ya utilizó este cupón', r);

console.log('\n== Comprobantes');
r = await as(db, other.uid, () => q(db, `insert into payment_receipts (order_id,uploaded_by,storage_path,original_filename,mime_type,file_size,payment_method,amount,status,verified_at)
  values ($1,$2,$3,'c.png','image/png',10,'sinpe',1,'aprobado',now()) returning status, amount, verified_at`, [o2.id, other.profileId, `${other.profileId}/${o2.id}/1_c.png`]));
check('comprobante forzado a pendiente con el monto real', r.rows && r.rows[0].status === 'pendiente' && r.rows[0].amount === 22500 && r.rows[0].verified_at === null, r);
const rec2 = (await q(db, `select id from payment_receipts where order_id=$1`, [o2.id])).rows[0].id;
r = await as(db, other.uid, () => q(db, `insert into payment_receipts (order_id,uploaded_by,storage_path,original_filename,mime_type,file_size,payment_method,amount)
  values ($1,$2,$3,'c.png','image/png',10,'sinpe',1)`, [o2.id, other.profileId, `${other.profileId}/${o2.id}/2_c.png`]));
check('no se permite un segundo comprobante pendiente', !!r.error, r);
r = await as(db, client.uid, () => q(db, `insert into payment_receipts (order_id,uploaded_by,storage_path,original_filename,mime_type,file_size,payment_method,amount)
  values ($1,$2,$3,'c.png','image/png',10,'sinpe',1)`, [o2.id, client.profileId, `${client.profileId}/${o2.id}/x.png`]));
check('cliente no sube comprobantes a órdenes ajenas', !!r.error, r);

console.log('\n== Aprobar / rechazar / estados');
r = await as(db, oper.uid, () => rpc(db, 'admin_approve_receipt', { p_receipt_id: rec2, p_admin_notes: 'ok' }));
check('operador aprueba', r.data?.ok && r.data.points_earned === 500, r);
const bOther = (await q(db, 'select points_balance from users_profile where id=$1', [other.profileId])).rows[0].points_balance;
check('puntos ganados acreditados (500)', bOther === 500, bOther);
r = await as(db, oper.uid, () => rpc(db, 'admin_approve_receipt', { p_receipt_id: rec2, p_admin_notes: '' }));
check('no se aprueba dos veces (#7)', r.data?.ok === false, r);
r = await as(db, other.uid, () => q(db, `insert into payment_receipts (order_id,uploaded_by,storage_path,original_filename,mime_type,file_size,payment_method,amount)
  values ($1,$2,$3,'c.png','image/png',10,'sinpe',1)`, [o2.id, other.profileId, `${other.profileId}/${o2.id}/3_c.png`]));
check('orden pagada ya no admite comprobantes', !!r.error, r);

// Orden legada: canje de puntos y cupón al aprobar
await q(db, `insert into points_ledger (user_id, movement, points, balance_after, description) values ($1,'adjusted',200,200,'recarga prueba')`, [client.profileId]);
r = await as(db, admin.uid, () => rpc(db, 'admin_approve_receipt', { p_receipt_id: legacyReceipt, p_admin_notes: '' }));
check('aprobación de orden legada ok', r.data?.ok, r);
const legLedger = (await q(db, `select movement, points from points_ledger where order_id=$1 order by id`, [legacy])).rows;
check('orden legada: canjea 100 y acredita 350', JSON.stringify(legLedger) === JSON.stringify([{ movement: 'redeemed', points: -100 }, { movement: 'earned', points: 350 }]), legLedger);
check('orden legada: cupón registrado', (await q(db, `select count(*)::int n from coupon_redemptions where order_id=$1`, [legacy])).rows[0].n === 1);

r = await as(db, oper.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o1.id, p_new_status: 'pagado', p_note: '' }));
check('no se puede marcar Pagado a mano', r.data?.ok === false, r);
r = await as(db, cons.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o2.id, p_new_status: 'en_proceso', p_note: '' }));
check('consulta no cambia estados', r.data?.ok === false, r);
r = await as(db, oper.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o2.id, p_new_status: 'en_proceso', p_note: 'inicia' }));
check('operador pasa a En gestión', r.data?.ok, r);

console.log('\n== Cancelación (#10)');
const balBefore = (await q(db, 'select points_balance from users_profile where id=$1', [client.profileId])).rows[0].points_balance;
r = await as(db, oper.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o1.id, p_new_status: 'cancelado', p_note: '' }));
check('cancelar orden pendiente', r.data?.ok, r);
const balAfter = (await q(db, 'select points_balance from users_profile where id=$1', [client.profileId])).rows[0].points_balance;
check(`devuelve los ${o1.points_used} puntos canjeados`, balAfter - balBefore === o1.points_used, { balBefore, balAfter });
check('pago queda cancelled', (await q(db, 'select payment_status from orders where id=$1', [o1.id])).rows[0].payment_status === 'cancelled');
r = await as(db, oper.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o1.id, p_new_status: 'en_proceso', p_note: '' }));
check('orden cancelada no se puede reabrir', r.data?.ok === false, r);

r = await as(db, admin.uid, () => rpc(db, 'admin_update_order_status', { p_order_id: o2.id, p_new_status: 'cancelado', p_note: '' }));
check('cancelar orden pagada', r.data?.ok && /REEMBOLSADO/.test(r.data.message), r);
const o2s = (await q(db, 'select payment_status from orders where id=$1', [o2.id])).rows[0];
check('pago queda refunded', o2s.payment_status === 'refunded', o2s);
check('puntos ganados revertidos (saldo 0)', (await q(db, 'select points_balance from users_profile where id=$1', [other.profileId])).rows[0].points_balance === 0);
check('cupón liberado (usage_count vuelve)', (await q(db, `select usage_count from coupons where code='BIENVENIDA10'`)).rows[0].usage_count === 1);
r = await as(db, other.uid, () => rpc(db, 'validate_coupon', { p_code: 'BIENVENIDA10', p_subtotal: 35000 }));
check('cliente puede volver a usar el cupón liberado', r.data?.ok, r);

console.log('\n== Usuarios del equipo');
check('usuario sin identity reparado', (await q(db, `select count(*)::int n from auth.identities i join auth.users u on u.id=i.user_id where u.email='sinidentity@test.cr'`)).rows[0].n === 1);
r = await as(db, admin.uid, () => rpc(db, 'admin_create_user', { p_email: 'Nuevo@Test.cr', p_password: 'corta', p_name: 'Nuevo', p_role: 'operador' }));
check('contraseña de 5 caracteres rechazada (#16)', r.data?.ok === false, r);
r = await as(db, admin.uid, () => rpc(db, 'admin_create_user', { p_email: 'Nuevo@Test.cr', p_password: 'segura123', p_name: 'Nuevo', p_phone: '8888-1111', p_role: 'operador' }));
check('admin crea usuario', r.data?.ok, r);
const nu = (await q(db, `select p.role, p.phone, (select count(*)::int from auth.identities i where i.user_id=u.id) idn, u.confirmation_token from auth.users u join users_profile p on p.user_id=u.id where u.email='nuevo@test.cr'`)).rows[0];
check('nuevo usuario con identity, rol y teléfono (#13)', nu?.idn === 1 && nu.role === 'operador' && nu.phone === '8888-1111' && nu.confirmation_token === '', nu);
r = await as(db, admin.uid, () => rpc(db, 'admin_set_user_role', { p_profile_id: admin.profileId, p_new_role: 'cliente' }));
check('admin no puede quitarse su propio rol', r.data?.ok === false, r);
r = await as(db, oper.uid, () => rpc(db, 'admin_update_user', { p_profile_id: client.profileId, p_name: 'x' }));
check('operador no edita usuarios (matriz de permisos)', r.data?.ok === false, r);

console.log('\n== Registro (#12)');
const reg = await createAuthUser(db, 'registro@test.cr', 'cliente', { name: 'Ana Pérez', id_card: '1-1111-1111', phone: '8888-2222', address: 'Heredia', company: 'ACME', terms_accepted: true });
const regP = (await q(db, `select name,id_card,phone,address,company,billing_email,terms_accepted_at is not null as terms from users_profile where id=$1`, [reg.profileId])).rows[0];
check('el trigger guarda todos los datos del registro', regP.name === 'Ana Pérez' && regP.id_card === '1-1111-1111' && regP.phone === '8888-2222' && regP.address === 'Heredia' && regP.company === 'ACME' && regP.billing_email === 'registro@test.cr' && regP.terms, regP);

console.log('\n== Búsqueda y dashboard');
r = await as(db, cons.uid, () => rpc(db, 'admin_search_orders', { p_search: 'legacy', p_status: 'all', p_limit: 10, p_offset: 0 }));
check('consulta busca órdenes por referencia', r.data?.ok && r.data.total === 1 && r.data.rows[0].reference === 'ORD-LEGACY', r);
r = await as(db, admin.uid, () => rpc(db, 'admin_search_orders', { p_search: 'cliente editado', p_status: 'all', p_limit: 10, p_offset: 0 }));
check('búsqueda por nombre del cliente', r.data?.ok && r.data.total === 2, r.data?.total);
r = await as(db, admin.uid, () => rpc(db, 'admin_search_orders', { p_search: '88880000', p_status: 'all', p_limit: 10, p_offset: 0 }));
check('búsqueda por teléfono sin guion', r.data?.ok && r.data.total === 2, r.data?.total);
r = await as(db, admin.uid, () => rpc(db, 'admin_search_orders', { p_search: '%', p_status: 'cancelado', p_limit: 1, p_offset: 0 }));
check('"%" se trata como texto, no comodín', r.data?.ok && r.data.total === 0, r.data);
r = await as(db, admin.uid, () => rpc(db, 'admin_search_users', { p_search: 'perez', p_role: 'all', p_limit: 10, p_offset: 0 }));
check('búsqueda de usuarios sin tilde (Pérez)', r.data?.ok && r.data.total === 1, r.data);
r = await as(db, client.uid, () => rpc(db, 'admin_search_users', { p_search: '', p_role: 'all', p_limit: 10, p_offset: 0 }));
check('cliente no puede buscar usuarios', r.data?.ok === false, r);
r = await as(db, admin.uid, () => rpc(db, 'admin_dashboard_kpis'));
check('dashboard responde', r.data && r.data.orders_this_month >= 3 && !r.data.error, r.data);

console.log('\n== Verificación en dos pasos del equipo (#17)');
await db.exec(`update settings set value='true' where key='require_staff_mfa'`);
r = await as(db, admin.uid, () => rpc(db, 'admin_dashboard_kpis'), { aal: 'aal1' });
check('con MFA exigido, admin sin segundo factor es rechazado', r.data?.error === 'Sin permisos', r);
r = await as(db, admin.uid, () => q(db, `select count(*)::int n from orders`), { aal: 'aal1' });
check('…y tampoco lee órdenes ajenas por RLS', r.rows && r.rows[0].n === 0, r);
r = await as(db, admin.uid, () => rpc(db, 'admin_dashboard_kpis'), { aal: 'aal2' });
check('admin con segundo factor (aal2) sí entra', r.data && !r.data.error, r);
r = await as(db, other.uid, () => rpc(db, 'validate_coupon', { p_code: 'BIENVENIDA10', p_subtotal: 35000 }), { aal: 'aal1' });
check('los clientes no necesitan MFA', r.data?.ok, r);
await db.exec(`update settings set value='false' where key='require_staff_mfa'`);

console.log('\n== Errores (#22) y servicios (#32)');
r = await as(db, null, () => rpc(db, 'log_client_error', { p_app: 'web', p_message: 'TypeError x', p_stack: 's', p_url: '/', p_user_agent: 'ua' }));
check('visitante registra un error', !r.error, r);
for (let i = 0; i < 30; i++) await as(db, null, () => rpc(db, 'log_client_error', { p_app: 'web', p_message: 'spam' }));
check('límite de 20 errores por minuto', (await q(db, `select count(*)::int n from client_errors`)).rows[0].n === 20);
r = await as(db, client.uid, () => q(db, `select * from client_errors`));
check('cliente no lee el registro de errores', r.rows && r.rows.length === 0, r);
r = await as(db, cons.uid, () => q(db, `select count(*)::int n from client_errors`));
check('el equipo sí lo lee', r.rows && r.rows[0].n === 20, r);
r = await as(db, admin.uid, () => rpc(db, 'admin_save_service', { p_id: 1, p_name: 'Recuperación de Placas', p_category_id: 1, p_price: 36000, p_short_description: 'x', p_long_description: 'y', p_estimated_time: '3 días', p_required_documents: ['Cédula'], p_icon: 'car', p_points_percentage: 0, p_active: true, p_featured: true, p_image_url: 'https://kltpwbsdcdegrwegxhem.supabase.co/storage/v1/object/public/service-images/1.webp' }));
check('guardar servicio con imagen y 0% de puntos', r.data?.ok, r);
r = await as(db, admin.uid, () => rpc(db, 'admin_save_service', { p_id: 1, p_name: 'X', p_category_id: 1, p_price: 1, p_short_description: '', p_long_description: '', p_estimated_time: '', p_required_documents: [], p_icon: 'car', p_points_percentage: 0, p_active: true, p_featured: false, p_image_url: 'javascript:alert(1)' }));
check('imagen no https rechazada', r.data?.ok === false, r);

console.log('\n== Imágenes de servicios (#32)');
r = await as(db, admin.uid, () => q(db, `insert into storage.objects (bucket_id, name, owner) values ('service-images', '1/123.webp', auth.uid()) returning id`));
check('admin sube una imagen de servicio', r.rows && r.rows.length === 1, r);
r = await as(db, client.uid, () => q(db, `insert into storage.objects (bucket_id, name, owner) values ('service-images', '1/hack.webp', auth.uid()) returning id`));
check('cliente no puede subir imágenes de servicio', !!r.error, r);
r = await as(db, null, () => q(db, `select name from storage.objects where bucket_id = 'service-images'`));
check('cualquiera puede ver las imágenes de servicio', r.rows && r.rows.length === 1, r);

console.log(`\nResultado: ${pass} pruebas OK, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
