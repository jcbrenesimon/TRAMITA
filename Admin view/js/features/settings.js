// ============ CONFIGURACIÓN ============
// Todos los datos del negocio que muestra la app pública se editan aquí.
const HERO_STATS_SLOTS = 3;

async function renderSettings() {
  setPageTitle('Configuración');
  $('#content').innerHTML = `
    <div class="view-intro"><p>Datos del negocio que se muestran en la app pública.</p></div>
    <div id="settingsForm">${LOADING}</div>
  `;
  await loadSettings();
}

async function loadSettings() {
  const { data, error } = await sb.from('settings').select('key, value');
  if (currentView !== 'settings') return;
  if (error) { $('#settingsForm').innerHTML = emptyState('Error', friendlyError(error)); return; }

  const s = {};
  (data || []).forEach(row => { s[row.key] = row.value; });
  const dis = isAdmin() ? '' : 'disabled';

  const statRows = Array.from({ length: HERO_STATS_SLOTS }, (_, i) => `
    <div class="field-row field-row-3">
      <div class="field"><label for="setStatValue${i}">Valor ${i + 1}</label><input type="text" id="setStatValue${i}" maxlength="20" placeholder="Ej. +2.400" ${dis}></div>
      <div class="field"><label for="setStatSuffix${i}">Sufijo</label><input type="text" id="setStatSuffix${i}" maxlength="10" placeholder="Ej. /5 (opcional)" ${dis}></div>
      <div class="field"><label for="setStatLabel${i}">Texto</label><input type="text" id="setStatLabel${i}" maxlength="40" placeholder="Ej. Trámites gestionados" ${dis}></div>
    </div>`).join('');

  const card = (title, inner, hint = '') => `
    <section class="data-card">
      <div class="data-head"><h3>${title}</h3></div>
      <div class="card-pad">${hint ? `<div class="field-hint mb-12">${hint}</div>` : ''}${inner}</div>
    </section>`;

  $('#settingsForm').innerHTML = `
    <div class="settings-grid">
      ${card('Datos del negocio', `
        <div class="field"><label for="setBizName">Nombre comercial</label><input type="text" id="setBizName" maxlength="100" ${dis}></div>
        <div class="field-row">
          <div class="field"><label for="setBizEmail">Correo de contacto</label><input type="email" id="setBizEmail" maxlength="150" ${dis}></div>
          <div class="field"><label for="setBizPhone">Teléfono (WhatsApp)</label><input type="text" id="setBizPhone" maxlength="20" placeholder="506XXXXXXXX" ${dis}></div>
        </div>
        <div class="field"><label for="setBizAddress">Dirección</label><input type="text" id="setBizAddress" maxlength="200" ${dis}></div>
        <div class="field"><label for="setBizHours">Horario de atención</label><input type="text" id="setBizHours" maxlength="100" placeholder="Ej. Lun – Vie, 8:00 a.m. – 5:00 p.m." ${dis}></div>
        <div class="field"><label for="setBizTaxId">Cédula jurídica</label><input type="text" id="setBizTaxId" maxlength="30" ${dis}></div>
      `)}

      ${card('Detalle de servicios', `
        <div class="field-row">
          <div class="field"><label for="setModality">Modalidad</label><input type="text" id="setModality" maxlength="60" placeholder="Ej. 100% en línea" ${dis}></div>
          <div class="field"><label for="setCoverage">Cobertura</label><input type="text" id="setCoverage" maxlength="60" placeholder="Ej. Nacional" ${dis}></div>
        </div>
        <div class="field"><label for="setVerifyTime">Tiempo de verificación del comprobante</label><input type="text" id="setVerifyTime" maxlength="60" placeholder="Ej. menos de 2 horas hábiles" ${dis}><div class="field-hint">Se muestra como "Lo verificaremos en …". Vacío = no se muestra.</div></div>
      `, 'Se muestran en todas las fichas de servicio. Vacío = se oculta la fila.')}

      ${card('Estadísticas del inicio', statRows,
        'Se muestran debajo del título principal. Use solo cifras reales y verificables (Ley 7472). Deje vacía una fila para ocultarla.')}

      ${card('Programa de puntos', `
        <div class="field-row">
          <div class="field"><label for="setPointValue">Valor del punto (₡)</label><input type="number" id="setPointValue" min="0" step="0.1" ${dis}><div class="field-hint">Vacío o 0 desactiva el canje. Ej.: con 1% de puntos y ₡1 por punto, el cliente recibe 1% de vuelta.</div></div>
          <label class="check-label check-label-bottom"><input type="checkbox" id="setAllowCombine" ${dis}><span>Permitir cupón + puntos en la misma compra</span></label>
        </div>
        <div class="field-row">
          <div class="field"><label for="setReferralBonus">Puntos por referir</label><input type="number" id="setReferralBonus" min="0" ${dis}><div class="field-hint">Al referidor cuando el referido hace su 1ra compra</div></div>
          <div class="field"><label for="setWelcomeBonus">Puntos de bienvenida</label><input type="number" id="setWelcomeBonus" min="0" ${dis}><div class="field-hint">Al referido en su 1ra compra</div></div>
        </div>
      `)}

      ${card('Textos legales', `
        <div class="field"><label for="setPrivacy">Política de privacidad</label><textarea id="setPrivacy" rows="10" maxlength="20000" ${dis}></textarea></div>
        <div class="field"><label for="setTerms">Términos y condiciones</label><textarea id="setTerms" rows="10" maxlength="20000" ${dis}></textarea></div>
      `, 'Se publican en #/privacidad y #/terminos. Un párrafo que empieza con "1. Título" se muestra como subtítulo. ⚠️ El texto inicial es un borrador: revíselo con un abogado.')}

      ${isAdmin()
        ? '<div class="form-actions"><button class="btn btn-primary btn-lg" type="button" id="saveSettingsBtn" onclick="saveAllSettings()">Guardar configuración</button></div>'
        : '<p class="text-muted small center">Solo el administrador puede modificar esta configuración.</p>'}
    </div>
  `;

  // Valores asignados por propiedad: comillas u otros caracteres no rompen el formulario
  const fill = (sel, v) => { $(sel).value = v ?? ''; };
  fill('#setBizName', s.business_name);
  fill('#setBizEmail', s.business_email);
  fill('#setBizPhone', s.business_phone);
  fill('#setBizAddress', s.business_address);
  fill('#setBizHours', s.business_hours);
  fill('#setBizTaxId', s.business_tax_id);
  fill('#setModality', s.service_modality);
  fill('#setCoverage', s.service_coverage);
  fill('#setVerifyTime', s.receipt_verification_time);
  fill('#setPointValue', s.point_value_crc);
  fill('#setReferralBonus', s.referral_bonus_points);
  fill('#setWelcomeBonus', s.referred_welcome_points);
  fill('#setPrivacy', s.privacy_policy);
  fill('#setTerms', s.terms_of_service);
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
    ['business_phone', text('#setBizPhone').replace(/\D/g, '')],
    ['business_address', text('#setBizAddress')],
    ['business_hours', text('#setBizHours')],
    ['business_tax_id', text('#setBizTaxId')],
    ['service_modality', text('#setModality')],
    ['service_coverage', text('#setCoverage')],
    ['receipt_verification_time', text('#setVerifyTime')],
    ['hero_stats', heroStats],
    ['point_value_crc', num('#setPointValue', parseFloat)],
    ['referral_bonus_points', num('#setReferralBonus', v => parseInt(v))],
    ['referred_welcome_points', num('#setWelcomeBonus', v => parseInt(v))],
    ['allow_combine_coupon_and_points', $('#setAllowCombine')?.checked || false],
    ['privacy_policy', $('#setPrivacy')?.value?.trim() || ''],
    ['terms_of_service', $('#setTerms')?.value?.trim() || ''],
  ].filter(([, value]) => value !== undefined && !Number.isNaN(value));

  const btn = $('#saveSettingsBtn');
  setBusy(btn, true, 'Guardando...');
  const results = await Promise.all(updates.map(([key, value]) => sb.rpc('admin_save_setting', { p_key: key, p_value: value })));
  setBusy(btn, false, 'Guardar configuración');
  const errors = results.map(r => rpcError(r.error, r.data)).filter(Boolean);

  if (errors.length) toast(`Guardado con ${errors.length} error(es): ${errors[0]}`, 'error');
  else toast('✓ Configuración guardada', 'success');
}
