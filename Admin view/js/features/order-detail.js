async function openOrderModal(orderId) {
  showModal(`<div class="page-loading"><span class="spinner" style="border-color:var(--navy);border-top-color:transparent"></span></div>`, 'Cargando...');

  const [orderRes, notesRes] = await Promise.all([
    sb.from('orders').select('*, users_profile!orders_user_id_fkey(*), order_items(*), payment_receipts(*), payment_accounts(display_name)').eq('id', orderId).single(),
    sb.from('order_notes').select('*').eq('order_id', orderId).order('created_at', { ascending: false })
  ]);

  if (orderRes.error) { toast('Error cargando orden', 'error'); closeModal(); return; }
  const o = orderRes.data;
  const notes = notesRes.data || [];
  const client = o.users_profile;
  const os = ORDER_LABELS[o.order_status];

  const body = `
    <div class="detail-grid">
      <div>
        <div class="detail-block">
          <div class="title">Cliente</div>
          <div class="detail-row"><span class="k">Nombre</span><span class="v">${client?.name || '—'}</span></div>
          <div class="detail-row"><span class="k">Cédula</span><span class="v">${client?.id_card || '—'}</span></div>
          <div class="detail-row"><span class="k">Correo</span><span class="v">${client?.email || '—'}</span></div>
          <div class="detail-row"><span class="k">Teléfono</span><span class="v">${client?.phone || '—'}</span></div>
          ${client?.company ? `<div class="detail-row"><span class="k">Empresa</span><span class="v">${client.company}</span></div>` : ''}
        </div>

        <div class="detail-block">
          <div class="title">Servicios</div>
          ${(o.order_items || []).map(i => `<div class="detail-row"><span class="k">${i.service_name}</span><span class="v">${fmt(i.service_price)}</span></div>`).join('')}
          <div class="detail-row" style="padding-top:10px;border-top:1px solid var(--line-soft);margin-top:6px">
            <span class="k" style="font-weight:600">Total</span>
            <span class="v" style="font-size:15px;font-family:'Fraunces',serif">${fmt(o.total)}</span>
          </div>
        </div>

        ${o.payment_receipts && o.payment_receipts.length > 0 ? `
          <div class="detail-block">
            <div class="title">Comprobantes (${o.payment_receipts.length})</div>
            ${o.payment_receipts.map(r => {
              const rl = RECEIPT_LABELS[r.status];
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft)">
                  <div>
                    <div style="font-size:13px;font-weight:500">${r.original_filename}</div>
                    <div style="font-size:11px;color:var(--ink-subtle)">${fmtDateTime(r.created_at)}</div>
                  </div>
                  <div style="display:flex;gap:6px;align-items:center">
                    <span class="badge ${rl.cls}">${rl.text}</span>
                    <button class="btn btn-ghost btn-sm" onclick="openReceiptModal('${r.id}')">Ver</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="detail-block">
          <div class="title">Bitácora</div>
          <div class="notes-list">
            ${notes.length === 0 ? '<p style="color:var(--ink-subtle);font-size:13px">Sin notas aún.</p>' : notes.map(n => `
              <div class="note-item">
                <div class="note-meta">
                  <span><span class="kind">${n.kind}</span> · ${n.author_name}</span>
                  <span>${fmtDateTime(n.created_at)}</span>
                </div>
                <div>${n.content}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:12px;display:flex;gap:6px">
            <input type="text" id="newNote" placeholder="Agregar nota..." style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
            <select id="newNoteKind" style="padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px">
              <option value="internal">Interna</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="call">Llamada</option>
              <option value="email">Email</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="addOrderNote('${o.id}')">Agregar</button>
          </div>
        </div>
      </div>

      <div>
        <div class="detail-block">
          <div class="title">Orden</div>
          <div class="detail-row"><span class="k">Ref.</span><span class="v mono">${o.reference}</span></div>
          <div class="detail-row"><span class="k">Creada</span><span class="v">${fmtDateTime(o.created_at)}</span></div>
          ${o.paid_at ? `<div class="detail-row"><span class="k">Pagada</span><span class="v">${fmtDateTime(o.paid_at)}</span></div>` : ''}
        </div>
        <div class="detail-block">
          <div class="title">Estado</div>
          <div style="margin-top:4px;margin-bottom:10px"><span class="badge ${os.cls}">${os.text}</span></div>
          <select id="changeStatus" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px;margin-bottom:8px">
            <option value="">Cambiar estado...</option>
            ${Object.entries(ORDER_LABELS).map(([k,v]) =>
              `<option value="${k}" ${k === o.order_status ? 'disabled' : ''}>${v.text}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary btn-block btn-sm" onclick="changeOrderStatus('${o.id}')">Aplicar</button>
        </div>

        <div class="detail-block">
          <div class="title">Pago</div>
          <div class="detail-row"><span class="k">Método</span><span class="v">${o.payment_accounts?.display_name || o.payment_method || '—'}</span></div>
          <div class="detail-row"><span class="k">Subtotal</span><span class="v">${fmt(o.subtotal)}</span></div>
          ${o.discount_amount > 0 ? `<div class="detail-row"><span class="k">Cupón</span><span class="v" style="color:var(--success)">-${fmt(o.discount_amount)}</span></div>` : ''}
          ${o.points_used > 0 ? `<div class="detail-row"><span class="k">Puntos usados</span><span class="v">${o.points_used}</span></div>` : ''}
          ${o.points_earned > 0 ? `<div class="detail-row"><span class="k">Puntos ganados</span><span class="v" style="color:var(--bronze)">+${o.points_earned}</span></div>` : ''}
        </div>

        <button class="btn btn-wa btn-block btn-sm" style="margin-top:6px" onclick="openWA('${client?.phone || ''}','Hola ${(client?.name||'').split(' ')[0]}, le escribimos sobre su orden ${o.reference}.')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          WhatsApp al cliente
        </button>
      </div>
    </div>
  `;

  showModal(body, `Orden ${o.reference}`, `<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>`);
}

async function changeOrderStatus(orderId) {
  const newStatus = $('#changeStatus')?.value;
  if (!newStatus) { toast('Seleccione un estado', 'error'); return; }

  const { data, error } = await sb.rpc('admin_update_order_status', {
    order_id: orderId,
    new_status: newStatus,
    note: ''
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast('Estado actualizado', 'success');
  openOrderModal(orderId);
  if (currentView === 'orders') setTimeout(loadOrders, 500);
}

async function addOrderNote(orderId) {
  const content = $('#newNote')?.value?.trim();
  const kind = $('#newNoteKind')?.value || 'internal';
  if (!content) return;

  const { data, error } = await sb.rpc('admin_add_order_note', {
    order_id: orderId,
    note_content: content,
    note_kind_param: kind
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }
  if (!data.ok) { toast(data.error, 'error'); return; }

  toast('Nota agregada', 'success');
  openOrderModal(orderId);
}

