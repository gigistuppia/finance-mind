import { computeHoldings } from '../portfolio.js';
import { logoImg } from '../logos.js';
import { toast } from './toast.js';

let xlsxLibPromise = null;
let jspdfLibPromise = null;

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

async function ensureJsPdfLib() {
  if (window.jspdf) return window.jspdf;
  if (jspdfLibPromise) return jspdfLibPromise;
  jspdfLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.async = true;
    s.onload = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
      s2.async = true;
      s2.onload = () => resolve(window.jspdf);
      s2.onerror = reject;
      document.head.appendChild(s2);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return jspdfLibPromise;
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
  const toggleBtn = document.getElementById('assets-export-btn');
  const overlay = document.getElementById('export-overlay');
  const closeBtn = document.getElementById('export-overlay-close');
  const backdrop = document.getElementById('export-overlay-backdrop');

  const openOverlay = () => overlay?.classList.add('open');
  const closeOverlay = () => overlay?.classList.remove('open');

  toggleBtn?.addEventListener('click', openOverlay);
  closeBtn?.addEventListener('click', closeOverlay);
  backdrop?.addEventListener('click', closeOverlay);

  overlay?.addEventListener('click', (e) => {
    const option = e.target.closest('.export-option');
    if (!option) return;
    const format = option.dataset.format;
    closeOverlay();
    if (format === 'xlsx') exportXLSX();
    else if (format === 'csv') exportCSV();
    else if (format === 'pdf') exportPDF();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay();
  });
}

function getExportData() {
  const { rows } = computeHoldings();
  if (rows.length === 0) {
    toast('No hay activos para exportar', 'warn');
    return null;
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
  return { data, today, fechaCorte, rows };
}

async function exportXLSX() {
  const result = getExportData();
  if (!result) return;
  const { data, today, fechaCorte, rows } = result;

  toast('Generando Excel…', 'info');

  let XLSX;
  try {
    XLSX = await ensureXlsxLib();
  } catch {
    toast('No se pudo cargar el módulo de Excel', 'error');
    return;
  }

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

function exportCSV() {
  const result = getExportData();
  if (!result) return;
  const { data, today } = result;

  toast('Generando CSV…', 'info');

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    ),
  ];

  const blob = new Blob(['﻿' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-mind-activos-${today.toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV descargado', 'success');
}

async function exportPDF() {
  const result = getExportData();
  if (!result) return;
  const { data, today, fechaCorte, rows } = result;

  toast('Generando PDF…', 'info');

  let jspdfMod;
  try {
    jspdfMod = await ensureJsPdfLib();
  } catch {
    toast('No se pudo cargar el módulo de PDF', 'error');
    return;
  }

  const { jsPDF } = jspdfMod;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(20);
  doc.setTextColor(28, 138, 255);
  doc.text('Finance Mind', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(160, 160, 160);
  doc.text(`Reporte de activos — ${fechaCorte}`, 14, 25);

  const totalInvested = data.reduce((s, r) => s + r['Dinero invertido'], 0);
  const totalValue = data.reduce((s, r) => s + r['Valor actual'], 0);
  const totalPnl = totalValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(2) : '0.00';

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Activos: ${rows.length}  |  Invertido: $${totalInvested.toFixed(2)}  |  Valor actual: $${totalValue.toFixed(2)}  |  P&L: $${totalPnl.toFixed(2)} (${totalPnlPct}%)`, 14, 31);

  const tableHeaders = ['Ticker', 'Etiqueta', 'Tipo', 'Moneda', 'Cant.', 'P. Compra', 'P. Actual', 'Invertido', 'Valor actual', 'P&L', 'P&L %'];
  const tableBody = data.map(r => [
    r['Ticker'],
    r['Etiqueta'].length > 25 ? r['Etiqueta'].slice(0, 25) + '…' : r['Etiqueta'],
    r['Tipo'],
    r['Moneda'],
    r['Cantidad'],
    r['Precio de compra'].toFixed(2),
    r['Precio actual'].toFixed(2),
    r['Dinero invertido'].toFixed(2),
    r['Valor actual'].toFixed(2),
    r['Ganancia / Pérdida'].toFixed(2),
    r['P&L %'].toFixed(2) + '%',
  ]);

  doc.autoTable({
    startY: 36,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [220, 220, 220],
      fillColor: [26, 26, 26],
      lineColor: [60, 60, 60],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [28, 138, 255],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [34, 34, 34],
    },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 9) {
        const val = parseFloat(hookData.cell.raw);
        if (val > 0) hookData.cell.styles.textColor = [0, 230, 118];
        else if (val < 0) hookData.cell.styles.textColor = [255, 23, 68];
      }
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Generado por Finance Mind', 14, doc.internal.pageSize.height - 8);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 8);
  }

  doc.save(`finance-mind-activos-${today.toISOString().slice(0, 10)}.pdf`);
  toast('PDF descargado', 'success');
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
