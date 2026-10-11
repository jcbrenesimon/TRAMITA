function updateCartBadge() {
  const b = $('#cartBadge');
  b.textContent = cart.length;
  b.classList.toggle('show', cart.length > 0);
}

function updateAuthUI() {
  const authed = !!(currentUser && currentProfile);
  $$('.auth-only').forEach(e => e.style.display = authed ? '' : 'none');
  $$('.guest-only').forEach(e => e.style.display = authed ? 'none' : '');

  if (authed) {
    const displayName = (currentProfile.name || currentProfile.email || 'Usuario').trim();
    const firstName = displayName.split(' ')[0] || displayName;
    const initials = getInitials(displayName);
    const email = currentProfile.email || currentUser.email || '';

    // Desktop: botón redondo con iniciales + nombre corto
    const avatarEl = $('#userAvatar');
    const nameShortEl = $('#userNameShort');
    const nameFullEl = $('#userNameFull');
    const emailShowEl = $('#userEmailShow');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameShortEl) nameShortEl.textContent = firstName;
    if (nameFullEl) nameFullEl.textContent = displayName;
    if (emailShowEl) emailShowEl.textContent = email;

    // Mobile: banner arriba del menú
    const mAvatar = $('#mobileUserAvatar');
    const mName = $('#mobileUserName');
    const mEmail = $('#mobileUserEmail');
    if (mAvatar) mAvatar.textContent = initials;
    if (mName) mName.textContent = displayName;
    if (mEmail) mEmail.textContent = email;
  }
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
  $('#userDropdown')?.classList.toggle('open');
}

function closeUserMenu() {
  $('#userDropdown')?.classList.remove('open');
}

// Cerrar dropdown si se hace click fuera
document.addEventListener('click', (e) => {
  const menu = document.querySelector('.user-menu');
  if (menu && !menu.contains(e.target)) closeUserMenu();
});

