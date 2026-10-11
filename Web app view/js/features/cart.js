// ============================================================
// CARRITO
// ============================================================
function renderCart() {
  const c = $('#cartContent');
  if (!cart.length) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="ico-lg"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></div>
        <h3>Su carrito está vacío</h3>
        <p>Explore nuestro catálogo y agregue los servicios que necesita.</p>
        <button class="btn btn-primary" onclick="go('services')">Ver servicios</button>
      </div>`;
    return;
  }
  const total = cart.reduce((a, b) => a + b.price, 0);
  c.innerHTML = `
    <div class="cart-list">
      ${cart.map((s, i) => `
        <div class="cart-item">
          <div class="ico">${ICONS[s.icon] || ICONS.doc}</div>
          <div>
            <h4>${s.name}</h4>
            <div class="line">${s.estimated_time || ''}</div>
          </div>
          <div class="actions">
            <div class="price-sm">${fmt(s.price)}</div>
            <button class="remove-btn" onclick="removeFromCart(${i})">Quitar</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="summary">
      <h3>Resumen</h3>
      <div class="summary-row"><span>Subtotal (${cart.length} ${cart.length === 1 ? 'servicio' : 'servicios'})</span><span>${fmt(total)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" onclick="go('checkout')">Continuar al pago</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="go('services')">Seguir explorando</button>`;
}

function removeFromCart(i) {
  cart.splice(i, 1);
  saveCart();
  updateCartBadge();
  renderCart();
  toast('Servicio removido');
}

