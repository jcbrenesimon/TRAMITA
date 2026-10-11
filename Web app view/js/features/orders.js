// ============================================================
// MIS COMPRAS
// ============================================================
const ORDER_LABELS = {
  pendiente: { text: 'Orden creada', cls: 'badge-muted' },
  pendiente_de_pago: { text: 'Pendiente de pago', cls: 'badge-warning' },
  pagado: { text: 'Pago verificado', cls: 'badge-info' },
  pendiente_de_documentos: { text: 'Falta documentación', cls: 'badge-warning' },
  en_revision: { text: 'En revisión', cls: 'badge-info' },
  en_proceso: { text: 'En gestión', cls: 'badge-info' },
  completado: { text: 'Completado', cls: 'badge-success' },
  entregado: { text: 'Entregado', cls: 'badge-success' },
  cancelado: { text: 'Cancelado', cls: 'badge-danger' },
};

const PAY_LABELS = {
  pending: { text: 'Esperando pago', cls: 'badge-warning' },
  paid: { text: '✓ Pago verificado', cls: 'badge-success' },
  failed: { text: 'Pago rechazado', cls: 'badge-danger' },
  refunded: { text: 'Reembolsado', cls: 'badge-muted' },
  cancelled: { text: 'Cancelado', cls: 'badge-muted' },
};

const RECEIPT_LABELS = {
  pendiente: { text: 'Comprobante en revisión', cls: 'badge-info' },
  aprobado: { text: '✓ Pago verificado', cls: 'badge-success' },
  rechazado: { text: 'Comprobante rechazado', cls: 'badge-danger' },
};

const badge = l => `<span class="badge ${l.cls}">${esc(l.text)}</span>`;

function orderBanner(o, lastReceipt) {
  const pending = o.payment_status === 'pending' && o.order_status !== 'cancelado';
  if (pending && !lastReceipt) {
    return `<div class="banner banner-warning banner-action">
      <span>⚠ Aún no ha subido el comprobante de pago</span>
      <button class="btn btn-bronze btn-sm" type="button" onclick="resumeOrderUpload('${esc(o.id)}')">Subir ahora →</button></div>`;
  }
  if (lastReceipt?.status === 'pendiente') {
    return `<div class="banner banner-info">ℹ Estamos verificando su comprobante. Le avisaremos apenas esté confirmado.</div>`;
  }
  if (pending && lastReceipt?.status === 'rechazado') {
    return `<div class="banner banner-danger banner-action">
      <span>⚠ Comprobante rechazado${lastReceipt.rejection_reason ? ': ' + esc(lastReceipt.rejection_reason) : ''}. Suba uno nuevo.</span>
      <button class="btn btn-bronze btn-sm" type="button" onclick="resumeOrderUpload('${esc(o.id)}')">Subir nuevo →</button></div>`;
  }
  if (o.payment_status === 'refunded') {
    return `<div class="banner banner-muted">La orden fue cancelada. Coordinaremos con usted la devolución del pago.</div>`;
  }
  if (o.points_earned > 0 && o.payment_status === 'paid') {
    return `<div class="banner banner-success banner-sm">✓ Ganó <strong>${o.points_earned}</strong> puntos con esta compra</div>`;
  }
  if (o.points_earned > 0 && pending) {
    return `<div class="banner banner-muted banner-sm">Ganará <strong>${o.points_earned}</strong> puntos cuando se verifique el pago</div>`;
  }
  return '';
}

async function loadOrders() {
  if (!currentUser) { go('login'); return; }
  const list = $('#ordersList');
  list.innerHTML = '<div class="page-loading"><span class="spinner spinner-dark" aria-hidden="true"></span></div>';

  const { data, error } = await sb.from('orders')
    .select('*, order_items(*), payment_receipts(id, status, created_at, original_filename, rejection_reason)')
    .eq('user_id', currentProfile.id)
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = '<p class="grid-empty">Error cargando órdenes. Intente de nuevo.</p>'; return; }

  if (!data.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h2>Aún no tiene compras</h2>
        <p>Cuando realice su primer trámite aparecerá aquí.</p>
        <a class="btn btn-primary" href="#/servicios">Ver servicios</a>
      </div>`;
    return;
  }

  list.innerHTML = data.map(o => {
    const receipts = (o.payment_receipts || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastReceipt = receipts[0] || null;
    const os = ORDER_LABELS[o.order_status] || { text: o.order_status, cls: 'badge-muted' };
    const payLabel = lastReceipt && o.payment_status === 'pending'
      ? RECEIPT_LABELS[lastReceipt.status]
      : PAY_LABELS[o.payment_status];
    const dt = new Date(o.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <article class="order-card">
        <div class="order-head">
          <div>
            <div class="ref">${esc(o.reference)}</div>
            <div class="date">${esc(dt)}</div>
          </div>
          <div class="order-badges">${badge(os)}${payLabel ? badge(payLabel) : ''}</div>
        </div>
        <div class="order-items">
          ${(o.order_items || []).map(i => `<div class="order-item-row"><span class="name">${esc(i.service_name)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</span><span class="val">${fmt(i.subtotal ?? i.service_price)}</span></div>`).join('')}
        </div>
        ${orderBanner(o, lastReceipt)}
        <div class="order-foot">
          <button class="btn btn-ghost btn-sm wa-only" type="button" onclick="openWA('Hola, quisiera dar seguimiento a mi orden ' + ${esc(JSON.stringify(o.reference))})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
            Seguimiento
          </button>
          <span class="order-total">${fmt(o.total)}</span>
        </div>
      </article>`;
  }).join('');
}

// Volver a subir el comprobante de una orden existente
async function resumeOrderUpload(orderId) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (error || !order) { toast('No se pudo cargar la orden', true); return; }
  currentOrder = order;
  showConfirmation(order);
}
