// ============ DASHBOARD ============
async function renderDashboard() {
  setPageTitle('Dashboard');
  $('#content').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span> Cargando métricas...</div>';

  // Cargar KPIs via RPC
  const { data: kpis, error } = await sb.rpc('admin_dashboard_kpis');
  if (error) {
    $('#content').innerHTML = `<div class="empty"><h3>Error cargando dashboard</h3><p>${error.message}</p></div>`;
    return;
  }

  // Cargar últimas órdenes
  const { data: recentOrders } = await sb.from('orders')
    .select('id, reference, total, order_status, payment_status, created_at, user_id, users_profile!orders_user_id_fkey(name,phone)')
    .order('created_at', { ascending: false })
    .limit(8);

  // Cargar comprobantes pendientes
  const { data: pendingReceipts } = await sb.from('payment_receipts')
    .select('id, created_at, amount, order_id, orders(reference,total,user_id,users_profile!orders_user_id_fkey(name,phone))')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(5);

  // Actualizar contador en sidebar
  const countEl = $('#countReceipts');
  if (kpis.pending_receipts > 0) {
    countEl.textContent = kpis.pending_receipts;
    countEl.style.display = 'inline-block';
  }

  // Calcular tendencia de revenue
  const rev = kpis.revenue_this_month || 0;
  const revLast = kpis.revenue_last_month || 0;
  const trendPct = revLast > 0 ? Math.round(((rev - revLast) / revLast) * 100) : 0;
  const trendClass = trendPct >= 0 ? 'up' : 'down';
  const trendArrow = trendPct >= 0 ? '↑' : '↓';

  $('#content').innerHTML = `
    <div style="margin-bottom:24px">
      <h2 class="serif" style="font-size:28px;color:var(--navy);font-weight:400;margin-bottom:4px">Hola, ${currentProfile.name?.split(' ')[0] || 'Admin'}.</h2>
      <p style="color:var(--ink-muted)">Resumen del estado operativo del negocio.</p>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card ${kpis.pending_receipts > 0 ? 'urgent' : ''}">
        <div class="label">Por verificar</div>
        <div class="value">${kpis.pending_receipts}</div>
        <div class="hint">comprobantes pendientes</div>
      </div>
      <div class="kpi-card">
        <div class="label">Órdenes hoy</div>
        <div class="value">${kpis.orders_today}</div>
        <div class="hint">${kpis.orders_this_month} este mes</div>
      </div>
      <div class="kpi-card">
        <div class="label">En gestión</div>
        <div class="value">${kpis.in_progress}</div>
        <div class="hint">trámites activos</div>
      </div>
      <div class="kpi-card ${rev >= revLast ? 'good' : ''}">
        <div class="label">Ventas del mes</div>
        <div class="value">${fmt(rev)}</div>
        ${revLast > 0 ? `<span class="trend ${trendClass}">${trendArrow} ${Math.abs(trendPct)}%</span>` : '<div class="hint">primer mes</div>'}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Completados</div>
        <div class="value" style="font-size:24px">${kpis.completed_this_month}</div>
        <div class="hint">este mes</div>
      </div>
      <div class="kpi-card">
        <div class="label">Pendientes de pago</div>
        <div class="value" style="font-size:24px">${kpis.pending_payment}</div>
        <div class="hint">esperando comprobante</div>
      </div>
      <div class="kpi-card">
        <div class="label">Clientes activos</div>
        <div class="value" style="font-size:24px">${kpis.active_users}</div>
        <div class="hint">+${kpis.new_users_this_month} este mes</div>
      </div>
      <div class="kpi-card">
        <div class="label">Mes anterior</div>
        <div class="value" style="font-size:24px">${fmt(revLast)}</div>
        <div class="hint">ventas</div>
      </div>
    </div>

    ${pendingReceipts && pendingReceipts.length > 0 ? `
      <div class="section-head">
        <h2>⚡ Requieren su atención</h2>
        <button class="btn btn-ghost btn-sm" onclick="go('receipts')">Ver todos →</button>
      </div>
      <div class="data-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Orden</th><th>Cliente</th><th>Monto</th><th>Subido hace</th><th></th></tr>
            </thead>
            <tbody>
              ${pendingReceipts.map(r => {
                const ago = timeAgo(r.created_at);
                const client = r.orders?.users_profile?.name || '—';
                return `
                  <tr class="clickable" onclick="openReceiptModal('${r.id}')">
                    <td class="mono text-navy">${r.orders?.reference || '—'}</td>
                    <td>${client}</td>
                    <td class="text-navy">${fmt(r.amount)}</td>
                    <td class="text-muted">${ago}</td>
                    <td class="text-right"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openReceiptModal('${r.id}')">Revisar</button></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div class="section-head">
      <h2>Actividad reciente</h2>
      <button class="btn btn-ghost btn-sm" onclick="go('orders')">Ver todas las órdenes →</button>
    </div>
    <div class="data-card">
      ${recentOrders && recentOrders.length > 0 ? `
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Orden</th><th>Cliente</th><th>Estado</th><th>Monto</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              ${recentOrders.map(o => {
                const os = ORDER_LABELS[o.order_status] || {text:o.order_status,cls:'badge-muted'};
                return `
                  <tr class="clickable" onclick="openOrderModal('${o.id}')">
                    <td class="mono text-navy">${o.reference}</td>
                    <td>${o.users_profile?.name || '—'}</td>
                    <td><span class="badge ${os.cls}">${os.text}</span></td>
                    <td class="text-navy">${fmt(o.total)}</td>
                    <td class="text-muted">${fmtDate(o.created_at)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="empty"><p>Aún no hay órdenes registradas.</p></div>'}
    </div>
  `;
}

