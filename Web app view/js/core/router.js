// ============================================================
// NAVEGACIÓN
// ============================================================
function go(page, param) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $('#page-' + page);
  if (target) target.classList.add('active');
  $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  closeMenu();
  window.scrollTo(0, 0);

  if (page === 'services') renderAllServices();
  if (page === 'service-detail' && param) renderDetail(param);
  if (page === 'cart') renderCart();
  if (page === 'checkout') loadCheckout();
  if (page === 'account') loadAccount();
  if (page === 'orders') loadOrders();
}

function toggleMenu() { $('#mobileMenu').classList.toggle('open'); }
function closeMenu() { $('#mobileMenu').classList.remove('open'); }
window.addEventListener('scroll', () => {
  $('#nav').classList.toggle('nav-scrolled', window.scrollY > 8);
});

