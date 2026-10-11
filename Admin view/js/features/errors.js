// ============ ERRORES DE LAS APPS (#22) ============
let errorsCache = [];

async function renderErrors() {
  setPageTitle('Errores');
  $('#content').innerHTML = `
    <div class="view-intro view-intro-actions">
      <p>Errores de JavaScript que tuvieron los clientes (web) y el equipo (admin). Se conservan 90 días.</p>
      ${isAdmin() ? '<button class="btn btn-outline" type="button" onclick="clearErrors()">Limpiar todo</button>' : ''}
    </div>
    <div id="errorsList">${LOADING}</div>
  `;
  const { data, error } = await sb.from('client_errors').select('*').order('created_at', { ascending: false }).limit(200);
  if (currentView !== 'errors') return;
  const list = $('#errorsList');
  if (error) {
    list.innerHTML = emptyState('No disponible', /client_errors/.test(error.message)
      ? 'Falta ejecutar la migración 06 (registro de errores) en Supabase.' : friendlyError(error));
    return;
  }
  errorsCache = data;
  if (!data.length) { list.innerHTML = emptyState('Sin errores', 'No se han registrado errores. 🎉'); return; }

  list.innerHTML = `
    <div class="data-card">
      <div class="data-head"><h3>${data.length} error${data.length !== 1 ? 'es' : ''}</h3></div>
      ${dataTable(
        [{ label: 'Fecha' }, { label: 'App' }, { label: 'Mensaje' }, { label: 'Página' }],
        data.map(e => ({
          open: ['error', e.id],
          cells: [
            `<span class="text-muted small">${esc(fmtDate(e.created_at))}</span>`,
            `<span class="badge ${e.app === 'admin' ? 'badge-info' : 'badge-muted'}">${esc(e.app)}</span>`,
            `<span class="truncate">${esc(e.message)}</span>`,
            `<span class="text-muted small truncate">${esc((e.url || '').replace(/^https?:\/\/[^/]+/, ''))}</span>`,
          ],
        })))}
    </div>`;
}

function openErrorModal(id) {
  const e = errorsCache.find(x => String(x.id) === String(id));
  if (!e) return;
  showModal(`
    <div class="detail-block">
      <div class="detail-row"><span class="k">Fecha</span><span class="v">${esc(fmtDateTime(e.created_at))}</span></div>
      <div class="detail-row"><span class="k">App</span><span class="v">${esc(e.app)}</span></div>
      <div class="detail-row"><span class="k">Página</span><span class="v break">${esc(e.url || '—')}</span></div>
      <div class="detail-row"><span class="k">Navegador</span><span class="v break small">${esc(e.user_agent || '—')}</span></div>
    </div>
    <div class="detail-block">
      <div class="title">Mensaje</div>
      <pre class="code-block">${esc(e.message)}</pre>
      ${e.stack ? `<div class="title mt-10">Detalle técnico</div><pre class="code-block">${esc(e.stack)}</pre>` : ''}
    </div>`, 'Detalle del error');
}

async function clearErrors() {
  if (!confirm('¿Borrar todo el registro de errores?')) return;
  const { data, error } = await sb.rpc('admin_clear_errors');
  const err = rpcError(error, data);
  if (err) { toast(err, 'error'); return; }
  toast(`Se borraron ${data.deleted} errores`, 'success');
  renderErrors();
}
