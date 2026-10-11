// ============================================================
// CARGA INICIAL
// ============================================================
async function loadSettings() {
  const { data, error } = await sb.from('settings').select('*');
  if (error) { console.error('settings error:', error); return; }
  settings = {};
  data.forEach(row => { settings[row.key] = row.value; });
  applySettings();
}

// Todos los datos del negocio vienen de la tabla settings. Si una clave
// no está configurada, el elemento correspondiente se oculta.
function applySettings() {
  const phone = settings.business_phone ? String(settings.business_phone) : '';
  const displayPhone = phone.replace(/^506/, '+506 ').replace(/(\d{4})(\d{4})$/, '$1-$2');
  const email = settings.business_email || '';
  const address = settings.business_address || '';
  const hours = settings.business_hours || '';

  setOptionalText('#contactWA', displayPhone, '#contactWABtn');
  setOptionalText('#contactEmail', email, '#contactEmailRow');
  setOptionalText('#contactHours', hours, '#contactHoursRow');
  setOptionalText('#footerEmail', email);
  setOptionalText('#footerPhone', displayPhone);
  setOptionalText('#footerAddress', address);
  $('#footerCopy').textContent = `© ${new Date().getFullYear()} ${settings.business_name || ''}. Todos los derechos reservados.`;

  renderHeroStats();
}

function setOptionalText(sel, text, containerSel) {
  const el = $(sel);
  el.textContent = text;
  $(containerSel || sel).style.display = text ? '' : 'none';
}

// settings.hero_stats: [{ "value": "4,9", "suffix": "/5", "label": "Satisfacción" }, ...]  (suffix opcional)
function renderHeroStats() {
  const stats = Array.isArray(settings.hero_stats) ? settings.hero_stats : [];
  const box = $('#heroStats');
  box.replaceChildren(...stats.map(st => {
    const item = document.createElement('div');
    const num = document.createElement('div');
    num.className = 'stat-num';
    num.textContent = st.value;
    if (st.suffix) {
      const suffix = document.createElement('span');
      suffix.style.cssText = 'font-size:.5em;color:var(--bronze)';
      suffix.textContent = st.suffix;
      num.append(suffix);
    }
    const label = document.createElement('div');
    label.className = 'stat-label';
    label.textContent = st.label;
    item.append(num, label);
    return item;
  }));
  box.style.display = stats.length ? '' : 'none';
}

function renderFooterCategories() {
  $('#footerCategories').replaceChildren(...categories.map(c => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = c.name;
    a.onclick = () => { currentCat = c.id; go('services'); };
    li.append(a);
    return li;
  }));
}

async function loadCategoriesAndServices() {
  const [cRes, sRes] = await Promise.all([
    sb.from('categories').select('*').eq('active', true).order('display_order'),
    sb.from('services').select('*').eq('active', true).order('id')
  ]);
  if (cRes.error) console.error(cRes.error);
  if (sRes.error) console.error(sRes.error);
  categories = cRes.data || [];
  services = sRes.data || [];
  renderFeatured();
  renderFooterCategories();
}

async function loadPaymentAccounts() {
  const { data, error } = await sb.from('payment_accounts').select('*').eq('active', true).order('display_order');
  if (error) { console.error(error); return; }
  paymentAccounts = data || [];
}

