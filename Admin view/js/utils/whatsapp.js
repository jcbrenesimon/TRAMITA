function openWA(phone, message) {
  if (!phone) { toast('Sin teléfono', 'error'); return; }
  const clean = String(phone).replace(/\D/g,'');
  const waPhone = clean.length === 8 ? '506' + clean : clean;
  window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

