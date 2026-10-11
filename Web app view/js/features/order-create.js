// ============================================================
// CREAR ORDEN (H1): todo se calcula y guarda en create_order()
// ============================================================
async function completeCheckout(e) {
  e.preventDefault();
  setError('#checkoutError', '');
  const required = ['#coName', '#coIdCard', '#coPhone', '#coAddress'];
  const missing = required.find(id => !$(id).value.trim());
  if (missing) { setError('#checkoutError', 'Complete su información de contacto.'); $(missing).focus(); return; }
  if (!selectedPaymentAccountId) { setError('#checkoutError', 'Seleccione un método de pago.'); return; }

  const btn = $('#submitOrderBtn');
  setBusy(btn, true, 'Registrando orden...');

  // Actualizar datos de contacto del perfil
  const { error: profileError } = await sb.from('users_profile').update({
    name: $('#coName').value.trim(),
    id_card: $('#coIdCard').value.trim(),
    phone: $('#coPhone').value.trim(),
    address: $('#coAddress').value.trim(),
  }).eq('id', currentProfile.id);
  if (profileError) {
    setBusy(btn, false, 'Confirmar orden');
    setError('#checkoutError', 'No se pudieron guardar sus datos: ' + friendlyError(profileError));
    return;
  }

  const { data, error } = await sb.rpc('create_order', {
    p_items: cart.map(i => ({ service_id: i.id, quantity: i.qty })),
    p_payment_account_id: selectedPaymentAccountId,
    p_coupon_code: appliedCoupon?.code || null,
    p_use_points: !!$('#usePoints')?.checked,
    p_shipping_address: $('#coAddress').value.trim(),
    p_customer_notes: '',
  });
  setBusy(btn, false, 'Confirmar orden');

  if (error || !data?.ok) {
    setError('#checkoutError', data?.error || friendlyError(error));
    // El catálogo pudo cambiar: recargarlo para que el carrito quede al día
    if (/disponible/.test(data?.error || '')) loadCategoriesAndServices().then(renderCheckoutSummary);
    return;
  }

  cart = [];
  saveCart();
  updateCartBadge();
  appliedCoupon = null;
  removeCoupon();
  $('#usePoints').checked = false;
  currentOrder = data.order;
  await checkSession();   // saldo de puntos actualizado
  showConfirmation(currentOrder);
}

function showConfirmation(order) {
  const pa = paymentAccounts.find(p => p.id === order.payment_account_id);
  $('#confirmRef').textContent = order.reference;
  let details = `
    <div class="amount-due">
      <span>Monto a pagar</span>
      <strong class="serif">${fmt(order.total)}</strong>
    </div>`;
  if (pa) {
    details += `<div class="pay-box"><strong class="pay-box-title">${esc(pa.display_name)}</strong><div class="mt-8">${buildPaymentDetails(pa)}</div></div>`;
  }
  $('#confirmPaymentDetails').innerHTML = details;
  const promise = settings.receipt_verification_time;
  $('#verifyPromise').textContent = promise ? ` Lo verificaremos en ${promise}.` : '';
  resetUploadArea();
  go('confirmation');
}
