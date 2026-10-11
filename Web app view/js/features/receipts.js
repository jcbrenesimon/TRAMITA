// ============================================================
// SUBIDA DE COMPROBANTE (#28: clic o arrastrar y soltar)
// Estado, monto y método los fija la base de datos al registrarlo.
// ============================================================
const UPLOAD_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const UPLOAD_OK_ICON = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function resetUploadArea() {
  pendingReceiptFile = null;
  const area = $('#uploadArea');
  area.classList.remove('has-file', 'drag');
  area.innerHTML = `${UPLOAD_ICON}
    <p><strong>Toque para seleccionar</strong> o arrastre un archivo aquí</p>
    <p class="upload-hint">PDF, JPG, PNG, WEBP — máximo 10 MB</p>`;
  $('#receiptFile').value = '';
  $('#receiptRef').value = '';
  const btn = $('#uploadReceiptBtn');
  btn.disabled = true;
  btn.textContent = 'Enviar comprobante';
}

function handleReceiptFile(file) {
  if (!file) return;
  if (!RECEIPT_TYPES.includes(file.type)) { toast('Formato no permitido. Use PDF, JPG, PNG o WEBP.', true); return; }
  if (file.size > RECEIPT_MAX_BYTES) { toast('El archivo supera los 10 MB', true); return; }
  pendingReceiptFile = file;
  const area = $('#uploadArea');
  area.classList.add('has-file');
  area.innerHTML = `${UPLOAD_OK_ICON}
    <p><strong>${esc(file.name)}</strong></p>
    <p class="upload-hint">${Math.max(1, Math.round(file.size / 1024))} KB — Toque para cambiar</p>`;
  $('#uploadReceiptBtn').disabled = false;
}

// Arrastrar y soltar
(function setupDropZone() {
  const area = document.getElementById('uploadArea');
  ['dragenter', 'dragover'].forEach(ev => area.addEventListener(ev, e => {
    e.preventDefault();
    area.classList.add('drag');
  }));
  ['dragleave', 'dragend', 'drop'].forEach(ev => area.addEventListener(ev, e => {
    e.preventDefault();
    area.classList.remove('drag');
  }));
  area.addEventListener('drop', e => handleReceiptFile(e.dataTransfer?.files?.[0]));
})();

async function uploadReceipt() {
  if (!pendingReceiptFile || !currentOrder) return;
  const btn = $('#uploadReceiptBtn');
  setBusy(btn, true, 'Subiendo comprobante...');

  const cleanName = pendingReceiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const path = `${currentProfile.id}/${currentOrder.id}/${Date.now()}_${cleanName}`;

  const { error: upError } = await sb.storage.from('receipts').upload(path, pendingReceiptFile, {
    contentType: pendingReceiptFile.type, upsert: false,
  });
  if (upError) {
    setBusy(btn, false, 'Enviar comprobante');
    toast('Error al subir: ' + friendlyError(upError), true);
    return;
  }

  const { error: insError } = await sb.from('payment_receipts').insert({
    order_id: currentOrder.id,
    uploaded_by: currentProfile.id,
    storage_path: path,
    original_filename: pendingReceiptFile.name.slice(0, 200),
    mime_type: pendingReceiptFile.type,
    file_size: pendingReceiptFile.size,
    payment_method: currentOrder.payment_method || 'sinpe',
    payment_account_id: currentOrder.payment_account_id,
    reference_number: $('#receiptRef').value.trim() || null,
    amount: currentOrder.total,
  });

  if (insError) {
    // No dejar archivos huérfanos en Storage
    await sb.storage.from('receipts').remove([path]);
    setBusy(btn, false, 'Enviar comprobante');
    toast('Error al registrar: ' + friendlyError(insError), true);
    return;
  }

  setBusy(btn, false, '✓ Enviado');
  btn.disabled = true;
  toast('¡Comprobante enviado! Le avisaremos cuando lo verifiquemos.');
  pendingReceiptFile = null;
  setTimeout(() => go('orders'), 1500);
}
