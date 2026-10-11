// ============ HELPERS ============
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => '₡' + Number(n || 0).toLocaleString('es-CR');
const TZ = 'America/Costa_Rica';
const fmtDate = d => new Date(d).toLocaleString('es-CR', { timeZone: TZ, day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDateTime = d => new Date(d).toLocaleString('es-CR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDateOnly = d => new Date(d).toLocaleDateString('es-CR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });

// Escapa texto para HTML (contenido y atributos). TODO dato que venga de la
// base de datos o del usuario pasa por aquí antes de entrar a innerHTML.
function esc(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[ch]));
}

function safeUrl(url) {
  try {
    const u = new URL(String(url || ''), location.href);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

const LOADING = '<div class="page-loading"><span class="spinner spinner-dark" aria-hidden="true"></span> Cargando...</div>';

function toast(msg, type = '') {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 3500);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function setError(sel, msg) {
  const el = $(sel);
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.dataset.label || btn.textContent.trim();
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label || 'Procesando...')}`;
  } else {
    btn.disabled = false;
    btn.textContent = label || btn.dataset.label || '';
    delete btn.dataset.label;
  }
}

// Resultado de una función admin_*: devuelve el mensaje de error o null
function rpcError(error, data) {
  if (error) return friendlyError(error);
  if (data && data.ok === false) return data.error || 'Operación no permitida';
  if (data && data.error) return data.error;
  return null;
}

function friendlyError(error) {
  const msg = String(error?.message || error || '');
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos';
  if (/Email not confirmed/i.test(msg)) return 'El correo de esta cuenta no está confirmado.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espere unos minutos.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sin conexión. Revise su internet.';
  if (/permission denied|42501/i.test(msg)) return 'Sin permisos para esta acción.';
  return msg || 'Error inesperado';
}

// Accesibilidad: filas y tarjetas con data-open se abren con clic, Enter o Espacio
document.addEventListener('click', e => {
  const el = e.target.closest('[data-open]');
  if (!el || e.target.closest('button, a, input, select, textarea, label')) return;
  runOpen(el);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-open]')) {
    e.preventDefault();
    runOpen(e.target);
  }
});
function runOpen(el) {
  const [fn, arg] = el.dataset.open.split(':');
  const handlers = {
    order: openOrderModal, receipt: openReceiptModal, user: openUserModal, service: openServiceModal,
    category: openCategoryModal, account: openPaymentAccountModal, coupon: openCouponModal, error: openErrorModal,
  };
  handlers[fn]?.(arg);
}
// Atributos para un elemento "clicable" accesible
const openAttrs = (kind, id) => `data-open="${esc(kind)}:${esc(id)}" tabindex="0" role="button"`;
