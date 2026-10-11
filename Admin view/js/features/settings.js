// ============ CONFIGURACIÓN ============
async function renderSettings() {
  setPageTitle('Configuración');
  $('#content').innerHTML = `
    <div style="margin-bottom:20px">
      <p style="color:var(--ink-muted)">Ajustes generales del negocio.</p>
    </div>
    <div id="settingsForm"><div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div></div>
  `;
  await loadSettings();
}

// Cantidad de estadísticas que se muestran en el inicio de la app pública
const HERO_STATS_SLOTS = 3;

async function loadSettings() {
  const { data, error } = await sb.from('settings').select('*');
  if (error) { $('#settingsForm').innerHTML = `<div class="empty"><p>Error: ${error.message}</p></div>`; return; }

  const s = {};
  (data || []).forEach(row => {
    try { s[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value; }
    catch { s[row.key] = row.value; }
  });

  const isAdmin = currentProfile.role === 'admin';
  const readonly = isAdmin ? '' : 'disabled';

  const statRows = Array.from({ length: HERO_STATS_SLOTS }, (_, i) => `
    <div class="field-row">
      <div class="field"><label>Valor ${i + 1}</label><input type="text" id="setStatValue${i}" placeholder="Ej. +2.400" ${readonly}></div>
      <div class="field"><label>Sufijo</label><input type="text" id="setStatSuffix${i}" placeholder="Ej. /5 (opcional)" ${readonly}></div>
      <div class="field"><label>Texto</label><input type="text" id="setStatLabel${i}" placeholder="Ej. Trámites gestionados" ${readonly}></div>
    </div>`).join('');

  $('#settingsForm').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr;gap:18px;max-width:720px">
      <div class="data-card">
        <div class="data-head"><h3>Datos del negocio</h3></div>
        <div style="padding:18px">
          <div class="field"><label>Nombre comercial</label><input type="text" id="setBizName" ${readonly}></div>
          <div class="field-row">
            <div class="field"><label>Correo de contacto</label><input type="email" id="setBizEmail" ${readonly}></div>
            <div class="field"><label>Teléfono (WhatsApp)</label><input type="text" id="setBizPhone" placeholder="506XXXXXXXX" ${readonly}></div>
          </div>
          <div class="field"><label>Dirección</label><input type="text" id="setBizAddress" ${readonly}></div>
          <div class="field"><label>Horario de atención</label><input type="text" id="setBizHours" placeholder="Ej. Lun – Vie, 8:00 a.m. – 5:00 p.m." ${readonly}></div>
          <div class="field"><label>Cédula jurídica</label><input type="text" id="setBizTaxId" ${readonly}></div>
        </div>
      </div>

      <div class="data-card">
        <div class="data-head"><h3>Estadísticas del inicio</h3></div>
        <div style="padding:18px">
          <div class="field-hint" style="margin-bottom:12px">Se muestran debajo del título principal de la app pública. Deje vacía una fila para ocultarla.</div>
          ${statRows}
        </div>
      </div>

      <div class="data-card">
        <div class="data-head"><h3>Programa de puntos</h3></div>
        <div style="padding:18px">
          <div class="field-row">
            <div class="field"><label>Valor del punto (₡)</label><input type="number" id="setPointValue" min="0" step="0.1" ${readonly}><div class="field-hint">Vacío o 0 desactiva el canje de puntos</div></div>
            <div class="field">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-bottom:10px">
                <input type="checkbox" id="setAllowCombine" ${readonly} style="width:auto">
                <span>Combinar cupón + puntos</span>
              </label>
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>Puntos por referir</label><input type="number" id="setReferralBonus" min="0" ${readonly}><div class="field-hint">Al referidor cuando el referido hace su 1ra compra</div></div>
            <div class="field"><label>Puntos de bienvenida</label><input type="number" id="setWelcomeBonus" min="0" ${readonly}><div class="field-hint">Al referido en su 1ra compra</div></div>
          </div>
        </div>
      </div>

      ${isAdmin ? `
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="btn btn-primary btn-lg" onclick="saveAllSettings()">Guardar configuración</button>
        </div>
      ` : '<p style="color:var(--ink-subtle);font-size:13px;text-align:center">Solo el administrador puede modificar esta configuración.</p>'}
    </div>
  `;

  // Los valores se asignan por propiedad (no dentro del HTML) para que
  // comillas u otros caracteres en los datos no rompan el formulario.
  const fill = (sel, v) => { $(sel).value = v ?? ''; };
  fill('#setBizName', s.business_name);
  fill('#setBizEmail', s.business_email);
  fill('#setBizPhone', s.business_phone);
  fill('#setBizAddress', s.business_address);
  fill('#setBizHours', s.business_hours);
  fill('#setBizTaxId', s.business_tax_id);
  fill('#setPointValue', s.point_value_crc);
  fill('#setReferralBonus', s.referral_bonus_points);
  fill('#setWelcomeBonus', s.referred_welcome_points);
  $('#setAllowCombine').checked = s.allow_combine_coupon_and_points === true;
  const stats = Array.isArray(s.hero_stats) ? s.hero_stats : [];
  for (let i = 0; i < HERO_STATS_SLOTS; i++) {
    fill(`#setStatValue${i}`, stats[i]?.value);
    fill(`#setStatSuffix${i}`, stats[i]?.suffix);
    fill(`#setStatLabel${i}`, stats[i]?.label);
  }
}

async function saveAllSettings() {
  const text = sel => $(sel)?.value?.trim() || '';
  // Número vacío = no se guarda (se conserva lo que haya en la base de datos)
  const num = (sel, parse) => { const v = text(sel); return v === '' ? undefined : parse(v); };

  const heroStats = [];
  for (let i = 0; i < HERO_STATS_SLOTS; i++) {
    const value = text(`#setStatValue${i}`);
    const label = text(`#setStatLabel${i}`);
    const suffix = text(`#setStatSuffix${i}`);
    if (value && label) heroStats.push(suffix ? { value, suffix, label } : { value, label });
  }

  const updates = [
    ['business_name', text('#setBizName')],
    ['business_email', text('#setBizEmail')],
    ['business_phone', text('#setBizPhone')],
    ['business_address', text('#setBizAddress')],
    ['business_hours', text('#setBizHours')],
    ['business_tax_id', text('#setBizTaxId')],
    ['hero_stats', heroStats],
    ['point_value_crc', num('#setPointValue', parseFloat)],
    ['referral_bonus_points', num('#setReferralBonus', v => parseInt(v))],
    ['referred_welcome_points', num('#setWelcomeBonus', v => parseInt(v))],
    ['allow_combine_coupon_and_points', $('#setAllowCombine')?.checked || false]
  ].filter(([, value]) => value !== undefined && !Number.isNaN(value));

  let errors = 0;
  for (const [key, value] of updates) {
    const { data, error } = await sb.rpc('admin_save_setting', {
      p_key: key,
      p_value: value
    });
    if (error || !data?.ok) errors++;
  }

  if (errors > 0) {
    toast(`Guardado con ${errors} error(es)`, 'error');
  } else {
    toast('✓ Configuración guardada', 'success');
  }
}
