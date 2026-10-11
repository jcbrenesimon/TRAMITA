// ============ NAVEGACIÓN ============
function go(view) {
  currentView = view;
  $$('.sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));

  // Cerrar sidebar en mobile
  if (window.innerWidth < 900) {
    $('#sidebar').classList.remove('open');
  }

  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'receipts': renderReceipts(); break;
    case 'orders': renderOrders(); break;
    case 'users': renderUsers(); break;
    case 'services': renderServices(); break;
    case 'categories': renderCategories(); break;
    case 'payment-accounts': renderPaymentAccounts(); break;
    case 'coupons': renderCoupons(); break;
    case 'settings': renderSettings(); break;
    default: renderDashboard();
  }
}

function toggleSidebar() {
  $('#sidebar').classList.toggle('open');
}

function setPageTitle(t) { $('#pageTitle').textContent = t; }

function handleGlobalSearch(e) {
  if (e.key === 'Enter') {
    const q = $('#globalSearch').value.trim();
    if (q) {
      ordersSearch = q;
      go('orders');
    }
  }
}

