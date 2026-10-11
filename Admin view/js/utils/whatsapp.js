// window.open debe llamarse directo en el gesto del usuario (Safari bloquea timers)
function openWA(phone, message) {
  const clean = String(phone || '').replace(/\D/g, '');
  if (!clean) { toast('El cliente no tiene teléfono registrado', 'error'); return; }
  const waPhone = clean.length === 8 ? '506' + clean : clean;
  window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}
