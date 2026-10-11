// ============ HELPERS ============
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => '₡' + Number(n || 0).toLocaleString('es-CR');
const fmtDate = d => new Date(d).toLocaleString('es-CR', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit', hour12: true });
const fmtDateTime = d => new Date(d).toLocaleString('es-CR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12: true });
const fmtDateOnly = d => new Date(d).toLocaleDateString('es-CR', { day:'2-digit', month:'short', year:'numeric' });

function toast(msg, type = '') {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase();
}

