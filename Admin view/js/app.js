// ============ INICIO ============
(async function init() {
  $('#publicAppLink').href = PUBLIC_APP_URL;
  await checkSession();

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.reload();
    }
  });

  // Auto-refresh del dashboard cada 60 seg
  setInterval(() => {
    if (currentView === 'dashboard' && $('#app').classList.contains('active')) {
      renderDashboard();
    }
  }, 60000);
})();
