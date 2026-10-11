// ============================================================
// HELPERS
// ============================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => '₡' + Number(n).toLocaleString('es-CR');
const saveCart = () => localStorage.setItem('tramita_cart', JSON.stringify(cart));

function toast(msg, isError = false) {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function openWA(msg) {
  const clean = String(settings.business_phone || '').replace(/\D/g,'');
  if (!clean) { toast('WhatsApp no está disponible en este momento', true); return; }
  window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
}

