// ============================================================
// CUPÓN, PUNTOS Y TOTALES
// Lo que se calcula aquí es solo una VISTA PREVIA. El monto real lo
// calcula create_order() en la base de datos con los mismos criterios.
// ============================================================
async function applyCoupon(codeArg, { silent = false } = {}) {
  const code = (typeof codeArg === 'string' ? codeArg : $('#couponCode').value).trim().toUpperCase();
  if (!code) return;
  const btn = $('#couponBtn');
  if (!silent) setBusy(btn, true, '...');
  const { data, error } = await sb.rpc('validate_coupon', { p_code: code, p_subtotal: cartSubtotal() });
  if (!silent) setBusy(btn, false, 'Aplicar');

  if (error || !data?.ok) {
    const wasApplied = !!appliedCoupon;
    removeCoupon();
    if (!silent || wasApplied) toast(data?.error || friendlyError(error), true);
    return;
  }
  appliedCoupon = data;
  show('#couponInput', false);
  const box = $('#couponApplied');
  box.hidden = false;
  box.innerHTML = `
    <div class="coupon-applied">
      <span>✓ Cupón <strong>${esc(data.code)}</strong> aplicado</span>
      <button type="button" onclick="removeCoupon()">Quitar</button>
    </div>`;
  renderCheckoutSummary();
  if (!silent) toast('Cupón aplicado');
}

function removeCoupon() {
  appliedCoupon = null;
  show('#couponInput', true);
  show('#couponApplied', false);
  $('#couponCode').value = '';
  renderCheckoutSummary();
}

function togglePoints() {
  renderCheckoutSummary();
}

function couponDiscountFor(subtotal) {
  if (!appliedCoupon) return 0;
  let d = appliedCoupon.coupon_type === 'percent'
    ? Math.floor(subtotal * appliedCoupon.value / 100)
    : appliedCoupon.value;
  if (appliedCoupon.max_discount && d > appliedCoupon.max_discount) d = appliedCoupon.max_discount;
  return Math.min(Math.max(d, 0), subtotal);
}

function calculateTotals() {
  const lines = cartLines();
  const subtotal = lines.reduce((a, l) => a + l.service.price * l.qty, 0);
  const couponDisc = couponDiscountFor(subtotal);
  const allowCombine = settings.allow_combine_coupon_and_points === true;
  const usePoints = $('#usePoints')?.checked;
  const pointValue = Number(settings.point_value_crc) || 0;
  const balance = currentProfile?.points_balance || 0;

  let pointsUsed = 0;
  let pointsDiscount = 0;
  const pointsBlocked = !!appliedCoupon && !allowCombine;
  if (usePoints && balance > 0 && pointValue > 0 && !pointsBlocked) {
    pointsUsed = Math.min(balance, Math.floor((subtotal - couponDisc) / pointValue));
    pointsDiscount = Math.floor(pointsUsed * pointValue);
  }

  const total = Math.max(0, subtotal - couponDisc - pointsDiscount);
  const pointsEarned = lines.reduce((a, l) => a + servicePoints(l.service, l.qty), 0);
  return { lines, subtotal, couponDisc, pointsUsed, pointsDiscount, total, pointsEarned, pointsBlocked };
}

function renderCheckoutSummary() {
  const t = calculateTotals();
  show('#pointsComboHint', t.pointsBlocked && !!$('#usePoints')?.checked);
  let html = '<h2>Resumen</h2>';
  t.lines.forEach(({ service: s, qty }) => {
    html += `<div class="summary-row"><span>${esc(s.name)}${qty > 1 ? ` × ${qty}` : ''}</span><span>${fmt(s.price * qty)}</span></div>`;
  });
  if (t.couponDisc > 0) {
    html += `<div class="summary-row discount"><span>Cupón ${esc(appliedCoupon.code)}</span><span>-${fmt(t.couponDisc)}</span></div>`;
  }
  if (t.pointsDiscount > 0) {
    html += `<div class="summary-row discount"><span>Puntos (${t.pointsUsed})</span><span>-${fmt(t.pointsDiscount)}</span></div>`;
  }
  html += `<div class="summary-row total"><span>Total</span><span>${fmt(t.total)}</span></div>`;
  if (t.pointsEarned > 0) {
    html += `<div class="summary-row earn"><span>Ganará</span><span>+${t.pointsEarned} pts</span></div>`;
  }
  $('#checkoutSummary').innerHTML = html;
}
