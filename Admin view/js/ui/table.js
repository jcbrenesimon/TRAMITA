// ============ TABLAS RESPONSIVE ============
// En pantallas angostas cada fila se muestra como tarjeta; data-label pone
// el nombre de la columna junto a cada valor.
//
// columns: [{ label, cls? }]
// rows:    [{ open?: ['order', id], cells: [html, ...] }]   (html ya escapado)
function dataTable(columns, rows) {
  return `
    <div class="table-scroll">
      <table class="rtable">
        <thead><tr>${columns.map(c => `<th scope="col" class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr ${r.open ? `class="clickable" ${openAttrs(r.open[0], r.open[1])}` : ''}>
              ${r.cells.map((cell, i) => `<td data-label="${esc(columns[i]?.label || '')}" class="${columns[i]?.cls || ''}"><div class="cell">${cell}</div></td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// Paginación simple: « Anterior · 1–25 de 140 · Siguiente »
function pager(total, page, onChange) {
  if (total <= PAGE_SIZE) return '';
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  return `
    <div class="pager">
      <button class="btn btn-ghost btn-sm" type="button" ${page === 0 ? 'disabled' : ''} onclick="${onChange}(${page - 1})">← Anterior</button>
      <span class="pager-info">${from}–${to} de ${total}</span>
      <button class="btn btn-ghost btn-sm" type="button" ${to >= total ? 'disabled' : ''} onclick="${onChange}(${page + 1})">Siguiente →</button>
    </div>`;
}

function emptyState(title, text, icon = '') {
  return `<div class="empty">${icon}<h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
}
