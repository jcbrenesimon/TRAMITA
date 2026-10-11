// ============================================================
// NAVEGACIÓN (#25): rutas reales en la URL (#/servicios/slug…)
// El botón Atrás del navegador funciona y los enlaces se pueden compartir.
// ============================================================
const ROUTES = [
  { path: /^\/?$/, page: 'home', title: 'Servicios profesionales de tramitología en Costa Rica' },
  { path: /^\/servicios\/?$/, page: 'services', title: 'Servicios' },
  { path: /^\/servicios\/([\w-]+)\/?$/, page: 'service-detail', title: 'Servicio' },
  { path: /^\/carrito\/?$/, page: 'cart', title: 'Carrito' },
  { path: /^\/pago\/?$/, page: 'checkout', title: 'Pago' },
  { path: /^\/confirmacion\/?$/, page: 'confirmation', title: 'Orden registrada' },
  { path: /^\/ingresar\/?$/, page: 'login', title: 'Iniciar sesión' },
  { path: /^\/registro\/?$/, page: 'register', title: 'Crear cuenta' },
  { path: /^\/recuperar\/?$/, page: 'recover', title: 'Recuperar contraseña' },
  { path: /^\/nueva-contrasena\/?$/, page: 'new-password', title: 'Nueva contraseña' },
  { path: /^\/cuenta\/?$/, page: 'account', title: 'Mi cuenta' },
  { path: /^\/compras\/?$/, page: 'orders', title: 'Mis compras' },
  { path: /^\/contacto\/?$/, page: 'contact', title: 'Contacto' },
  { path: /^\/privacidad\/?$/, page: 'privacy', title: 'Política de privacidad' },
  { path: /^\/terminos\/?$/, page: 'terms', title: 'Términos y condiciones' },
];

const PAGE_PATHS = {
  home: '/', services: '/servicios', cart: '/carrito', checkout: '/pago', confirmation: '/confirmacion',
  login: '/ingresar', register: '/registro', recover: '/recuperar', 'new-password': '/nueva-contrasena',
  account: '/cuenta', orders: '/compras', contact: '/contacto', privacy: '/privacidad', terms: '/terminos',
};

// Páginas que requieren sesión
const AUTH_PAGES = new Set(['account', 'orders', 'confirmation', 'new-password']);

let appReady = null;   // Promise que resuelve cuando ya cargaron los datos

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}

// API usada por los botones: go('services'), go('service-detail', slug)
function go(page, param) {
  const path = page === 'service-detail' ? `/servicios/${param}` : (PAGE_PATHS[page] || '/');
  const target = '#' + path;
  if (location.hash === target) route();
  else location.hash = target;
}

async function route() {
  if (appReady) await appReady;
  const { path, params } = parseHash();
  const match = ROUTES.map(r => ({ r, m: path.match(r.path) })).find(x => x.m);
  let page = match ? match.r.page : 'not-found';
  const param = match?.m[1];

  if (AUTH_PAGES.has(page) && !currentUser) {
    page = 'login';
  }

  closeMenu();
  closeUserMenu();
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $('#page-' + page);
  target.classList.add('active');
  $$('.nav-links a').forEach(a => {
    const active = a.dataset.page === page || (a.dataset.page === 'services' && page === 'service-detail');
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  const title = match?.r.title || 'Página no encontrada';
  document.title = `Tramitá — ${title}`;
  window.scrollTo(0, 0);

  if (page === 'services') renderAllServices();
  if (page === 'service-detail') renderDetail(param);
  if (page === 'cart') renderCart();
  if (page === 'checkout') loadCheckout();
  if (page === 'confirmation') { if (!currentOrder) { go('orders'); return; } }
  if (page === 'login') prepareLogin(params);
  if (page === 'register') prepareRegister();
  if (page === 'account') loadAccount();
  if (page === 'orders') loadOrders();
  if (page === 'privacy' || page === 'terms') renderLegal();

  // Accesibilidad: llevar el foco al título de la página nueva
  const h1 = target.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

window.addEventListener('hashchange', route);
