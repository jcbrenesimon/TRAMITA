// ============================================================
// ESTADO GLOBAL
// ============================================================
let currentUser = null;
let currentProfile = null;
let settings = {};
let categories = [];
let services = [];
let paymentAccounts = [];
let currentService = null;
let currentCat = 'all';
let selectedPaymentAccountId = null;
let appliedCoupon = null;      // respuesta de validate_coupon()
let pendingReceiptFile = null;
let currentOrder = null;

// Carrito: [{ id, qty }]. Precio, nombre y puntos se leen siempre de
// `services` (base de datos), nunca de lo guardado en el navegador.
let cart = loadCart();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem('tramita_cart') || '[]');
    if (!Array.isArray(raw)) return [];
    // Migra el formato anterior (un objeto de servicio por unidad)
    const byId = new Map();
    raw.forEach(item => {
      const id = parseInt(item?.id);
      if (!id) return;
      const qty = Math.max(1, parseInt(item.qty) || 1);
      byId.set(id, Math.min(20, (byId.get(id) || 0) + qty));
    });
    return [...byId].map(([id, qty]) => ({ id, qty }));
  } catch {
    return [];
  }
}
