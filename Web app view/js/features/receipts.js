// ============================================================
// SUBIDA DE COMPROBANTE
// ============================================================
function handleReceiptFile() {
  const file = $('#receiptFile').files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('El archivo supera los 10 MB', true); return; }
  pendingReceiptFile = file;
  const area = $('#uploadArea');
  area.classList.add('has-file');
  area.innerHTML = `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
    <p><strong>${file.name}</strong></p>
    <p class="upload-hint">${(file.size / 1024).toFixed(0)} KB — Toque para cambiar</p>`;
  $('#uploadReceiptBtn').disabled = false;
}

async function uploadReceipt() {
  if (!pendingReceiptFile || !currentOrder) return;
  const btn = $('#uploadReceiptBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Subiendo comprobante...';

  const ts = Date.now();
  const cleanName = pendingReceiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${currentProfile.id}/${currentOrder.id}/${ts}_${cleanName}`;

  const { error: upError } = await sb.storage.from('receipts').upload(path, pendingReceiptFile);
  if (upError) {
    btn.disabled = false;
    btn.textContent = 'Enviar comprobante';
    toast('Error al subir: ' + upError.message, true);
    return;
  }

  const { error: insError } = await sb.from('payment_receipts').insert({
    order_id: currentOrder.id,
    uploaded_by: currentProfile.id,
    storage_path: path,
    original_filename: pendingReceiptFile.name,
    mime_type: pendingReceiptFile.type,
    file_size: pendingReceiptFile.size,
    payment_method: currentOrder.payment_method,
    payment_account_id: currentOrder.payment_account_id,
    reference_number: $('#receiptRef').value.trim() || null,
    amount: currentOrder.total,
    status: 'pendiente',
  });

  if (insError) {
    btn.disabled = false;
    btn.textContent = 'Enviar comprobante';
    toast('Error al registrar: ' + insError.message, true);
    return;
  }

  btn.textContent = '✓ Enviado';
  toast('¡Comprobante enviado! Le avisaremos cuando lo verifiquemos.');
  pendingReceiptFile = null;
  setTimeout(() => go('orders'), 1800);
}

