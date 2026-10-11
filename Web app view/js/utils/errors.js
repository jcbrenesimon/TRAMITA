// ============================================================
// REGISTRO DE ERRORES (#22)
// Los errores de JavaScript se envían a log_client_error() y el equipo
// los ve en el panel → Errores. Se evita reenviar el mismo error.
// ============================================================
const reportedErrors = new Set();

function reportError(message, stack) {
  const key = String(message).slice(0, 200);
  if (!message || reportedErrors.has(key) || reportedErrors.size > 20) return;
  reportedErrors.add(key);
  try {
    sb.rpc('log_client_error', {
      p_app: 'web',
      p_message: String(message).slice(0, 1000),
      p_stack: String(stack || '').slice(0, 4000),
      p_url: location.href.split('?')[0].slice(0, 500),
      p_user_agent: navigator.userAgent.slice(0, 300),
    }).then(() => {}, () => {});
  } catch { /* nunca romper la app por el registro */ }
}

window.addEventListener('error', e => {
  if (e.message) reportError(e.message, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  reportError(r?.message || String(r), r?.stack);
});
