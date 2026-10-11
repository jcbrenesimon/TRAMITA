// ============ DETALLE DE ORDEN ============
let currentOrderDetail = null;

// Estados que se pueden elegir según el estado actual (la BD valida igual)
function allowedStatuses(o) {
  if (o.order_status === 'cancelado') return [];
  const paidFlow = ['pagado', 'en_revision', 'pendiente_de_documentos', 'en_proceso', 'completado', 'entregado'];
  const next = o.payment_status === 'paid' ? paidFlow : ['pendiente_de_pago'];
  return [...next, 'cancelado'].filter(s => s !== o.order_status);
}

async function openOrderModal(orderId) {
  showModal(LOADING, 'Cargando...');

  const [orderRes, notesRes] = await Promise.all([
    sb.from('orders').select('*, users_profile!orders_user_id_fkey(name, id_card, email, phone, company), order_items(*), payment_receipts(*), payment_accounts(display_name)').eq('id', orderId).single(),
    sb.from('order_notes').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
  ]);
  if (orderRes.error) { toast('Error cargando orden', 'error'); closeModal(); return; }
  const o = orderRes.data;
  currentOrderDetail = o;
  const notes = notesRes.data || [];
  const client = o.users_profile;
  const statuses = allowedStatuses(o);

  const body = `
    <div class="detail-grid">
      <div class="min-w-0">
        <div class="detail-block">
          <div class="title">Cliente</div>
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${esc(client?.name || '—')}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${esc(client?.id_card || '—')}</span></div>
          <div class="detail-row"><span class="k">Correo</span><span class="v">${esc(client?.email || '—')}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${esc(client?.phone || '—')}</span></div>
          ${client?.company ? `<div class="detail-row"><span class="k">Empresa</span><span class="v">${esc(client.company)}</span></div>` : ''}
          ${o.shipping_address ? `<div class="detail-row"><span class="k">Dirección</span><span class="v">${esc(o.shipping_address)}</span></div>` : ''}
        </div>

        <div class="detail-block">
          <div class="title">Servicios</div>
          ${(o.order_items || []).map(i => `<div class="detail-row"><span class="k">${esc(i.service_name)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</span><span class="v">${fmt(i.subtotal ?? i.service_price)}</span></div>`).join('')}
          <div class="detail-row detail-total"><span class="k">Total</span><span class="v">${fmt(o.total)}</span></div>
        </div>

        ${o.payment_receipts?.length ? `
          <div class="detail-block">
            <div class="title">Comprobantes (${o.payment_receipts.length})</div>
            ${o.payment_receipts.map(r => `
              <div class="list-row">
                <div class="min-w-0">
                  <div class="list-row-title">${esc(r.original_filename)}</div>
                  <div class="list-row-sub">${esc(fmtDateTime(r.created_at))}</div>
                </div>
                <div class="list-row-actions">
                  ${badge(RECEIPT_LABELS, r.status)}
                  <button class="btn btn-ghost btn-sm" type="button" onclick="openReceiptModal('${esc(r.id)}')">Ver</button>
                </div>
              </div>`).join('')}
          </div>` : ''}

        <div class="detail-block">
          <div class="title">Bitácora</div>
          <div class="notes-list">
            ${notes.length === 0 ? '<p class="text-muted small">Sin notas aún.</p>' : notes.map(n => `
              <div class="note-item">
                <div class="note-meta">
                  <span><span class="kind">${esc(NOTE_KINDS[n.kind] || n.kind)}</span> · ${esc(n.author_name)}</span>
                  <span>${esc(fmtDateTime(n.created_at))}</span>
                </div>
                <div class="note-content">${esc(n.content)}</div>
              </div>`).join('')}
          </div>
          ${canOperate() ? `
            <div class="note-form">
              <label for="newNote" class="sr-only">Nueva nota</label>
              <input type="text" id="newNote" maxlength="2000" placeholder="Agregar nota..." onkeydown="if(event.key==='Enter'){event.preventDefault();addOrderNote()}">
              <label for="newNoteKind" class="sr-only">Tipo de nota</label>
              <select id="newNoteKind">
                <option value="internal">Interna</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Llamada</option>
                <option value="email">Email</option>
              </select>
              <button class="btn btn-primary btn-sm" type="button" onclick="addOrderNote()">Agregar</button>
            </div>` : ''}
        </div>
      </div>

      <div class="min-w-0">
        <div class="detail-block">
          <div class="title">Orden</div>
          <div class="detail-row"><span class="k">Ref.</span><span class="v mono">${esc(o.reference)}</span></div>
          <div class="detail-row"><span class="k">Creada</span><span class="v">${esc(fmtDateTime(o.created_at))}</span></div>
          ${o.paid_at ? `<div class="detail-row"><span class="k">Pagada</span><span class="v">${esc(fmtDateTime(o.paid_at))}</span></div>` : ''}
          ${o.completed_at ? `<div class="detail-row"><span class="k">Finalizada</span><span class="v">${esc(fmtDateTime(o.completed_at))}</span></div>` : ''}
        </div>
        <div class="detail-block">
          <div class="title">Estado</div>
          <div class="badge-stack">${badge(ORDER_LABELS, o.order_status)} ${badge(PAY_LABELS, o.payment_status)}</div>
          ${canOperate() && statuses.length ? `
            <label for="changeStatus" class="sr-only">Nuevo estado</label>
            <select id="changeStatus" class="select-block">
              <option value="">Cambiar estado...</option>
              ${statuses.map(k => `<option value="${k}">${esc(ORDER_LABELS[k].text)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-block btn-sm" type="button" id="statusBtn" onclick="changeOrderStatus()">Aplicar</button>
            ${o.payment_status !== 'paid' ? '<div class="field-hint">Los estados de gestión se habilitan al aprobar el comprobante.</div>' : ''}
          ` : ''}
        </div>

        <div class="detail-block">
          <div class="title">Pago</div>
          <div class="detail-row"><span class="k">Método</span><span class="v">${esc(o.payment_accounts?.display_name || PAYMENT_METHODS[o.payment_method] || '—')}</span></div>
          <div class="detail-row"><span class="k">Subtotal</span><span class="v">${fmt(o.subtotal)}</span></div>
          ${o.discount_amount > 0 ? `<div class="detail-row"><span class="k">Cupón ${esc(o.coupon_code || '')}</span><span class="v text-success">-${fmt(o.discount_amount)}</span></div>` : ''}
          ${o.points_used > 0 ? `<div class="detail-row"><span class="k">Puntos usados</span><span class="v">${o.points_used} (-${fmt(o.points_discount)})</span></div>` : ''}
          ${o.points_earned > 0 ? `<div class="detail-row"><span class="k">Puntos ganados</span><span class="v text-bronze">+${o.points_earned}</span></div>` : ''}
        </div>

        <button class="btn btn-wa btn-block btn-sm" type="button" onclick="waOrderClient()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          WhatsApp al cliente
        </button>
      </div>
    </div>
  `;

  showModal(body, `Orden ${o.reference}`, '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>');
}

function waOrderClient() {
  const o = currentOrderDetail;
  const first = (o?.users_profile?.name || '').split(' ')[0];
  openWA(o?.users_profile?.phone, `Hola ${first}, le escribimos sobre su orden ${o?.reference}.`);
}

async function changeOrderStatus() {
  const o = currentOrderDetail;
  const newStatus = $('#changeStatus')?.value;
  if (!newStatus) { toast('Seleccione un estado', 'error'); return; }
  if (newStatus === 'cancelado') {
    const paid = o.payment_status === 'paid';
    const ok = confirm(`¿Cancelar la orden ${o.reference}?\n\n` +
      '• Se devuelven al cliente los puntos que usó\n' +
      '• Se libera el cupón, si usó uno\n' +
      (paid ? '• Se revierten los puntos ganados\n• El pago queda como REEMBOLSADO: deberá devolver el dinero\n' : '') +
      '\nEsta acción no se puede deshacer.');
    if (!ok) return;
  }

  const btn = $('#statusBtn');
  setBusy(btn, true, 'Aplicando...');
  const { data, error } = await sb.rpc('admin_update_order_status', { p_order_id: o.id, p_new_status: newStatus, p_note: '' });
  setBusy(btn, false, 'Aplicar');
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }

  toast(data.message || 'Estado actualizado', 'success');
  openOrderModal(o.id);
  if (currentView === 'orders') loadOrders();
}

async function addOrderNote() {
  const content = $('#newNote')?.value?.trim();
  const kind = $('#newNoteKind')?.value || 'internal';
  if (!content) return;

  const { data, error } = await sb.rpc('admin_add_order_note', { p_order_id: currentOrderDetail.id, p_content: content, p_kind: kind });
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }

  toast('Nota agregada', 'success');
  openOrderModal(currentOrderDetail.id);
}
