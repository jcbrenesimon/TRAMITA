// ============================================================
// CARRITO (#29 cantidades, #11 precios siempre desde la BD)
// ============================================================
const MAX_QTY = 20;

// Quita del carrito los servicios que ya no están activos
function syncCartWithCatalog() {
  const before = cart.length;
  cart = cart.filter(item => services.some(s => s.id === item.id));
  if (cart.length !== before) {
    saveCart();
    toast('Algunos servicios de su carrito ya no están disponibles y se quitaron.', true);
  }
  updateCartBadge();
}

function cartLines() {
  return cart
    .map(item => ({ ...item, service: services.find(s => s.id === item.id) }))
    .filter(l => l.service);
}

function cartSubtotal() {
  return cartLines().reduce((a, l) => a + l.service.price * l.qty, 0);
}

function addToCart(serviceId) {
  const item = cart.find(i => i.id === serviceId);
  if (item) {
    if (item.qty >= MAX_QTY) { toast(`Máximo ${MAX_QTY} unidades por servicio`, true); return; }
    item.qty += 1;
  } else {
    cart.push({ id: serviceId, qty: 1 });
  }
  saveCart();
  updateCartBadge();
  toast(item ? `Cantidad actualizada (${item.qty})` : 'Servicio agregado al carrito');
}

function setCartQty(serviceId, qty) {
  const item = cart.find(i => i.id === serviceId);
  if (!item) return;
  item.qty = Math.min(MAX_QTY, Math.max(1, qty));
  saveCart();
  updateCartBadge();
  renderCart();
}

function removeFromCart(serviceId) {
  cart = cart.filter(i => i.id !== serviceId);
  saveCart();
  updateCartBadge();
  renderCart();
  toast('Servicio removido');
}

function renderCart() {
  const c = $('#cartContent');
  const lines = cartLines();
  if (!lines.length) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="ico-lg" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></div>
        <h2>Su carrito está vacío</h2>
        <p>Explore nuestro catálogo y agregue los servicios que necesita.</p>
        <a class="btn btn-primary" href="#/servicios">Ver servicios</a>
      </div>`;
    return;
  }
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const total = cartSubtotal();
  c.innerHTML = `
    <ul class="cart-list">
      ${lines.map(({ service: s, qty }) => `
        <li class="cart-item">
          <div class="ico">${serviceIcon(s.icon)}</div>
          <div class="cart-info">
            <h3><a href="#/servicios/${esc(s.slug)}">${esc(s.name)}</a></h3>
            <div class="line">${esc(s.estimated_time || '')}${qty > 1 ? ` · ${fmt(s.price)} c/u` : ''}</div>
          </div>
          <div class="actions">
            <div class="price-sm">${fmt(s.price * qty)}</div>
            <div class="qty" role="group" aria-label="Cantidad de ${esc(s.name)}">
              <button type="button" onclick="setCartQty(${s.id}, ${qty - 1})" ${qty <= 1 ? 'disabled' : ''} aria-label="Quitar una unidad">−</button>
              <span aria-live="polite">${qty}</span>
              <button type="button" onclick="setCartQty(${s.id}, ${qty + 1})" ${qty >= MAX_QTY ? 'disabled' : ''} aria-label="Agregar una unidad">+</button>
            </div>
            <button class="remove-btn" type="button" onclick="removeFromCart(${s.id})">Quitar</button>
          </div>
        </li>`).join('')}
    </ul>
    <div class="summary">
      <h2>Resumen</h2>
      <div class="summary-row"><span>Subtotal (${units} ${units === 1 ? 'servicio' : 'servicios'})</span><span>${fmt(total)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>
    </div>
    <div class="stack mt-16">
      <a class="btn btn-primary btn-block btn-lg" href="#/pago">Continuar al pago</a>
      <a class="btn btn-ghost btn-block" href="#/servicios">Seguir explorando</a>
    </div>`;
}
