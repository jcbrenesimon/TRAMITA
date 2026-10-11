async function openReceiptModal(receiptId) {
  showModal(`<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>`, 'Revisar comprobante');

  const { data: r, error } = await sb.from('payment_receipts')
    .select('*, orders(*, users_profile!orders_user_id_fkey(*), order_items(*)), payment_accounts(display_name, bank)')
    .eq('id', receiptId)
    .single();

  if (error || !r) { toast('Error cargando comprobante', 'error'); closeModal(); return; }

  // Obtener URL firmada del archivo
  const { data: sig } = await sb.storage.from('receipts').createSignedUrl(r.storage_path, 3600);
  const fileUrl = sig?.signedUrl || '';
  const isImage = /\.(jpe?g|png|webp|gif)$/i.test(r.original_filename);
  const isPdf = /\.pdf$/i.test(r.original_filename);

  const client = r.orders?.users_profile;
  const rl = RECEIPT_LABELS[r.status];

  const body = `
    <div style="display:grid;grid-template-columns:1fr;gap:16px">
      <!-- Preview del archivo -->
      <div style="background:var(--cream);border-radius:var(--radius);padding:12px;text-align:center">
        ${isImage ? `<img src="${fileUrl}" alt="Comprobante" style="max-width:100%;max-height:400px;border-radius:var(--radius)">` :
          isPdf ? `<embed src="${fileUrl}" type="application/pdf" style="width:100%;height:500px;border-radius:var(--radius)">` :
          `<p>Archivo: <a href="${fileUrl}" target="_blank" style="color:var(--bronze)">${r.original_filename} ↗</a></p>`}
        <div style="margin-top:10px">
          <a href="${fileUrl}" target="_blank" class="btn btn-ghost btn-sm">Abrir en nueva pestaña ↗</a>
        </div>
      </div>

      <!-- Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="detail-block">
          <div class="title">Orden</div>
          <div class="detail-row"><span class="k">Referencia</span><span class="v mono">${r.orders?.reference}</span></div>
          <div class="detail-row"><span class="k">Total</span><span class="v">${fmt(r.orders?.total)}</span></div>
          <div class="detail-row"><span class="k">Método</span><span class="v">${r.payment_accounts?.display_name || r.payment_method}</span></div>
          ${r.reference_number ? `<div class="detail-row"><span class="k">Ref. pago</span><span class="v mono">${r.reference_number}</span></div>` : ''}
        </div>
        <div class="detail-block">
          <div class="title">Cliente</div>
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${client?.name || '—'}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${client?.id_card || '—'}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${client?.phone || '—'}</span></div>
        </div>
      </div>

      <div class="detail-block">
        <div class="title">Servicios</div>
        ${(r.orders?.order_items || []).map(i => `<div class="detail-row"><span class="k">${i.service_name}</span><span class="v">${fmt(i.service_price)}</span></div>`).join('')}
      </div>

      <div class="detail-block">
        <div class="title">Estado del comprobante</div>
        <div style="margin-top:4px"><span class="badge ${rl.cls}">${rl.text}</span></div>
        ${r.status === 'rechazado' && r.rejection_reason ? `<div style="margin-top:8px;font-size:12.5px;color:var(--danger)">Motivo: ${r.rejection_reason}</div>` : ''}
        ${r.verified_at ? `<div style="margin-top:6px;font-size:11.5px;color:var(--ink-subtle)">Verificado ${fmtDateTime(r.verified_at)}</div>` : ''}
      </div>

      ${r.status === 'pendiente' ? `
        <div class="field">
          <label>Nota (opcional)</label>
          <input type="text" id="receiptNote" placeholder="Ej. Verificado contra estado de cuenta">
        </div>
      ` : ''}
    </div>
  `;

  const footer = r.status === 'pendiente' ? `
    <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="showRejectDialog('${r.id}')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      Rechazar
    </button>
    <button class="btn btn-success" onclick="approveReceipt('${r.id}')">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Aprobar y notificar
    </button>
  ` : `
    <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
  `;

  showModal(body, `Comprobante — ${r.orders?.reference}`, footer);
}

async function approveReceipt(receiptId) {
  const note = $('#receiptNote')?.value?.trim() || '';
  const { data, error } = await sb.rpc('admin_approve_receipt', {
    p_receipt_id: receiptId,
    p_admin_notes: note
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  closeModal();
  toast('✓ Comprobante aprobado', 'success');

  // Si hay teléfono, ofrecer notificación por WhatsApp INMEDIATAMENTE
  // (sin setTimeout para que no se bloquee window.open)
  if (data.user_phone) {
    const firstName = data.user_name?.split(' ')[0] || '';
    const msg = `Hola ${firstName}, confirmamos la recepción de su pago por la orden ${data.order_reference}. Ya iniciamos la gestión. Le estaremos informando el avance. — Tramitá`;
    const phone = String(data.user_phone).replace(/\D/g,'');
    const waPhone = phone.length === 8 ? '506' + phone : phone;
    if (confirm(`✓ Comprobante aprobado\n\n¿Notificar a ${data.user_name} por WhatsApp?\n\nTeléfono: ${data.user_phone}`)) {
      // Abrir WhatsApp inmediatamente (el confirm es síncrono, mantiene el user gesture)
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  } else {
    toast('El cliente no tiene teléfono registrado', 'error');
  }

  if (currentView === 'receipts') loadReceipts();
  else if (currentView === 'dashboard') renderDashboard();
}

function showRejectDialog(receiptId) {
  const body = `
    <p style="margin-bottom:14px;color:var(--ink-muted)">Indique el motivo del rechazo. Este se registrará y el cliente lo verá.</p>
    <div class="field">
      <label>Motivo del rechazo</label>
      <textarea id="rejectReason" rows="4" placeholder="Ej. El monto no coincide con el total de la orden"></textarea>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <button class="chip btn-sm" onclick="$('#rejectReason').value='El monto no coincide con el total de la orden'">Monto incorrecto</button>
      <button class="chip btn-sm" onclick="$('#rejectReason').value='No se puede ver claramente el comprobante'">Imagen ilegible</button>
      <button class="chip btn-sm" onclick="$('#rejectReason').value='La fecha del comprobante no es reciente'">Fecha inválida</button>
    </div>
  `;
  const footer = `
    <button class="btn btn-ghost" onclick="openReceiptModal('${receiptId}')">Volver</button>
    <button class="btn btn-danger" onclick="confirmRejectReceipt('${receiptId}')">Confirmar rechazo</button>
  `;
  showModal(body, 'Rechazar comprobante', footer);
}

async function confirmRejectReceipt(receiptId) {
  const reason = $('#rejectReason')?.value?.trim();
  if (!reason) { toast('Debe indicar el motivo', 'error'); return; }

  const { data, error } = await sb.rpc('admin_reject_receipt', {
    p_receipt_id: receiptId,
    p_rejection_reason: reason
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  closeModal();
  toast('Comprobante rechazado', 'success');
  if (currentView === 'receipts') loadReceipts();
  else if (currentView === 'dashboard') renderDashboard();
}

