import { getMovements, clearMovements } from '../state.js';
import { toast } from './toast.js';

const TYPE_LABEL = {
  add: 'Compra / Agregado al portfolio',
  remove: 'Eliminado del portfolio',
  update: 'Actualización del portfolio',
  'watch-add': 'Agregado a watchlist',
  'watch-remove': 'Removido de watchlist',
};

export function renderMovements() {
  const list = document.getElementById('movements-list');
  const empty = document.getElementById('movements-empty');
  if (!list) return;
  const movs = getMovements();

  if (movs.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = movs.map(m => {
    const label = TYPE_LABEL[m.type] || m.type;
    const amount = formatAmount(m);
    return `
      <div class="movement-row">
        <div class="movement-info">
          <span class="movement-title">${escapeHTML(label)} — ${escapeHTML(m.symbol)}</span>
          <span class="movement-meta">${escapeHTML(m.name || '')}</span>
        </div>
        <span class="movement-amount">${amount}</span>
        <span class="movement-date">${formatDate(m.timestamp)}</span>
      </div>
    `;
  }).join('');
}

function formatAmount(m) {
  if (m.quantity == null) return '—';
  const qty = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(m.quantity);
  if (m.price != null) {
    const price = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: m.currency || 'USD', maximumFractionDigits: 2
    }).format(m.price);
    return `${qty} × ${price}`;
  }
  return qty;
}

function formatDate(ts) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts));
}

export function initMovements() {
  const exportBtn = document.getElementById('movements-export');
  exportBtn?.addEventListener('click', exportCSV);

  const clearBtn = document.getElementById('movements-clear');
  clearBtn?.addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de movimientos?')) {
      clearMovements();
      toast('Historial borrado', 'info');
      renderMovements();
    }
  });
}

function exportCSV() {
  const movs = getMovements();
  if (movs.length === 0) {
    toast('No hay movimientos para exportar', 'warn');
    return;
  }
  const header = ['Fecha', 'Hora', 'Tipo', 'Activo', 'Nombre', 'Tipo de instrumento', 'Cantidad', 'Precio', 'Moneda'];
  const rows = movs.map(m => {
    const d = new Date(m.timestamp);
    return [
      d.toLocaleDateString('es-AR'),
      d.toLocaleTimeString('es-AR'),
      TYPE_LABEL[m.type] || m.type,
      m.symbol,
      m.name || '',
      m.quoteType || '',
      m.quantity != null ? String(m.quantity).replace('.', ',') : '',
      m.price != null ? String(m.price).replace('.', ',') : '',
      m.currency || '',
    ];
  });
  const csv = [header, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-mind-movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Movimientos exportados', 'success');
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
