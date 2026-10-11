// ============================================================
// CATÁLOGO
// ============================================================
function serviceMedia(s, cls) {
  const img = safeUrl(s.image_url);
  if (img) return `<img class="${cls}-img" src="${esc(img)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="ico">${serviceIcon(s.icon)}</div>`;
}

function cardHTML(s) {
  return `
    <a class="service-card${safeUrl(s.image_url) ? ' has-image' : ''}" href="#/servicios/${esc(s.slug)}">
      ${serviceMedia(s, 'card')}
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.short_description)}</p>
      <div class="foot">
        <div>
          <div class="price-currency">Desde</div>
          <div class="price">${fmt(s.price)}</div>
        </div>
        <span class="arrow-link" aria-hidden="true">Ver detalle →</span>
      </div>
    </a>`;
}

function renderFeatured() {
  const featured = services.filter(s => s.featured).slice(0, 3);
  const list = featured.length ? featured : services.slice(0, 3);
  $('#featuredServices').innerHTML = list.length
    ? list.map(cardHTML).join('')
    : '<p class="grid-empty">Pronto publicaremos nuestros servicios.</p>';
}

function renderAllServices() {
  const all = [{ id: 'all', name: 'Todas' }, ...categories];
  $('#catFilters').innerHTML = all.map(c => {
    const active = currentCat === c.id;
    return `<button type="button" class="chip ${active ? 'active' : ''}" aria-pressed="${active}" onclick="filterCat('${esc(c.id)}')">${esc(c.name)}</button>`;
  }).join('');
  const filtered = currentCat === 'all' ? services : services.filter(s => s.category_id === currentCat);
  $('#allServices').innerHTML = filtered.length
    ? filtered.map(cardHTML).join('')
    : '<p class="grid-empty">No hay servicios en esta categoría.</p>';
}

function filterCat(id) {
  currentCat = id === 'all' ? 'all' : parseInt(id);
  renderAllServices();
}

function findService(key) {
  return services.find(x => x.slug === key) || services.find(x => String(x.id) === String(key));
}

function renderDetail(key) {
  const s = findService(key);
  if (!s) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $('#page-not-found').classList.add('active');
    return;
  }
  currentService = s;
  document.title = `Tramitá — ${s.name}`;
  const cat = categories.find(c => c.id === s.category_id);
  $('#crumbService').textContent = s.name;
  $('#detailCat').textContent = cat?.name || '';
  show('#detailCat', !!cat);
  $('#detailName').textContent = s.name;
  $('#detailShort').textContent = s.short_description;
  $('#detailLong').textContent = s.long_description;
  $('#detailPrice').textContent = fmt(s.price);
  $('#detailTime').textContent = s.estimated_time || 'A convenir';

  const img = safeUrl(s.image_url);
  const imgEl = $('#detailImage');
  if (img) { imgEl.src = img; imgEl.alt = s.name; }
  imgEl.hidden = !img;

  $('#detailModality').textContent = settings.service_modality || '';
  show('#modalityRow', !!settings.service_modality);
  $('#detailCoverage').textContent = settings.service_coverage || '';
  show('#coverageRow', !!settings.service_coverage);

  const pts = servicePoints(s, 1);
  $('#detailPoints').textContent = pts + ' pts';
  show('#pointsRow', pts > 0);

  const docs = Array.isArray(s.required_documents) ? s.required_documents : [];
  $('#detailDocs').innerHTML = docs.length
    ? docs.map(d => `<li>${esc(d)}</li>`).join('')
    : '<li>Le indicaremos los documentos al iniciar el trámite.</li>';
}

function servicePoints(s, qty) {
  return Math.floor(s.price * qty * (Number(s.points_percentage) || 0) / 100);
}

function addToCartFromDetail() {
  if (!currentService) return;
  addToCart(currentService.id);
}
