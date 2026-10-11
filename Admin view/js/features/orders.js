// ============ ÓRDENES (búsqueda y paginación en el servidor) ============
const ORDER_FILTERS = [
  ['all', 'Todas'], ['pendiente_de_pago', 'Pendientes'], ['pagado', 'Pagadas'], ['en_proceso', 'En gestión'],
  ['pendiente_de_documentos', 'Falta docs'], ['completado', 'Completadas'], ['entregado', 'Entregadas'], ['cancelado', 'Canceladas'],
];

async function renderOrders() {
  setPageTitle('Órdenes');
  $('#content').innerHTML = `
    <div class="view-intro"><p>Todas las órdenes del sistema.</p></div>
    <form class="search-row" role="search" onsubmit="event.preventDefault();ordersSearch=$('#ordersSearchInput').value.trim();ordersPage=0;loadOrders()">
      <label for="ordersSearchInput" class="sr-only">Buscar órdenes</label>
      <input type="search" id="ordersSearchInput" class="search-input" placeholder="Referencia, cliente, cédula, teléfono o correo" value="${esc(ordersSearch)}">
      <button class="btn btn-outline btn-sm" type="submit">Buscar</button>
      ${ordersSearch ? `<button class="btn btn-ghost btn-sm" type="button" onclick="ordersSearch='';ordersPage=0;$('#globalSearch').value='';renderOrders()">Limpiar</button>` : ''}
    </form>
    <div class="filters" id="ordersFilters" role="toolbar" aria-label="Filtrar órdenes"></div>
    <div id="ordersList">${LOADING}</div>
  `;
  await loadOrders();
}

async function loadOrders() {
  $('#ordersFilters').innerHTML = ORDER_FILTERS.map(([k, label]) =>
    `<button type="button" class="chip ${ordersFilter === k ? 'active' : ''}" aria-pressed="${ordersFilter === k}" onclick="filterOrders('${k}')">${label}</button>`
  ).join('');
  const list = $('#ordersList');
  list.innerHTML = LOADING;

  const { data, error } = await sb.rpc('admin_search_orders', {
    p_search: ordersSearch, p_status: ordersFilter, p_limit: PAGE_SIZE, p_offset: ordersPage * PAGE_SIZE,
  });
  if (currentView !== 'orders') return;
  const err = rpcError(error, data);
  if (err) { list.innerHTML = emptyState('Error', err); return; }
  if (!data.total) {
    list.innerHTML = emptyState('Sin resultados', 'No se encontraron órdenes con los filtros aplicados.');
    return;
  }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head">
        <h3>${data.total} ${data.total === 1 ? 'orden' : 'órdenes'}</h3>
        <span class="meta">Toque una fila para ver el detalle</span>
      </div>
      ${dataTable(
        [{ label: 'Ref.' }, { label: 'Cliente' }, { label: 'Servicios' }, { label: 'Estado' }, { label: 'Pago' }, { label: 'Monto' }, { label: 'Fecha' }],
        data.rows.map(o => {
          const receipts = o.payment_receipts || [];
          const last = receipts[receipts.length - 1];
          const pay = last && o.payment_status === 'pending'
            ? `<span class="badge ${RECEIPT_LABELS[last.status]?.cls}">📄 ${esc(RECEIPT_LABELS[last.status]?.text)}</span>`
            : badge(PAY_LABELS, o.payment_status);
          const svc = (o.order_items || []).map(i => i.service_name + (i.quantity > 1 ? ` ×${i.quantity}` : '')).join(', ');
          return {
            open: ['order', o.id],
            cells: [
              `<span class="mono text-navy">${esc(o.reference)}</span>`,
              `${esc(o.users_profile?.name || '—')}<span class="cell-sub">${esc(o.users_profile?.phone || '')}</span>`,
              `<span class="text-muted truncate" title="${esc(svc)}">${esc(svc)}</span>`,
              badge(ORDER_LABELS, o.order_status),
              pay,
              `<span class="text-navy">${fmt(o.total)}</span>`,
              `<span class="text-muted">${esc(fmtDate(o.created_at))}</span>`,
            ],
          };
        }))}
      ${pager(data.total, ordersPage, 'goOrdersPage')}
    </div>`;
}

function filterOrders(k) { ordersFilter = k; ordersPage = 0; loadOrders(); }
function goOrdersPage(p) { ordersPage = Math.max(0, p); loadOrders(); window.scrollTo(0, 0); }
