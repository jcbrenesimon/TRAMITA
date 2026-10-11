// ============ REVISAR COMPROBANTE ============
let currentReceipt = null;

async function openReceiptModal(receiptId) {
  showModal(LOADING, 'Revisar comprobante');

  const { data: r, error } = await sb.from('payment_receipts')
    .select('*, orders(id, reference, total, order_status, payment_status, users_profile!orders_user_id_fkey(name, id_card, phone, email), order_items(service_name, service_price, quantity, subtotal)), payment_accounts(display_name, bank)')
    .eq('id', receiptId)
    .single();
  if (error || !r) { toast('Error cargando comprobante', 'error'); closeModal(); return; }
  currentReceipt = r;

  const { data: sig } = await sb.storage.from('receipts').createSignedUrl(r.storage_path, 3600);
  const fileUrl = safeUrl(sig?.signedUrl);
  const isImage = /^image\//.test(r.mime_type) || /\.(jpe?g|png|webp)$/i.test(r.original_filename);
  const isPdf = r.mime_type === 'application/pdf' || /\.pdf$/i.test(r.original_filename);
  const client = r.orders?.users_profile;
  const canAct = r.status === 'pendiente' && canOperate();

  let preview;
  if (!fileUrl) preview = '<p class="text-muted">No se pudo cargar el archivo.</p>';
  else if (isImage) preview = `<img src="${esc(fileUrl)}" alt="Comprobante de pago" class="receipt-img">`;
  else if (isPdf) preview = `<embed src="${esc(fileUrl)}" type="application/pdf" class="receipt-pdf">`;
  else preview = `<p>Archivo: ${esc(r.original_filename)}</p>`;

  const body = `
    <div class="stack-16">
      <div class="receipt-preview">
        ${preview}
        ${fileUrl ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm mt-10">Abrir en nueva pestaña ↗</a>` : ''}
      </div>

      <div class="grid-2">
        <div class="detail-block">
          <div class="title">Orden</div>
          <div class="detail-row"><span class="k">Referencia</span><span class="v mono">${esc(r.orders?.reference)}</span></div>
          <div class="detail-row"><span class="k">Total</span><span class="v">${fmt(r.orders?.total)}</span></div>
          <div class="detail-row"><span class="k">Monto registrado</span><span class="v">${fmt(r.amount)}</span></div>
          <div class="detail-row"><span class="k">Método</span><span class="v">${esc(r.payment_accounts?.display_name || PAYMENT_METHODS[r.payment_method] || r.payment_method)}</span></div>
          ${r.reference_number ? `<div class="detail-row"><span class="k">Ref. pago</span><span class="v mono">${esc(r.reference_number)}</span></div>` : ''}
        </div>
        <div class="detail-block">
          <div class="title">Cliente</div>
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${esc(client?.name || '—')}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${esc(client?.id_card || '—')}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${esc(client?.phone || '—')}</span></div>
        </div>
      </div>

      <div class="detail-block">
        <div class="title">Servicios</div>
        ${(r.orders?.order_items || []).map(i => `<div class="detail-row"><span class="k">${esc(i.service_name)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</span><span class="v">${fmt(i.subtotal ?? i.service_price)}</span></div>`).join('')}
      </div>

      <div class="detail-block">
        <div class="title">Estado del comprobante</div>
        <div class="mt-4">${badge(RECEIPT_LABELS, r.status)}</div>
        ${r.status === 'rechazado' && r.rejection_reason ? `<div class="note-danger">Motivo: ${esc(r.rejection_reason)}</div>` : ''}
        ${r.verified_at ? `<div class="note-subtle">Revisado ${esc(fmtDateTime(r.verified_at))}</div>` : ''}
      </div>

      ${canAct ? `
        <div class="field">
          <label for="receiptNote">Nota (opcional)</label>
          <input type="text" id="receiptNote" maxlength="300" placeholder="Ej. Verificado contra estado de cuenta">
        </div>` : ''}
    </div>
  `;

  const footer = canAct ? `
    <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" type="button" onclick="showRejectDialog()">Rechazar</button>
    <button class="btn btn-success" type="button" id="approveBtn" onclick="approveReceipt()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Aprobar y notificar
    </button>
  ` : '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>';

  showModal(body, `Comprobante — ${r.orders?.reference || ''}`, footer);
}

async function approveReceipt() {
  const r = currentReceipt;
  if (!r) return;
  const note = $('#receiptNote')?.value?.trim() || '';
  const btn = $('#approveBtn');
  setBusy(btn, true, 'Aprobando...');
  const { data, error } = await sb.rpc('admin_approve_receipt', { p_receipt_id: r.id, p_admin_notes: note });
  setBusy(btn, false, 'Aprobar y notificar');
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }

  closeModal();
  toast('✓ Comprobante aprobado', 'success');

  // #30: aviso automático por correo (Edge Function opcional; si no está
  // desplegada simplemente no hace nada)
  sb.functions.invoke('notify-payment-approved', { body: { order_id: data.order_id } }).then(() => {}, () => {});

  // WhatsApp: confirm() es síncrono y conserva el gesto del usuario
  if (data.user_phone) {
    const firstName = data.user_name?.split(' ')[0] || '';
    const msg = `Hola ${firstName}, confirmamos la recepción de su pago por la orden ${data.order_reference}. Ya iniciamos la gestión. Le estaremos informando el avance. — Tramitá`;
    if (confirm(`✓ Comprobante aprobado\n\n¿Notificar a ${data.user_name} por WhatsApp?\n\nTeléfono: ${data.user_phone}`)) {
      openWA(data.user_phone, msg);
    }
  } else {
    toast('Aprobado. El cliente no tiene teléfono registrado.', 'error');
  }

  if (currentView === 'receipts') loadReceipts();
  else if (currentView === 'dashboard') renderDashboard();
}

function showRejectDialog() {
  const reasons = [
    ['Monto incorrecto', 'El monto no coincide con el total de la orden'],
    ['Imagen ilegible', 'No se puede ver claramente el comprobante'],
    ['Fecha inválida', 'La fecha del comprobante no es reciente'],
    ['No recibido', 'El pago no aparece reflejado en nuestra cuenta'],
  ];
  const body = `
    <p class="text-muted mb-14">Indique el motivo del rechazo. Se registrará y el cliente lo verá en "Mis compras".</p>
    <div class="field">
      <label for="rejectReason">Motivo del rechazo</label>
      <textarea id="rejectReason" rows="4" maxlength="500" placeholder="Ej. El monto no coincide con el total de la orden"></textarea>
    </div>
    <div class="chip-row">
      ${reasons.map(([label, text]) => `<button type="button" class="chip" data-reason="${esc(text)}">${esc(label)}</button>`).join('')}
    </div>
  `;
  const footer = `
    <button class="btn btn-ghost" type="button" onclick="openReceiptModal('${esc(currentReceipt.id)}')">Volver</button>
    <button class="btn btn-danger" type="button" id="rejectBtn" onclick="confirmRejectReceipt()">Confirmar rechazo</button>
  `;
  showModal(body, 'Rechazar comprobante', footer);
  $$('[data-reason]').forEach(b => b.addEventListener('click', () => { $('#rejectReason').value = b.dataset.reason; }));
}

async function confirmRejectReceipt() {
  const reason = $('#rejectReason')?.value?.trim();
  if (!reason) { toast('Debe indicar el motivo', 'error'); return; }
  const btn = $('#rejectBtn');
  setBusy(btn, true, 'Rechazando...');
  const { data, error } = await sb.rpc('admin_reject_receipt', { p_receipt_id: currentReceipt.id, p_rejection_reason: reason });
  setBusy(btn, false, 'Confirmar rechazo');
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }

  closeModal();
  toast('Comprobante rechazado', 'success');
  if (currentView === 'receipts') loadReceipts();
  else if (currentView === 'dashboard') renderDashboard();
}
