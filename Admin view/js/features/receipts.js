// ============ COMPROBANTES ============
let receiptsFilter = 'pendiente';

async function renderReceipts() {
  setPageTitle('Comprobantes');
  $('#content').innerHTML = `
    <div class="view-intro"><p>Verifique y apruebe los comprobantes de pago subidos por los clientes.</p></div>
    <div class="filters" id="receiptFilters" role="toolbar" aria-label="Filtrar comprobantes"></div>
    <div id="receiptsList">${LOADING}</div>
  `;
  await loadReceipts();
}

async function loadReceipts() {
  const statuses = ['pendiente', 'aprobado', 'rechazado'];
  const counts = await Promise.all(statuses.map(s =>
    sb.from('payment_receipts').select('id', { count: 'exact', head: true }).eq('status', s)));
  const c = Object.fromEntries(statuses.map((s, i) => [s, counts[i].count || 0]));
  updateReceiptsCount(c.pendiente);

  $('#receiptFilters').innerHTML = [
    ['pendiente', 'Pendientes'], ['aprobado', 'Aprobados'], ['rechazado', 'Rechazados'], ['all', 'Todos'],
  ].map(([k, label]) => {
    const count = k === 'all' ? c.pendiente + c.aprobado + c.rechazado : c[k];
    return `<button type="button" class="chip ${receiptsFilter === k ? 'active' : ''}" aria-pressed="${receiptsFilter === k}" onclick="filterReceipts('${k}')">${label}<span class="count">${count}</span></button>`;
  }).join('');

  let query = sb.from('payment_receipts')
    .select('id, status, amount, payment_method, created_at, orders(reference, users_profile!orders_user_id_fkey(name, phone))')
    .order('created_at', { ascending: receiptsFilter === 'pendiente' })
    .limit(100);
  if (receiptsFilter !== 'all') query = query.eq('status', receiptsFilter);

  const { data, error } = await query;
  if (currentView !== 'receipts') return;
  const list = $('#receiptsList');
  if (error) { list.innerHTML = emptyState('Error', friendlyError(error)); return; }
  if (!data.length) {
    list.innerHTML = emptyState('Todo al día',
      `No hay comprobantes ${receiptsFilter === 'pendiente' ? 'pendientes por verificar' : 'en esta categoría'}.`,
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>');
    return;
  }

  list.innerHTML = `
    <div class="data-card">
      ${dataTable(
        [{ label: 'Orden' }, { label: 'Cliente' }, { label: 'Monto' }, { label: 'Método' }, { label: 'Estado' }, { label: 'Subido' }, { label: '', cls: 'text-right' }],
        data.map(r => ({
          open: ['receipt', r.id],
          cells: [
            `<span class="mono text-navy">${esc(r.orders?.reference || '—')}</span>`,
            `${esc(r.orders?.users_profile?.name || '—')}<span class="cell-sub">${esc(r.orders?.users_profile?.phone || '')}</span>`,
            `<span class="text-navy">${fmt(r.amount)}</span>`,
            `<span class="text-muted">${esc(PAYMENT_METHODS[r.payment_method] || r.payment_method || '—')}</span>`,
            badge(RECEIPT_LABELS, r.status),
            `<span class="text-muted">${esc(timeAgo(r.created_at))}</span>`,
            `<button class="btn btn-primary btn-sm" type="button" onclick="openReceiptModal('${esc(r.id)}')">Revisar</button>`,
          ],
        })))}
    </div>`;
}

function filterReceipts(k) { receiptsFilter = k; loadReceipts(); }
