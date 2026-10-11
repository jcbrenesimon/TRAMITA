// ============================================================
// CARGA INICIAL
// Todos los datos del negocio vienen de la base de datos (settings,
// categories, services, payment_accounts). Si un dato no está
// configurado, el elemento correspondiente se oculta.
// ============================================================
async function loadSettings() {
  const { data, error } = await sb.from('settings').select('key, value');
  if (error) { console.error('settings error:', error); reportError('settings: ' + error.message); return; }
  settings = {};
  data.forEach(row => { settings[row.key] = row.value; });
  applySettings();
}

function applySettings() {
  const phone = businessPhone();
  const shownPhone = displayPhone(phone);
  const email = settings.business_email || '';
  const address = settings.business_address || '';
  const hours = settings.business_hours || '';

  // Sin WhatsApp configurado se ocultan todos los botones de WhatsApp
  document.body.classList.toggle('no-wa', !phone);

  setOptionalText('#contactWA', shownPhone, '#contactWABtn');
  setOptionalText('#contactEmail', email, '#contactEmailRow');
  if (email) $('#contactEmail').href = 'mailto:' + email;
  setOptionalText('#contactHours', hours, '#contactHoursRow');
  setOptionalText('#contactAddress', address, '#contactAddressRow');
  setOptionalText('#footerEmail', email);
  setOptionalText('#footerPhone', shownPhone);
  setOptionalText('#footerAddress', address);
  $('#footerCopy').textContent = `© ${new Date().getFullYear()} ${settings.business_name || ''}. Todos los derechos reservados.`;

  renderHeroStats();
}

function setOptionalText(sel, text, containerSel) {
  $(sel).textContent = text;
  show(containerSel || sel, !!text);
}

// settings.hero_stats: [{ "value": "4,9", "suffix": "/5", "label": "Satisfacción" }, ...]  (suffix opcional)
function renderHeroStats() {
  const stats = Array.isArray(settings.hero_stats) ? settings.hero_stats : [];
  const box = $('#heroStats');
  box.replaceChildren(...stats.filter(st => st?.value && st?.label).map(st => {
    const item = document.createElement('div');
    const num = document.createElement('div');
    num.className = 'stat-num';
    num.textContent = st.value;
    if (st.suffix) {
      const suffix = document.createElement('span');
      suffix.className = 'stat-suffix';
      suffix.textContent = st.suffix;
      num.append(suffix);
    }
    const label = document.createElement('div');
    label.className = 'stat-label';
    label.textContent = st.label;
    item.append(num, label);
    return item;
  }));
  box.hidden = box.children.length === 0;
}

function renderFooterCategories() {
  $('#footerCategories').replaceChildren(...categories.map(c => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = c.name;
    a.href = '#/servicios';
    a.addEventListener('click', () => { currentCat = c.id; if (location.hash === '#/servicios') renderAllServices(); });
    li.append(a);
    return li;
  }));
}

async function loadCategoriesAndServices() {
  const [cRes, sRes] = await Promise.all([
    sb.from('categories').select('id, name, slug, display_order').eq('active', true).order('display_order'),
    sb.from('services').select('*').eq('active', true).order('display_order').order('id'),
  ]);
  if (cRes.error) { console.error(cRes.error); reportError('categories: ' + cRes.error.message); }
  if (sRes.error) { console.error(sRes.error); reportError('services: ' + sRes.error.message); }
  categories = cRes.data || [];
  services = sRes.data || [];
  syncCartWithCatalog();
  renderFeatured();
  renderFooterCategories();
}

async function loadPaymentAccounts() {
  const { data, error } = await sb.from('payment_accounts').select('*').eq('active', true).order('display_order');
  if (error) { console.error(error); reportError('payment_accounts: ' + error.message); return; }
  paymentAccounts = data || [];
}
