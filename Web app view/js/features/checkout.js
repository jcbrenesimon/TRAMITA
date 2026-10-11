// ============================================================
// CHECKOUT
// ============================================================
async function loadCheckout() {
  if (!cartLines().length) { go('services'); return; }
  setError('#checkoutError', '');
  if (!currentUser) {
    show('#checkoutLoginCta', true);
    show('#checkoutForm', false);
    return;
  }
  show('#checkoutLoginCta', false);
  show('#checkoutForm', true);

  $('#coName').value = currentProfile.name || '';
  $('#coIdCard').value = currentProfile.id_card || '';
  $('#coEmail').value = currentProfile.email || '';
  $('#coPhone').value = currentProfile.phone || '';
  $('#coAddress').value = currentProfile.address || '';

  // Puntos disponibles (solo si el negocio definió el valor del punto)
  const points = currentProfile.points_balance || 0;
  const pointValue = Number(settings.point_value_crc) || 0;
  show('#pointsBox', points > 0 && pointValue > 0);
  $('#userPointsDisplay').textContent = points;
  $('#userPointsCRC').textContent = fmt(Math.floor(points * pointValue));

  // Un cupón aplicado antes puede no valer para el carrito actual
  if (appliedCoupon) await applyCoupon(appliedCoupon.code, { silent: true });

  renderPaymentMethods();
  renderCheckoutSummary();
}

function renderPaymentMethods() {
  if (!paymentAccounts.length) {
    $('#paymentMethods').innerHTML = '<p class="muted center">No hay métodos de pago configurados. Contáctenos para completar su compra.</p>';
    return;
  }
  if (!paymentAccounts.some(p => p.id === selectedPaymentAccountId)) selectedPaymentAccountId = null;
  $('#paymentMethods').innerHTML = paymentAccounts.map(pa => {
    const selected = selectedPaymentAccountId === pa.id;
    return `
      <div class="payment-method ${selected ? 'selected' : ''}">
        <label class="payment-method-head">
          <input type="radio" name="pm" value="${pa.id}" ${selected ? 'checked' : ''} onchange="selectPayment(${pa.id})">
          <span class="payment-method-title">${esc(pa.display_name)}</span>
          <span class="payment-method-currency">${esc(pa.currency)}</span>
        </label>
        <div class="payment-method-details">${buildPaymentDetails(pa)}</div>
      </div>`;
  }).join('');
}

function copyField(label, value) {
  return `<div class="copy-label"><strong>${label}:</strong></div>
    <div class="copy-field"><span>${esc(value)}</span><button type="button" class="copy-btn" data-copy="${esc(value)}">Copiar</button></div>`;
}

function buildPaymentDetails(pa) {
  let html = '';
  if (pa.bank) html += `<div><strong>Banco:</strong> ${esc(pa.bank)}</div>`;
  if (pa.sinpe_number) html += copyField('SINPE', pa.sinpe_number);
  if (pa.iban) html += copyField('IBAN', pa.iban);
  if (pa.account_number) html += copyField('Cuenta', pa.account_number);
  if (pa.account_holder) html += `<div class="mt-6"><strong>Titular:</strong> ${esc(pa.account_holder)}</div>`;
  if (pa.holder_id) html += `<div><strong>Cédula:</strong> ${esc(pa.holder_id)}</div>`;
  const link = safeUrl(pa.payment_link_url);
  if (link) html += `<div class="mt-10"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">Abrir link de pago →</a></div>`;
  if (pa.instructions) html += `<div class="pm-instructions">${esc(pa.instructions)}</div>`;
  return html;
}

function selectPayment(id) {
  selectedPaymentAccountId = id;
  renderPaymentMethods();
  renderCheckoutSummary();
  setError('#checkoutError', '');
}
