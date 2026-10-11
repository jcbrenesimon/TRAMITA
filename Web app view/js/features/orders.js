// ============================================================
// MIS COMPRAS
// ============================================================
// Estados orientados al cliente (copy claro y accionable)
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

// Estados del pago (sin comprobante / con comprobante pendiente / verificado)
const PAY_LABELS = {
  pending: { text: 'Esperando pago', cls: 'badge-warning' },
  paid: { text: '✓ Pago verificado', cls: 'badge-success' },
  failed: { text: 'Pago rechazado', cls: 'badge-danger' },
  refunded: { text: 'Reembolsado', cls: 'badge-muted' },
  cancelled: { text: 'Cancelado', cls: 'badge-muted' },
};

// Estado del comprobante (reemplaza el PAY_LABELS cuando ya hay comprobante subido)
const RECEIPT_LABELS = {
  pendiente: { text: 'Comprobante en revisión', cls: 'badge-info' },
  aprobado: { text: '✓ Pago verificado', cls: 'badge-success' },
  rechazado: { text: 'Comprobante rechazado', cls: 'badge-danger' },
};

async function loadOrders() {
  if (!currentUser) { go('login'); return; }
  $('#ordersList').innerHTML = '<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>';

  // Cargar órdenes + items + recibos (JOIN en una sola query)
  const { data, error } = await sb.from('orders')
    .select('*, order_items(*), payment_receipts(id, status, created_at, original_filename)')
    .eq('user_id', currentProfile.id)
    .order('created_at', { ascending: false });

  if (error) { $('#ordersList').innerHTML = '<p style="text-align:center;padding:40px;color:var(--ink-muted)">Error cargando órdenes</p>'; return; }

  if (!data.length) {
    $('#ordersList').innerHTML = `
      <div class="empty-state">
        <h3>Aún no tiene compras</h3>
        <p>Cuando realice su primer trámite aparecerá aquí.</p>
        <button class="btn btn-primary" onclick="go('services')">Ver servicios</button>
      </div>`;
    return;
  }

  $('#ordersList').innerHTML = data.map(o => {
    const os = ORDER_LABELS[o.order_status];
    const receipts = o.payment_receipts || [];
    const lastReceipt = receipts.length ? receipts.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;

    // Determinar el estado del pago mostrado al cliente (más claro)
    let paymentBadge;
    if (lastReceipt) {
      const rl = RECEIPT_LABELS[lastReceipt.status];
      paymentBadge = `<span class="badge ${rl.cls}">${rl.text}</span>`;
    } else {
      const pl = PAY_LABELS[o.payment_status];
      paymentBadge = `<span class="badge ${pl.cls}">${pl.text}</span>`;
    }

    const dt = new Date(o.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });

    // Banner de acción según el estado
    let actionBanner = '';
    if (!lastReceipt && o.payment_status === 'pending') {
      actionBanner = `
        <div style="background:var(--warning-bg);padding:10px 14px;border-radius:var(--radius);margin:10px 0;font-size:13px;color:var(--warning);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span>⚠ Aún no ha subido el comprobante de pago</span>
          <button class="btn btn-bronze btn-sm" onclick="resumeOrderUpload('${o.id}')">Subir ahora →</button>
        </div>`;
    } else if (lastReceipt && lastReceipt.status === 'pendiente') {
      actionBanner = `
        <div style="background:var(--info-bg);padding:10px 14px;border-radius:var(--radius);margin:10px 0;font-size:13px;color:var(--info)">
          ℹ Estamos verificando su comprobante. Le avisaremos apenas esté confirmado.
        </div>`;
    } else if (lastReceipt && lastReceipt.status === 'rechazado') {
      actionBanner = `
        <div style="background:var(--danger-bg);padding:10px 14px;border-radius:var(--radius);margin:10px 0;font-size:13px;color:var(--danger);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span>⚠ Comprobante rechazado. Suba uno nuevo.</span>
          <button class="btn btn-bronze btn-sm" onclick="resumeOrderUpload('${o.id}')">Subir nuevo →</button>
        </div>`;
    } else if (o.points_earned > 0 && o.payment_status === 'paid') {
      actionBanner = `
        <div style="background:var(--success-bg);padding:8px 14px;border-radius:var(--radius);margin:10px 0;font-size:12.5px;color:var(--success)">
          ✓ Ganó <strong>${o.points_earned}</strong> puntos con esta compra
        </div>`;
    } else if (o.points_earned > 0 && o.payment_status === 'pending') {
      actionBanner = `
        <div style="background:var(--cream-warm);padding:8px 14px;border-radius:var(--radius);margin:10px 0;font-size:12.5px;color:var(--ink-muted)">
          Ganará <strong>${o.points_earned}</strong> puntos cuando se verifique el pago
        </div>`;
    }

    return `
      <div class="order-card">
        <div class="order-head">
          <div>
            <div class="ref">${o.reference}</div>
            <div class="date">${dt}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="badge ${os.cls}">${os.text}</span>
            ${paymentBadge}
          </div>
        </div>
        <div class="order-items">
          ${o.order_items.map(i => `<div class="order-item-row"><span class="name">${i.service_name}</span><span class="val">${fmt(i.service_price)}</span></div>`).join('')}
        </div>
        ${actionBanner}
        <div class="order-foot">
          <button class="btn btn-ghost btn-sm" onclick="openWA('Hola, quisiera dar seguimiento a mi orden ${o.reference}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
            Seguimiento
          </button>
          <span class="order-total">${fmt(o.total)}</span>
        </div>
      </div>`;
  }).join('');
}

// Permitir al usuario volver a subir comprobante de una orden existente
async function resumeOrderUpload(orderId) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (error || !order) { toast('No se pudo cargar la orden', true); return; }
  currentOrder = order;
  pendingReceiptFile = null;
  // Reiniciar el área de upload
  const area = $('#uploadArea');
  area.classList.remove('has-file');
  area.innerHTML = `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    <p><strong>Toque para seleccionar</strong> o arrastre un archivo aquí</p>
    <p class="upload-hint">PDF, JPG, PNG, WEBP — máximo 10 MB</p>`;
  $('#receiptFile').value = '';
  $('#receiptRef').value = '';
  $('#uploadReceiptBtn').disabled = true;
  showConfirmation(order);
}

