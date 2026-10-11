// ============================================================
// HELPERS
// ============================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => '₡' + Number(n || 0).toLocaleString('es-CR');

// Escapa texto para insertarlo en HTML (contenido y atributos).
// TODO dato que venga de la base de datos o del usuario pasa por aquí.
function esc(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[ch]));
}

// Solo URLs http(s); cualquier otra cosa (javascript:, data:) se descarta
function safeUrl(url) {
  try {
    const u = new URL(String(url || ''), location.href);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

const saveCart = () => {
  try { localStorage.setItem('tramita_cart', JSON.stringify(cart)); } catch { /* modo privado */ }
};

function show(el, visible = true) {
  const node = typeof el === 'string' ? $(el) : el;
  if (node) node.hidden = !visible;
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

let toastTimer = null;
function toast(msg, isError = false) {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function businessPhone() {
  return String(settings.business_phone || '').replace(/\D/g, '');
}

function openWA(msg) {
  const clean = businessPhone();
  if (!clean) { toast('WhatsApp no está disponible en este momento', true); return; }
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

function displayPhone(phone) {
  return String(phone || '').replace(/^506/, '+506 ').replace(/(\d{4})(\d{4})$/, '$1-$2');
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
  } catch {
    toast('No se pudo copiar. Selecciónelo y cópielo manualmente.', true);
  }
}

// Botones "Copiar" generados dinámicamente: <button data-copy="valor">
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  copyText(btn.dataset.copy, btn);
});

// Mensajes de error de Supabase en español para el usuario
function friendlyError(error) {
  const msg = String(error?.message || error || '');
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos';
  if (/Email not confirmed/i.test(msg)) return 'Debe confirmar su correo antes de iniciar sesión. Revise su bandeja de entrada.';
  if (/User already registered/i.test(msg)) return 'Ya existe una cuenta con ese correo.';
  if (/Password should be at least/i.test(msg)) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espere unos minutos e intente de nuevo.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sin conexión. Revise su internet e intente de nuevo.';
  if (/same.*password|different from the old/i.test(msg)) return 'La contraseña nueva debe ser distinta a la anterior.';
  return msg || 'Ocurrió un error inesperado.';
}
