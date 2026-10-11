// ============ MODAL ============
function showModal(body, title, footer = '<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>') {
  $('#modalContent').innerHTML = `
    <div class="modal-head">
      <h3>${title}</h3>
      <button class="modal-close" onclick="closeModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot">${footer}</div>
  `;
  $('#modalBackdrop').classList.add('open');
}

function closeModal() {
  $('#modalBackdrop').classList.remove('open');
}

function closeModalBackdrop(e) {
  if (e.target.id === 'modalBackdrop') closeModal();
}

