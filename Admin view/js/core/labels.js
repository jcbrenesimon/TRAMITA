// ============ ESTADOS/LABELS ============
const ORDER_LABELS = {
  pendiente: { text: 'Pendiente', cls: 'badge-muted' },
  pendiente_de_pago: { text: 'Pendiente pago', cls: 'badge-warning' },
  pagado: { text: 'Pagado', cls: 'badge-info' },
  pendiente_de_documentos: { text: 'Falta docs', cls: 'badge-warning' },
  en_revision: { text: 'En revisión', cls: 'badge-info' },
  en_proceso: { text: 'En gestión', cls: 'badge-info' },
  completado: { text: 'Completado', cls: 'badge-success' },
  entregado: { text: 'Entregado', cls: 'badge-success' },
  cancelado: { text: 'Cancelado', cls: 'badge-danger' },
};
const PAY_LABELS = {
  pending: { text: 'Esperando', cls: 'badge-warning' },
  paid: { text: 'Pagado', cls: 'badge-success' },
  failed: { text: 'Fallido', cls: 'badge-danger' },
  refunded: { text: 'Reembolsado', cls: 'badge-muted' },
  cancelled: { text: 'Cancelado', cls: 'badge-muted' },
};
const RECEIPT_LABELS = {
  pendiente: { text: 'Pendiente', cls: 'badge-warning' },
  aprobado: { text: 'Aprobado', cls: 'badge-success' },
  rechazado: { text: 'Rechazado', cls: 'badge-danger' },
};
const ROLE_LABELS = {
  cliente: { text: 'Cliente', cls: 'role-cliente' },
  operador: { text: 'Operador', cls: 'role-operador' },
  admin: { text: 'Admin', cls: 'role-admin' },
  consulta: { text: 'Consulta', cls: 'role-consulta' },
};
const NOTE_KINDS = { internal: 'Interna', whatsapp: 'WhatsApp', call: 'Llamada', email: 'Email', system: 'Sistema' };
const PAYMENT_METHODS = { sinpe: 'SINPE Móvil', transferencia: 'Transferencia', deposito: 'Depósito', link_bancario: 'Link bancario' };

const badge = (map, key) => {
  const l = map[key] || { text: key || '—', cls: 'badge-muted' };
  return `<span class="badge ${l.cls}">${esc(l.text)}</span>`;
};
