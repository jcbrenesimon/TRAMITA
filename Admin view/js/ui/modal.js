// ============ MODAL ============
// `title` es texto plano (se escapa). `body` y `footer` son HTML ya escapado.
let modalReturnFocus = null;

function showModal(body, title, footer = '<button class="btn btn-ghost" type="button" onclick="closeModal()">Cerrar</button>') {
  const backdrop = $('#modalBackdrop');
  if (!backdrop.classList.contains('open')) modalReturnFocus = document.activeElement;
  $('#modalContent').innerHTML = `
    <div class="modal-head">
      <h2 id="modalTitle">${esc(title)}</h2>
      <button class="modal-close" type="button" onclick="closeModal()" aria-label="Cerrar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot">${footer}</div>
  `;
  backdrop.classList.add('open');
  document.body.classList.add('no-scroll');
  const first = $('#modalContent .modal-body input:not([type=hidden]), #modalContent .modal-body textarea, #modalContent .modal-body select');
  (first || $('#modalContent .modal-close')).focus({ preventScroll: true });
}

function closeModal() {
  $('#modalBackdrop').classList.remove('open');
  document.body.classList.remove('no-scroll');
  if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus({ preventScroll: true });
  modalReturnFocus = null;
}

function closeModalBackdrop(e) {
  if (e.target.id === 'modalBackdrop') closeModal();
}

document.addEventListener('keydown', e => {
  if (!$('#modalBackdrop').classList.contains('open')) return;
  if (e.key === 'Escape') { closeModal(); return; }
  // Mantener el foco dentro del modal
  if (e.key === 'Tab') {
    const items = [...$$('#modalContent a[href], #modalContent button:not([disabled]), #modalContent input:not([disabled]), #modalContent select, #modalContent textarea, #modalContent [tabindex="0"]')]
      .filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
