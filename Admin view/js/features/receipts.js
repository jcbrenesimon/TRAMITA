// ============ COMPROBANTES ============
let receiptsFilter = 'pendiente';

async function renderReceipts() {
  setPageTitle('Comprobantes');
  $('#content').innerHTML = `
    <div style="margin-bottom:20px">
      <p style="color:var(--ink-muted)">Verifique y apruebe los comprobantes de pago subidos por los clientes.</p>
    </div>
    <div class="filters" id="receiptFilters"></div>
    <div id="receiptsList"></div>
  `;
  await loadReceipts();
}

async function loadReceipts() {
  // Contar por estado
  const counts = { pendiente: 0, aprobado: 0, rechazado: 0 };
  const { data: all } = await sb.from('payment_receipts').select('status');
  if (all) all.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

  $('#receiptFilters').innerHTML = [
    ['pendiente', 'Pendientes'],
    ['aprobado', 'Aprobados'],
    ['rechazado', 'Rechazados'],
    ['all', 'Todos']
  ].map(([k,label]) => {
    const count = k === 'all' ? (counts.pendiente + counts.aprobado + counts.rechazado) : counts[k] || 0;
    return `<button class="chip ${receiptsFilter === k ? 'active' : ''}" onclick="filterReceipts('${k}')">${label}<span class="count">${count}</span></button>`;
  }).join('');

  let query = sb.from('payment_receipts')
    .select('*, orders(id, reference, total, user_id, users_profile!orders_user_id_fkey(name, phone, email, id_card))')
    .order('created_at', { ascending: false })
    .limit(100);

  if (receiptsFilter !== 'all') query = query.eq('status', receiptsFilter);

  const { data, error } = await query;
  if (error) { $('#receiptsList').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    $('#receiptsList').innerHTML = `
      <div class="empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
        <h3>Todo al día</h3>
        <p>No hay comprobantes ${receiptsFilter === 'pendiente' ? 'pendientes por verificar' : 'en esta categoría'}.</p>
      </div>`;
    return;
  }

  $('#receiptsList').innerHTML = `
    <div class="data-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Orden</th><th>Cliente</th><th>Monto</th><th>Método</th><th>Estado</th><th>Subido</th><th></th></tr>
          </thead>
          <tbody>
            ${data.map(r => {
              const rl = RECEIPT_LABELS[r.status];
              return `
                <tr class="clickable" onclick="openReceiptModal('${r.id}')">
                  <td class="mono text-navy">${r.orders?.reference || '—'}</td>
                  <td>${r.orders?.users_profile?.name || '—'}<br><span class="text-muted" style="font-size:12px">${r.orders?.users_profile?.phone || ''}</span></td>
                  <td class="text-navy">${fmt(r.amount)}</td>
                  <td class="text-muted">${r.payment_method || '—'}</td>
                  <td><span class="badge ${rl.cls}">${rl.text}</span></td>
                  <td class="text-muted">${timeAgo(r.created_at)}</td>
                  <td class="text-right"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openReceiptModal('${r.id}')">Revisar</button></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterReceipts(k) { receiptsFilter = k; loadReceipts(); }

