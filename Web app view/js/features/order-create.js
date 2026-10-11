async function completeCheckout(e) {
  e.preventDefault();
  if (!selectedPaymentAccountId) { toast('Seleccione un método de pago', true); return; }
  const btn = $('#submitOrderBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Registrando orden...';

  // Actualizar perfil con datos del checkout
  await sb.from('users_profile').update({
    name: $('#coName').value.trim(),
    id_card: $('#coIdCard').value.trim(),
    phone: $('#coPhone').value.trim(),
    address: $('#coAddress').value.trim(),
  }).eq('id', currentProfile.id);

  const t = calculateTotals();

  // Generar referencia
  const { data: refData, error: refError } = await sb.rpc('generate_order_reference');
  if (refError) {
    btn.disabled = false; btn.textContent = 'Confirmar orden';
    toast('Error generando referencia: ' + refError.message, true);
    return;
  }
  const reference = refData;

  // Crear orden
  const orderPayload = {
    reference,
    user_id: currentProfile.id,
    order_status: 'pendiente_de_pago',
    payment_status: 'pending',
    payment_method: paymentAccounts.find(p => p.id === selectedPaymentAccountId).payment_method,
    payment_account_id: selectedPaymentAccountId,
    subtotal: t.subtotal,
    discount_amount: t.couponDisc,
    points_used: t.pointsUsed,
    points_discount: t.pointsDiscount,
    points_earned: t.pointsEarned,
    total: t.total,
    coupon_id: appliedCoupon?.id || null,
    coupon_code: appliedCoupon?.code || null,
    shipping_address: $('#coAddress').value.trim(),
  };

  const { data: order, error: orderError } = await sb.from('orders').insert(orderPayload).select().single();
  if (orderError) {
    btn.disabled = false; btn.textContent = 'Confirmar orden';
    toast('Error creando orden: ' + orderError.message, true);
    return;
  }

  // Crear items
  const items = cart.map(item => ({
    order_id: order.id,
    service_id: item.id,
    service_name: item.name,
    service_price: item.price,
    quantity: 1,
    subtotal: item.price,
    points_earned: Math.floor(item.price * (item.points_percentage || 0) / 100),
  }));
  await sb.from('order_items').insert(items);

  // Todo OK
  cart = [];
  saveCart();
  updateCartBadge();
  appliedCoupon = null;
  currentOrder = order;

  btn.disabled = false;
  btn.textContent = 'Confirmar orden';
  showConfirmation(order);
}

function showConfirmation(order) {
  const pa = paymentAccounts.find(p => p.id === order.payment_account_id);
  $('#confirmRef').textContent = order.reference;
  let details = `
    <div style="background:var(--navy);color:var(--cream);padding:14px 18px;border-radius:var(--radius);margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;opacity:.8">Monto a pagar</span>
      <strong class="serif" style="font-size:26px;letter-spacing:-0.02em">${fmt(order.total)}</strong>
    </div>`;
  if (pa) {
    details += `<div style="padding:14px;background:var(--cream-warm);border-radius:var(--radius)"><strong style="color:var(--navy);font-size:15px">${pa.display_name}</strong><div style="margin-top:8px">${buildPaymentDetails(pa)}</div></div>`;
  }
  $('#confirmPaymentDetails').innerHTML = details;
  go('confirmation');
}

