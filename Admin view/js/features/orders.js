// ============ ÓRDENES ============
async function renderOrders() {
  setPageTitle('Órdenes');
  $('#content').innerHTML = `
    <div style="margin-bottom:20px">
      <p style="color:var(--ink-muted)">Todas las órdenes del sistema.</p>
    </div>
    <div style="margin-bottom:14px">
      <input type="text" id="ordersSearchInput" placeholder="Buscar por referencia, cliente, cédula, teléfono..." value="${ordersSearch}"
        style="width:100%;max-width:420px;padding:10px 14px;border:1px solid var(--line);border-radius:var(--radius);background:var(--paper)"
        onkeyup="if(event.key==='Enter'){ordersSearch=this.value;loadOrders()}" />
    </div>
    <div class="filters" id="ordersFilters"></div>
    <div id="ordersList"></div>
  `;
  await loadOrders();
}

async function loadOrders() {
  // Filtros
  const filters = [
    ['all', 'Todas'],
    ['pendiente_de_pago', 'Pendientes'],
    ['pagado', 'Pagadas'],
    ['en_proceso', 'En gestión'],
    ['pendiente_de_documentos', 'Falta docs'],
    ['completado', 'Completadas'],
    ['cancelado', 'Canceladas'],
  ];
  $('#ordersFilters').innerHTML = filters.map(([k,label]) =>
    `<button class="chip ${ordersFilter === k ? 'active' : ''}" onclick="filterOrders('${k}')">${label}</button>`
  ).join('');

  $('#ordersList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';

  let query = sb.from('orders')
    .select('*, users_profile!orders_user_id_fkey(name, phone, email, id_card), order_items(service_name,service_price), payment_receipts(id,status)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (ordersFilter !== 'all') query = query.eq('order_status', ordersFilter);

  const { data, error } = await query;
  if (error) { $('#ordersList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  // Aplicar búsqueda local
  let filtered = data || [];
  if (ordersSearch) {
    const q = ordersSearch.toLowerCase();
    filtered = filtered.filter(o => {
      const up = o.users_profile;
      return o.reference?.toLowerCase().includes(q)
        || up?.name?.toLowerCase().includes(q)
        || up?.id_card?.toLowerCase().includes(q)
        || up?.phone?.toLowerCase().includes(q)
        || up?.email?.toLowerCase().includes(q);
    });
  }

  if (filtered.length === 0) {
    $('#ordersList').innerHTML = `<div class="empty"><h3>Sin resultados</h3><p>No se encontraron órdenes con los filtros aplicados.</p></div>`;
    return;
  }

  $('#ordersList').innerHTML = `
    <div class="data-card">
      <div class="data-head">
        <h3>${filtered.length} órden${filtered.length !== 1 ? 'es' : ''}</h3>
        <span class="meta">Click en una fila para ver detalle</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Ref.</th><th>Cliente</th><th>Servicios</th><th>Estado</th><th>Pago</th><th>Monto</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            ${filtered.map(o => {
              const os = ORDER_LABELS[o.order_status] || {text:o.order_status,cls:'badge-muted'};
              const hasReceipt = o.payment_receipts && o.payment_receipts.length > 0;
              const lastReceipt = hasReceipt ? o.payment_receipts[o.payment_receipts.length-1] : null;
              let payBadge;
              if (lastReceipt) {
                const rl = RECEIPT_LABELS[lastReceipt.status];
                payBadge = `<span class="badge ${rl.cls}">📄 ${rl.text}</span>`;
              } else {
                const pl = PAY_LABELS[o.payment_status];
                payBadge = `<span class="badge ${pl.cls}">${pl.text}</span>`;
              }
              const svc = (o.order_items || []).map(i => i.service_name).join(', ');
              return `
                <tr class="clickable" onclick="openOrderModal('${o.id}')">
                  <td class="mono text-navy">${o.reference}</td>
                  <td>${o.users_profile?.name || '—'}<br><span class="text-muted" style="font-size:11.5px">${o.users_profile?.phone || ''}</span></td>
                  <td class="text-muted" style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${svc}</td>
                  <td><span class="badge ${os.cls}">${os.text}</span></td>
                  <td>${payBadge}</td>
                  <td class="text-navy">${fmt(o.total)}</td>
                  <td class="text-muted">${fmtDate(o.created_at)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterOrders(k) { ordersFilter = k; loadOrders(); }

