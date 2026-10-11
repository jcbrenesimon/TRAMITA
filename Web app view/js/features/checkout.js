// ============================================================
// CHECKOUT
// ============================================================
async function loadCheckout() {
  if (!cart.length) { go('services'); return; }
  if (!currentUser) {
    $('#checkoutLoginCta').style.display = 'block';
    $('#checkoutForm').style.display = 'none';
    return;
  }
  $('#checkoutLoginCta').style.display = 'none';
  $('#checkoutForm').style.display = 'block';

  // Llenar datos del usuario
  $('#coName').value = currentProfile.name || '';
  $('#coIdCard').value = currentProfile.id_card || '';
  $('#coEmail').value = currentProfile.email || '';
  $('#coPhone').value = currentProfile.phone || '';
  $('#coAddress').value = currentProfile.address || '';

  // Puntos disponibles
  const points = currentProfile.points_balance || 0;
  const pointValue = Number(settings.point_value_crc) || 0;
  if (points > 0 && pointValue > 0) {
    $('#pointsBox').style.display = 'block';
    $('#userPointsDisplay').textContent = points;
    $('#userPointsCRC').textContent = fmt(points * pointValue);
  } else {
    $('#pointsBox').style.display = 'none';
  }

  // Métodos de pago
  renderPaymentMethods();
  renderCheckoutSummary();
}

function renderPaymentMethods() {
  if (!paymentAccounts.length) {
    $('#paymentMethods').innerHTML = '<p style="color:var(--ink-subtle);text-align:center">No hay métodos de pago configurados.</p>';
    return;
  }
  $('#paymentMethods').innerHTML = paymentAccounts.map(pa => {
    const details = buildPaymentDetails(pa);
    return `
      <label class="payment-method ${selectedPaymentAccountId === pa.id ? 'selected' : ''}" onclick="selectPayment(${pa.id})">
        <div class="payment-method-head">
          <input type="radio" name="pm" ${selectedPaymentAccountId === pa.id ? 'checked' : ''}>
          <span class="payment-method-title">${pa.display_name}</span>
          <span class="payment-method-currency">${pa.currency}</span>
        </div>
        <div class="payment-method-details">${details}</div>
      </label>`;
  }).join('');
}

function buildPaymentDetails(pa) {
  let html = '';
  if (pa.bank) html += `<div><strong>Banco:</strong> ${pa.bank}</div>`;
  if (pa.sinpe_number) html += `<div style="margin-top:6px"><strong>SINPE:</strong></div><div class="copy-field"><span>${pa.sinpe_number}</span><button type="button" class="copy-btn" onclick="event.stopPropagation();copyText('${pa.sinpe_number}',this)">Copiar</button></div>`;
  if (pa.iban) html += `<div style="margin-top:6px"><strong>IBAN:</strong></div><div class="copy-field"><span>${pa.iban}</span><button type="button" class="copy-btn" onclick="event.stopPropagation();copyText('${pa.iban}',this)">Copiar</button></div>`;
  if (pa.account_holder) html += `<div style="margin-top:6px"><strong>Titular:</strong> ${pa.account_holder}</div>`;
  if (pa.holder_id) html += `<div><strong>Cédula:</strong> ${pa.holder_id}</div>`;
  if (pa.payment_link_url) html += `<div style="margin-top:10px"><a href="${pa.payment_link_url}" target="_blank" class="btn btn-outline btn-sm">Abrir link de pago →</a></div>`;
  if (pa.instructions) html += `<div style="margin-top:10px;font-style:italic">${pa.instructions}</div>`;
  return html;
}

function selectPayment(id) {
  selectedPaymentAccountId = id;
  renderPaymentMethods();
  renderCheckoutSummary();
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  btn.textContent = '✓ Copiado';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copiar';
    btn.classList.remove('copied');
  }, 2000);
}

