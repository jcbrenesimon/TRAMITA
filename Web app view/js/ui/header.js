// ============================================================
// ENCABEZADO: carrito, sesión y menús
// ============================================================
function cartCount() {
  return cart.reduce((a, item) => a + item.qty, 0);
}

function updateCartBadge() {
  const b = $('#cartBadge');
  const n = cartCount();
  b.textContent = n;
  b.classList.toggle('show', n > 0);
  b.closest('a')?.setAttribute('aria-label', n ? `Carrito, ${n} servicio${n === 1 ? '' : 's'}` : 'Carrito');
}

function updateAuthUI() {
  const authed = !!(currentUser && currentProfile);
  document.body.classList.toggle('is-authed', authed);
  if (!authed) return;

  const displayName = (currentProfile.name || currentProfile.email || 'Usuario').trim();
  const firstName = displayName.split(' ')[0] || displayName;
  const initials = getInitials(displayName);
  const email = currentProfile.email || currentUser.email || '';

  $('#userAvatar').textContent = initials;
  $('#userNameShort').textContent = firstName;
  $('#userNameFull').textContent = displayName;
  $('#userEmailShow').textContent = email;
  $('#mobileUserAvatar').textContent = initials;
  $('#mobileUserName').textContent = displayName;
  $('#mobileUserEmail').textContent = email;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function toggleUserMenu(e) {
  if (e) e.stopPropagation();
  const open = $('#userDropdown').classList.toggle('open');
  $('#userMenuBtn').setAttribute('aria-expanded', String(open));
}

function closeUserMenu() {
  $('#userDropdown')?.classList.remove('open');
  $('#userMenuBtn')?.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const menu = $('#mobileMenu');
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open);
  menu.setAttribute('aria-hidden', String(!open));
  $('#menuBtn').setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open);
}

function closeMenu() {
  const menu = $('#mobileMenu');
  if (!menu.classList.contains('open')) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('no-scroll');
}

// Cerrar menús con clic fuera o con Escape
document.addEventListener('click', e => {
  const menu = document.querySelector('.user-menu');
  if (menu && !menu.contains(e.target)) closeUserMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeUserMenu(); closeMenu(); }
});

window.addEventListener('scroll', () => {
  $('#nav').classList.toggle('nav-scrolled', window.scrollY > 8);
}, { passive: true });
