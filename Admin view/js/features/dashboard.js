// ============ DASHBOARD ============
async function renderDashboard() {
  setPageTitle('Dashboard');
  const content = $('#content');
  content.innerHTML = LOADING;

  const [kpiRes, recentRes, pendingRes] = await Promise.all([
    sb.rpc('admin_dashboard_kpis'),
    sb.from('orders')
      .select('id, reference, total, order_status, payment_status, created_at, users_profile!orders_user_id_fkey(name)')
      .order('created_at', { ascending: false }).limit(8),
    sb.from('payment_receipts')
      .select('id, created_at, amount, orders(reference, users_profile!orders_user_id_fkey(name))')
      .eq('status', 'pendiente').order('created_at', { ascending: true }).limit(5),
  ]);
  if (currentView !== 'dashboard') return;

  const kpis = kpiRes.data;
  const err = rpcError(kpiRes.error, kpis);
  if (err) { content.innerHTML = emptyState('Error cargando dashboard', err); return; }

  updateReceiptsCount(kpis.pending_receipts);

  const rev = kpis.revenue_this_month || 0;
  const revLast = kpis.revenue_last_month || 0;
  const trendPct = revLast > 0 ? Math.round(((rev - revLast) / revLast) * 100) : 0;
  const pendingReceipts = pendingRes.data || [];
  const recentOrders = recentRes.data || [];

  const kpi = (label, value, hint, cls = '', small = false) => `
    <div class="kpi-card ${cls}">
      <div class="label">${esc(label)}</div>
      <div class="value${small ? ' value-sm' : ''}">${value}</div>
      ${hint}
    </div>`;

  content.innerHTML = `
    <div class="view-intro">
      <h2 class="greeting">Hola, ${esc((currentProfile.name || '').split(' ')[0] || 'Admin')}.</h2>
      <p>Resumen del estado operativo del negocio (hora de Costa Rica).</p>
    </div>

    <div class="kpi-grid">
      ${kpi('Por verificar', esc(kpis.pending_receipts), '<div class="hint">comprobantes pendientes</div>', kpis.pending_receipts > 0 ? 'urgent' : '')}
      ${kpi('Órdenes hoy', esc(kpis.orders_today), `<div class="hint">${esc(kpis.orders_this_month)} este mes</div>`)}
      ${kpi('En gestión', esc(kpis.in_progress), '<div class="hint">trámites activos</div>')}
      ${kpi('Ventas del mes', fmt(rev), revLast > 0 ? `<span class="trend ${trendPct >= 0 ? 'up' : 'down'}">${trendPct >= 0 ? '↑' : '↓'} ${Math.abs(trendPct)}%</span>` : '<div class="hint">sin datos del mes anterior</div>', rev >= revLast && rev > 0 ? 'good' : '')}
    </div>
    <div class="kpi-grid">
      ${kpi('Completados', esc(kpis.completed_this_month), '<div class="hint">este mes</div>', '', true)}
      ${kpi('Pendientes de pago', esc(kpis.pending_payment), '<div class="hint">esperando comprobante</div>', '', true)}
      ${kpi('Clientes activos', esc(kpis.active_users), `<div class="hint">+${esc(kpis.new_users_this_month)} este mes</div>`, '', true)}
      ${kpi('Mes anterior', fmt(revLast), '<div class="hint">ventas</div>', '', true)}
    </div>

    ${pendingReceipts.length ? `
      <div class="section-head">
        <h2>⚡ Requieren su atención</h2>
        <a class="btn btn-ghost btn-sm" href="#receipts">Ver todos →</a>
      </div>
      <div class="data-card">
        ${dataTable(
          [{ label: 'Orden' }, { label: 'Cliente' }, { label: 'Monto' }, { label: 'Subido' }, { label: '', cls: 'text-right' }],
          pendingReceipts.map(r => ({
            open: ['receipt', r.id],
            cells: [
              `<span class="mono text-navy">${esc(r.orders?.reference || '—')}</span>`,
              esc(r.orders?.users_profile?.name || '—'),
              `<span class="text-navy">${fmt(r.amount)}</span>`,
              `<span class="text-muted">${esc(timeAgo(r.created_at))}</span>`,
              `<button class="btn btn-primary btn-sm" type="button" onclick="openReceiptModal('${esc(r.id)}')">Revisar</button>`,
            ],
          })))}
      </div>` : ''}

    <div class="section-head">
      <h2>Actividad reciente</h2>
      <a class="btn btn-ghost btn-sm" href="#orders">Ver todas las órdenes →</a>
    </div>
    <div class="data-card">
      ${recentOrders.length ? dataTable(
        [{ label: 'Orden' }, { label: 'Cliente' }, { label: 'Estado' }, { label: 'Monto' }, { label: 'Fecha' }],
        recentOrders.map(o => ({
          open: ['order', o.id],
          cells: [
            `<span class="mono text-navy">${esc(o.reference)}</span>`,
            esc(o.users_profile?.name || '—'),
            badge(ORDER_LABELS, o.order_status),
            `<span class="text-navy">${fmt(o.total)}</span>`,
            `<span class="text-muted">${esc(fmtDate(o.created_at))}</span>`,
          ],
        }))) : emptyState('Sin órdenes', 'Aún no hay órdenes registradas.')}
    </div>
  `;
}

function updateReceiptsCount(n) {
  const el = $('#countReceipts');
  el.textContent = n;
  el.hidden = !(n > 0);
}
