// ============================================================
// INICIO
// ============================================================
appReady = (async function init() {
  await checkSession();
  await Promise.all([loadSettings(), loadCategoriesAndServices(), loadPaymentAccounts()]);
  updateCartBadge();
  resetUploadArea();
})();

// Primera pantalla según la URL
route();

// Cambios de sesión (login en otra pestaña, enlaces de correo, expiración)
sb.auth.onAuthStateChange((event, session) => {
  // Diferido para no llamar a Supabase dentro del callback de Auth
  setTimeout(async () => {
    const before = currentUser?.id;
    currentUser = session?.user || null;
    currentProfile = currentUser ? await fetchProfile(currentUser.id) : null;
    updateAuthUI();

    // #15: llegó desde el enlace de "recuperar contraseña"
    if (event === 'PASSWORD_RECOVERY') { go('new-password'); return; }
    // Si se cerró la sesión estando en una página privada, el router lleva al login
    if (event === 'SIGNED_OUT' && before) route();
  }, 0);
});
