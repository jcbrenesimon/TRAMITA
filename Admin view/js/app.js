// ============ INICIO ============
(async function init() {
  $('#publicAppLink').href = PUBLIC_APP_URL;
  await checkSession();

  sb.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') window.location.reload();
  });

  // Auto-refresh del dashboard cada 60 s (solo si la pestaña está visible)
  setInterval(() => {
    if (currentView === 'dashboard' && $('#app').classList.contains('active')
        && document.visibilityState === 'visible' && !$('#modalBackdrop').classList.contains('open')) {
      renderDashboard();
    }
  }, 60000);
})();
