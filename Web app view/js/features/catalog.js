// ============================================================
// ICONOS
// ============================================================
const ICONS = {
  car: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  doc: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>',
};

function cardHTML(s) {
  return `
    <div class="service-card" onclick="go('service-detail', ${s.id})">
      <div class="ico">${ICONS[s.icon] || ICONS.doc}</div>
      <h3>${s.name}</h3>
      <p>${s.short_description}</p>
      <div class="foot">
        <div>
          <div class="price-currency">Desde</div>
          <div class="price">${fmt(s.price)}</div>
        </div>
        <span class="arrow-link">Ver detalle →</span>
      </div>
    </div>`;
}

function renderFeatured() {
  const featured = services.filter(s => s.featured).slice(0, 3);
  const list = featured.length ? featured : services.slice(0, 3);
  $('#featuredServices').innerHTML = list.map(cardHTML).join('');
}

function renderAllServices() {
  const all = [{ id: 'all', name: 'Todas' }, ...categories];
  $('#catFilters').innerHTML = all.map(c => `
    <button class="chip ${currentCat === (c.id === 'all' ? 'all' : c.id) ? 'active' : ''}" onclick="filterCat('${c.id}')">${c.name}</button>
  `).join('');
  const filtered = currentCat === 'all' ? services : services.filter(s => s.category_id === currentCat);
  $('#allServices').innerHTML = filtered.length ? filtered.map(cardHTML).join('') : '<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-muted)">No hay servicios en esta categoría.</p>';
}

function filterCat(id) {
  currentCat = id === 'all' ? 'all' : parseInt(id);
  renderAllServices();
}

function renderDetail(id) {
  const s = services.find(x => x.id === parseInt(id));
  if (!s) return go('services');
  currentService = s;
  const cat = categories.find(c => c.id === s.category_id);
  $('#crumbService').textContent = s.name;
  $('#detailCat').textContent = cat?.name || '';
  $('#detailName').textContent = s.name;
  $('#detailShort').textContent = s.short_description;
  $('#detailLong').textContent = s.long_description;
  $('#detailPrice').textContent = fmt(s.price);
  $('#detailTime').textContent = s.estimated_time;
  const pts = Math.floor(s.price * (s.points_percentage || 0) / 100);
  if (pts > 0) {
    $('#pointsRow').style.display = 'flex';
    $('#detailPoints').textContent = pts + ' pts';
  } else {
    $('#pointsRow').style.display = 'none';
  }
  const docs = Array.isArray(s.required_documents) ? s.required_documents : [];
  $('#detailDocs').innerHTML = docs.map(d => `<li>${d}</li>`).join('');
}

function addToCartFromDetail() {
  if (!currentService) return;
  cart.push({
    id: currentService.id,
    name: currentService.name,
    price: currentService.price,
    icon: currentService.icon,
    points_percentage: currentService.points_percentage,
    estimated_time: currentService.estimated_time,
  });
  saveCart();
  updateCartBadge();
  toast('Servicio agregado al carrito');
}

