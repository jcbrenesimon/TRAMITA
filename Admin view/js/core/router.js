// ============ NAVEGACIÓN ============
// La vista actual vive en la URL (#orders, #users…): recargar no pierde la vista.
const VIEWS = {
  dashboard: () => renderDashboard(),
  receipts: () => renderReceipts(),
  orders: () => renderOrders(),
  users: () => renderUsers(),
  services: () => renderServices(),
  categories: () => renderCategories(),
  'payment-accounts': () => renderPaymentAccounts(),
  coupons: () => renderCoupons(),
  settings: () => renderSettings(),
  errors: () => renderErrors(),
};

function go(view) {
  const target = '#' + view;
  if (location.hash === target) routeFromHash();
  else location.hash = target;
}

function routeFromHash() {
  if (!$('#app').classList.contains('active')) return;
  const view = location.hash.replace('#', '') || 'dashboard';
  currentView = VIEWS[view] ? view : 'dashboard';
  $$('.sidebar-nav a').forEach(a => {
    const active = a.dataset.view === currentView;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  closeSidebar();
  closeModal();
  window.scrollTo(0, 0);
  VIEWS[currentView]();
}

window.addEventListener('hashchange', routeFromHash);

function openSidebar() {
  $('#app').classList.add('sidebar-open');
  $('#menuToggle').setAttribute('aria-expanded', 'true');
  document.body.classList.add('no-scroll');
  $('#sidebar a.active, #sidebar a')?.focus({ preventScroll: true });
}

function closeSidebar() {
  if (!$('#app').classList.contains('sidebar-open')) return;
  $('#app').classList.remove('sidebar-open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('no-scroll');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#app').classList.contains('sidebar-open')) closeSidebar();
});

function setPageTitle(t) {
  $('#pageTitle').textContent = t;
  document.title = `${t} — Tramitá Admin`;
}

function handleGlobalSearch(e) {
  e.preventDefault();
  const q = $('#globalSearch').value.trim();
  ordersSearch = q;
  ordersFilter = 'all';
  ordersPage = 0;
  if (currentView === 'orders') renderOrders(); else go('orders');
}
