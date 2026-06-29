import { computeHoldings } from '../portfolio.js';
import { logoImg } from '../logos.js';
import { toast } from './toast.js';

let xlsxLibPromise = null;

async function ensureXlsxLib() {
  if (window.XLSX) return window.XLSX;
  if (xlsxLibPromise) return xlsxLibPromise;
  xlsxLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return xlsxLibPromise;
}

const TYPE_LABEL = {
  EQUITY: 'Acción', ETF: 'ETF', CRYPTOCURRENCY: 'Cripto',
  CURRENCY: 'Forex', INDEX: 'Índice', FUTURE: 'Commodity', MUTUALFUND: 'Fondo',
};

export function renderAssets() {
  const list = document.getElementById('assets-list');
  const empty = document.getElementById('assets-empty');
  if (!list) return;

  const { rows } = computeHoldings();
  if (rows.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = rows.map(r => {
    const invested = r.quantity * r.avgPrice;
    const currentValue = (r.price || r.avgPrice) * r.quantity;
    const pnl = currentValue - invested;
    const pnlCls = pnl >= 0 ? 'pos' : 'neg';
    const sign = pnl >= 0 ? '+' : '';
    const cur = r.currency || 'USD';
    return `
      <div class="asset-row" data-symbol="${r.symbol}">
        ${logoImg(r.symbol, r.quoteType, 36)}
        <div class="ticker-info">
          <div class="ticker-symbol">${r.symbol}</div>
          <div class="ticker-name">${escapeHTML(r.name || '')}</div>
        </div>
        <div class="asset-meta">
          <span class="lbl">Tipo</span>
          <span class="type-badge" data-type="${r.quoteType || 'EQUITY'}">${TYPE_LABEL[r.quoteType] || 'Otro'}</span>
        </div>
        <div class="asset-meta">
          <span class="lbl">Invertido</span>
          <span class="v">${formatCurrency(invested, cur)}</span>
        </div>
        <div class="asset-meta">
          <span class="lbl">Precio compra</span>
          <span class="v">${formatCurrency(r.avgPrice, cur)}</span>
        </div>
        <div class="asset-meta">
          <span class="lbl">Ganancia / Pérdida</span>
          <span class="v ${pnlCls}">${sign}${formatCurrency(pnl, cur)}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function initAssets() {
  const btn = document.getElementById('assets-export-xlsx');
  btn?.addEventListener('click', exportXLSX);
}

async function exportXLSX() {
  const { rows } = computeHoldings();
  if (rows.length === 0) {
    toast('No hay activos para exportar', 'warn');
    return;
  }

  toast('Generando Excel…', 'info');

  let XLSX;
  try {
    XLSX = await ensureXlsxLib();
  } catch {
    toast('No se pudo cargar el módulo de Excel', 'error');
    return;
  }

  const today = new Date();
  const fechaCorte = today.toLocaleDateString('es-AR');

  const data = rows.map(r => {
    const invested = r.quantity * r.avgPrice;
    const currentValue = (r.price || r.avgPrice) * r.quantity;
    const pnl = currentValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return {
      'Ticker': r.symbol,
      'Etiqueta': r.name || '',
      'Tipo': TYPE_LABEL[r.quoteType] || 'Otro',
      'Moneda': r.currency || 'USD',
      'Cantidad': r.quantity,
      'Precio de compra': r.avgPrice,
      'Precio actual': r.price || r.avgPrice,
      'Dinero invertido': Number(invested.toFixed(2)),
      'Valor actual': Number(currentValue.toFixed(2)),
      'Ganancia / Pérdida': Number(pnl.toFixed(2)),
      'P&L %': Number(pnlPct.toFixed(2)),
      'Fecha de corte': fechaCorte,
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
    { wch: 10 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Activos');

  const totals = [
    { Concepto: 'Activos en cartera', Valor: rows.length },
    { Concepto: 'Total invertido', Valor: Number(data.reduce((s, r) => s + r['Dinero invertido'], 0).toFixed(2)) },
    { Concepto: 'Valor actual total', Valor: Number(data.reduce((s, r) => s + r['Valor actual'], 0).toFixed(2)) },
    { Concepto: 'Ganancia/Pérdida total', Valor: Number(data.reduce((s, r) => s + r['Ganancia / Pérdida'], 0).toFixed(2)) },
    { Concepto: 'Fecha de corte', Valor: fechaCorte },
    { Concepto: 'Generado por', Valor: 'Finance Mind' },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(totals);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  XLSX.writeFile(wb, `finance-mind-activos-${today.toISOString().slice(0, 10)}.xlsx`);
  toast('Excel descargado', 'success');
}

function formatCurrency(n, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2
  }).format(n || 0);
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
