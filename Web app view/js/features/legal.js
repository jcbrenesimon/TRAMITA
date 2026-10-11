// ============================================================
// PRIVACIDAD Y TÉRMINOS (#18): el texto viene de settings
// ============================================================
function legalHTML(text) {
  const blocks = String(text || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (!blocks.length) return '<p class="muted">Este documento estará disponible pronto. Para consultas, contáctenos.</p>';
  return blocks.map(b => {
    const [first, ...rest] = b.split('\n');
    // Un bloque que empieza con "1. Título" se muestra como subtítulo
    if (/^\d+\.\s/.test(first) && rest.length) {
      return `<h2>${esc(first)}</h2><p>${rest.map(esc).join('<br>')}</p>`;
    }
    return `<p>${b.split('\n').map(esc).join('<br>')}</p>`;
  }).join('');
}

function renderLegal() {
  $('#privacyText').innerHTML = legalHTML(settings.privacy_policy);
  $('#termsText').innerHTML = legalHTML(settings.terms_of_service);
}
