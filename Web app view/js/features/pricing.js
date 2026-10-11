// Cupón
async function applyCoupon() {
  const code = $('#couponCode').value.trim().toUpperCase();
  if (!code) return;
  const { data, error } = await sb.from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
  if (error || !data) { toast('Cupón no encontrado o inactivo', true); return; }
  const now = new Date();
  if (data.valid_until && new Date(data.valid_until) < now) { toast('Cupón expirado', true); return; }
  if (data.valid_from && new Date(data.valid_from) > now) { toast('Cupón aún no vigente', true); return; }
  if (data.usage_limit && data.usage_count >= data.usage_limit) { toast('Cupón agotado', true); return; }
  const subtotal = cart.reduce((a, b) => a + b.price, 0);
  if (data.min_purchase && subtotal < data.min_purchase) { toast(`Compra mínima de ${fmt(data.min_purchase)}`, true); return; }
  appliedCoupon = data;
  $('#couponInput').style.display = 'none';
  $('#couponApplied').style.display = 'block';
  $('#couponApplied').innerHTML = `
    <div class="coupon-applied">
      <span>✓ Cupón <strong>${data.code}</strong> aplicado</span>
      <button type="button" onclick="removeCoupon()">Quitar</button>
    </div>`;
  renderCheckoutSummary();
  toast('Cupón aplicado');
}

function removeCoupon() {
  appliedCoupon = null;
  $('#couponInput').style.display = 'flex';
  $('#couponApplied').style.display = 'none';
  $('#couponCode').value = '';
  renderCheckoutSummary();
}

function togglePoints() {
  renderCheckoutSummary();
}

function calculateTotals() {
  const subtotal = cart.reduce((a, b) => a + b.price, 0);
  let discount = 0;
  let couponDisc = 0;
  let pointsUsed = 0;
  let pointsDiscount = 0;
  const allowCombine = settings.allow_combine_coupon_and_points === true;
  const usePoints = $('#usePoints')?.checked;
  const pointValue = Number(settings.point_value_crc) || 0;

  if (appliedCoupon) {
    if (appliedCoupon.coupon_type === 'percent') {
      couponDisc = Math.floor(subtotal * appliedCoupon.value / 100);
    } else {
      couponDisc = appliedCoupon.value;
    }
    if (appliedCoupon.max_discount && couponDisc > appliedCoupon.max_discount) {
      couponDisc = appliedCoupon.max_discount;
    }
  }

  if (usePoints && currentProfile?.points_balance > 0 && pointValue > 0) {
    if (!appliedCoupon || allowCombine) {
      const maxPointsByBalance = currentProfile.points_balance;
      const remaining = subtotal - couponDisc;
      const maxPointsByAmount = Math.floor(remaining / pointValue);
      pointsUsed = Math.min(maxPointsByBalance, maxPointsByAmount);
      pointsDiscount = pointsUsed * pointValue;
    }
  }

  discount = couponDisc + pointsDiscount;
  const total = Math.max(0, subtotal - discount);

  // Puntos ganados
  let pointsEarned = 0;
  cart.forEach(item => {
    const service = services.find(s => s.id === item.id);
    if (service && service.points_percentage) {
      pointsEarned += Math.floor(item.price * service.points_percentage / 100);
    }
  });

  return { subtotal, couponDisc, pointsUsed, pointsDiscount, discount, total, pointsEarned };
}

function renderCheckoutSummary() {
  const t = calculateTotals();
  let html = `<h3 class="serif" style="font-size:16px;margin-bottom:12px;color:var(--navy);font-weight:500">Resumen</h3>`;
  cart.forEach(s => {
    html += `<div class="summary-row"><span>${s.name}</span><span>${fmt(s.price)}</span></div>`;
  });
  if (t.couponDisc > 0) {
    html += `<div class="summary-row discount"><span>Cupón ${appliedCoupon.code}</span><span>-${fmt(t.couponDisc)}</span></div>`;
  }
  if (t.pointsDiscount > 0) {
    html += `<div class="summary-row discount"><span>Puntos (${t.pointsUsed})</span><span>-${fmt(t.pointsDiscount)}</span></div>`;
  }
  html += `<div class="summary-row total"><span>Total</span><span>${fmt(t.total)}</span></div>`;
  if (t.pointsEarned > 0) {
    html += `<div class="summary-row" style="color:var(--bronze);font-size:12.5px;padding-top:8px"><span>Ganará</span><span>+${t.pointsEarned} pts</span></div>`;
  }
  $('#checkoutSummary').innerHTML = html;
}

