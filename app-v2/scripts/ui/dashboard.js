import { computeHoldings } from '../portfolio.js';
import { removeAsset, getState } from '../state.js';
import { toast } from './toast.js';
import { logoImg } from '../logos.js';

let addAssetUIRef = null;
export function setAddAssetUI(ui) { addAssetUIRef = ui; }

// Abre el modal de edición pre-llenado con la posición actual del símbolo
function openEditFor(sym, rows) {
  const row = rows.find(r => r.symbol === sym);
  if (!row || !addAssetUIRef?.openEdit) return;
  const txCount = getState().transactions.filter(t => t.symbol === sym).length;
  addAssetUIRef.openEdit({
    symbol: row.symbol, name: row.name, quoteType: row.quoteType,
    exchange: row.exchange, currency: row.currency,
    quantity: row.quantity, avgPrice: row.avgPrice,
    firstBuyDate: row.firstBuyDate, txCount,
  });
}

let pieChart = null;
let barChart = null;
let lastChartSignature = '';
let chartLibPromise = null;
let prevPrices = new Map();

let pnlMode = localStorage.getItem('fm2_pnl_mode') || 'native'; // 'native' | 'arsReal'

const CHART_COLORS = [
  '#7C8AFF', '#5BC9FF', '#22D67A', '#F5C518', '#FF4D5E',
  '#A78BFA', '#FF8A4C', '#34D399', '#F472B6', '#94A3B8'
];

const SORTABLE_COLS = [
  { key: 'symbol',        label: 'Activo',        th: 0, type: 'str',  default: 'asc' },
  { key: 'quoteType',     label: 'Tipo',          th: 1, type: 'str' },
  { key: 'quantity',      label: 'Cantidad',      th: 2, type: 'num' },
  { key: 'avgPrice',      label: 'Precio compra', th: 3, type: 'num' },
  { key: 'price',         label: 'Precio actual', th: 4, type: 'num' },
  { key: 'valueARS',      label: 'Valor ARS',     th: 5, type: 'num', default: 'desc' },
  { key: 'weight',        label: 'Peso',          th: 6, type: 'num' },
  { key: 'pnlPct',        label: 'P&L',           th: 7, type: 'num' },
  { key: 'changePercent', label: 'Día',           th: 8, type: 'num' },
];

let sortKey = 'valueARS';
let sortDir = 'desc';

const mobileMq = window.matchMedia('(max-width: 768px)');
mobileMq.addEventListener('change', () => {
  lastChartSignature = '';
  renderDashboard();
});
let sortableBound = false;
let holdingsFilter = 'all';
let filterBound = false;
let pnlToggleBound = false;

function bindSortable() {
  if (sortableBound) return;
  const ths = document.querySelectorAll('.holdings thead th');
  SORTABLE_COLS.forEach(col => {
    const th = ths[col.th];
    if (!th) return;
    th.classList.add('sortable');
    th.innerHTML = `${col.label}<span class="sort-arrow"></span>`;
    th.addEventListener('click', () => {
      if (sortKey === col.key) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey = col.key;
        sortDir = col.default || (col.type === 'num' ? 'desc' : 'asc');
      }
      renderDashboard();
    });
  });
  sortableBound = true;
}

function updateSortIndicators() {
  document.querySelectorAll('.holdings thead th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  const col = SORTABLE_COLS.find(c => c.key === sortKey);
  if (col) {
    const ths = document.querySelectorAll('.holdings thead th');
    ths[col.th]?.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
  }
}

function bindFilter() {
  if (filterBound) return;
  document.querySelectorAll('.hfilter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      holdingsFilter = btn.dataset.filter;
      document.querySelectorAll('.hfilter-btn[data-filter]').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === holdingsFilter)
      );
      renderDashboard();
    });
  });
  filterBound = true;
}

function bindPnlModeToggle() {
  if (pnlToggleBound) return;
  const toggle = document.getElementById('pnl-mode-toggle');
  if (!toggle) return;
  updatePnlToggleLabel(toggle);
  toggle.addEventListener('click', () => {
    pnlMode = pnlMode === 'native' ? 'arsReal' : 'native';
    localStorage.setItem('fm2_pnl_mode', pnlMode);
    updatePnlToggleLabel(toggle);
    renderDashboard();
  });
  pnlToggleBound = true;
}

function updatePnlToggleLabel(btn) {
  if (!btn) return;
  btn.textContent = pnlMode === 'arsReal' ? 'P&L nativo' : 'ARS real';
  btn.classList.toggle('active', pnlMode === 'arsReal');
}

// Modo de moneda para la vista: null = nativa de cada activo, 'USD' o 'ARS' = todo convertido
function displayMode() {
  if (holdingsFilter === 'USD') return 'USD';
  if (holdingsFilter === 'ARS') return 'ARS';
  return null;
}

// Precio actual del activo en la moneda de vista
function displayPrice(r) {
  const mode = displayMode();
  if (mode == null) return { value: r.displayPrice ?? r.price, currency: r.currency };
  if (r.quantity > 0 && r.valueUSD != null && mode === 'USD') {
    return { value: r.valueUSD / r.quantity, currency: 'USD' };
  }
  if (r.quantity > 0 && r.valueARS != null && mode === 'ARS') {
    return { value: r.valueARS / r.quantity, currency: 'ARS' };
  }
  return { value: null, currency: mode };
}

// Precio promedio de compra en la moneda de vista (usa CCL actual, no histórico)
function displayAvgPrice(r) {
  const mode = displayMode();
  if (mode == null) return { value: r.avgPrice, currency: r.currency, hintARS: r.avgPriceInputARS };
  const { ccl } = getState();
  if (r.quantity > 0 && r.costARS != null && mode === 'ARS') {
    return { value: r.costARS / r.quantity, currency: 'ARS', hintARS: null };
  }
  if (r.quantity > 0 && r.costARS != null && ccl != null && ccl > 0 && mode === 'USD') {
    return { value: (r.costARS / ccl) / r.quantity, currency: 'USD', hintARS: null };
  }
  return { value: null, currency: mode, hintARS: null };
}

// Valor total actual del activo en la moneda de vista
function displayValue(r) {
  const mode = displayMode();
  if (mode === 'USD') return { value: r.valueUSD, currency: 'USD' };
  if (mode === 'ARS') return { value: r.valueARS, currency: 'ARS' };
  return { value: r.valueNative, currency: r.currency };
}

function formatValueCell(r) {
  const { value, currency } = displayValue(r);
  if (value == null) return '—';
  return currency === 'USD' ? formatUSD(value) : currency === 'ARS' ? formatARS(value) : formatPrice(value, currency);
}

function updateValueColHeader() {
  const col = SORTABLE_COLS.find(c => c.key === 'valueARS');
  if (!col) return;
  const th = document.querySelectorAll('.holdings thead th')[col.th];
  if (!th) return;
  const label = holdingsFilter === 'USD' ? 'Valor USD' : holdingsFilter === 'ARS' ? 'Valor ARS' : 'Valor';
  col.label = label;
  const arrowSpan = th.querySelector('.sort-arrow');
  th.textContent = label;
  if (arrowSpan) th.appendChild(arrowSpan);
}

function sortRows(rows) {
  const col = SORTABLE_COLS.find(c => c.key === sortKey);
  if (!col) return rows;
  const sorted = [...rows].sort((a, b) => {
    let va = a[col.key];
    let vb = b[col.key];
    if (col.type === 'str') {
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      return va < vb ? -1 : va > vb ? 1 : 0;
    }
    return (va || 0) - (vb || 0);
  });
  if (sortDir === 'desc') sorted.reverse();
  return sorted;
}

function getPnlPct(r) {
  if (pnlMode === 'arsReal') return r.pnlARSRealPct ?? r.pnlPct;
  return r.pnlPct;
}

export function renderDashboard() {
  const { rows, summary } = computeHoldings();

  const allMissing = rows.length > 0 && rows.every(r => !r.price);
  toggleSummarySkeleton(allMissing);

  const sorted = sortRows(rows);

  bindFilter();
  bindPnlModeToggle();
  bindSortable();
  updateSortIndicators();
  updateValueColHeader();

  renderSummary(summary);
  renderHoldings(sorted);
  renderCards(sorted);
  trackPriceFlash(sorted);
  renderCharts(sorted);
}

function toggleSummarySkeleton(loading) {
  document.querySelectorAll('.summary-card').forEach(c => {
    c.classList.toggle('is-skeleton', loading);
  });
}

function renderSummary(s) {
  const arsReady = s.hasCCL;
  setText('sum-value-ars', s.count > 0 ? (arsReady ? formatARS(s.totalValueARS) : '—') : '$0');
  setText('sum-value-usd', s.count > 0 ? formatUSD(s.totalValueUSD) : '$0');

  const pnl = document.getElementById('sum-pnl');
  if (pnl) {
    if (s.count === 0) {
      pnl.textContent = '$0';
      pnl.className = 'value mono';
    } else if (!arsReady) {
      pnl.textContent = '—';
      pnl.className = 'value mono';
    } else {
      const v = s.totalPnL;
      pnl.textContent = `${v >= 0 ? '+' : ''}${formatARS(v)}`;
      pnl.className = 'value mono ' + (v >= 0 ? 'pnl-pos' : 'pnl-neg');
    }
  }

  const pct = document.getElementById('sum-pnl-pct');
  if (pct) {
    if (s.count === 0 || !arsReady) {
      pct.textContent = '';
      pct.className = 'delta mono';
    } else {
      pct.textContent = formatPct(s.totalPnLPct);
      pct.className = 'delta mono ' + pctClass(s.totalPnLPct);
    }
  }

  setText('sum-count', String(s.count));

  // P&L realizado (solo si hay ventas registradas)
  const realizedLine = document.getElementById('sum-realized-line');
  const realizedEl = document.getElementById('sum-realized-pnl');
  if (realizedLine && realizedEl) {
    const rp = s.totalRealizedPnL;
    if (rp && Math.abs(rp) > 0.001) {
      realizedLine.style.display = 'block';
      realizedEl.textContent = `${rp >= 0 ? '+' : ''}${formatUSD(rp)}`;
      realizedEl.className = 'value mono ' + (rp >= 0 ? 'pnl-pos' : 'pnl-neg');
    } else {
      realizedLine.style.display = 'none';
    }
  }
}

function renderHoldings(rows) {
  const tbody = document.getElementById('holdings-body');
  const emptyState = document.getElementById('holdings-empty');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) {
      emptyState.style.display = 'block';
      if (!emptyState.querySelector('.empty-cta')) {
        const cta = document.createElement('div');
        cta.className = 'empty-cta';
        cta.innerHTML = `<button class="btn primary" id="empty-add-btn">+ Agregar primer activo</button>`;
        emptyState.appendChild(cta);
        cta.querySelector('#empty-add-btn').addEventListener('click', () => {
          document.getElementById('search-trigger').click();
        });
      }
    }
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = rows.map(r => {
    const dp = displayPrice(r);
    const dap = displayAvgPrice(r);
    const priceDisplay = dp.value != null
      ? formatPrice(dp.value, dp.currency)
      : '<span class="skeleton" style="display:inline-block;width:60px;height:14px;"></span>';
    const marketBadge = r.marketState === 'PRE'
      ? ' <span class="market-badge pre" title="Horario pre-market">PRE</span>'
      : (r.marketState === 'POST' || r.marketState === 'POSTPOST')
        ? ' <span class="market-badge post" title="Horario post-market">POST</span>'
        : '';
    const staleTitle = r.quoteAge != null && r.quoteAge > 5 * 60_000
      ? ` title="Cotización de hace ${Math.round(r.quoteAge / 60_000)} min"`
      : '';
    const pnlVal = getPnlPct(r);
    const approxMark = pnlMode === 'arsReal' && r.fxApproximate
      ? ' <span title="FX histórico aproximado" style="color:var(--color-yellow);font-size:0.7rem;">~</span>'
      : '';
    return `
    <tr data-symbol="${r.symbol}">
      <td>
        <div class="ticker-cell">
          ${logoImg(r.symbol, r.quoteType, 36)}
          <div class="ticker-info">
            <div class="ticker-symbol">${r.symbol}</div>
            <div class="ticker-name">${escapeHTML(r.name || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="type-badge" data-type="${r.quoteType || 'EQUITY'}">${shortType(r.quoteType)}</span></td>
      <td>${formatNum(r.quantity)}</td>
      <td>${dap.value != null ? formatPrice(dap.value, dap.currency) : '—'}${dap.hintARS ? `<div class="price-ars-hint">${formatARS(dap.hintARS)}</div>` : ''}</td>
      <td class="price-cell${r.quoteAge != null && r.quoteAge > 5 * 60_000 ? ' stale' : ''}" data-symbol="${r.symbol}"${staleTitle}>${priceDisplay}${marketBadge}</td>
      <td>${formatValueCell(r)}</td>
      <td>${r.weight.toFixed(1)}%</td>
      <td class="${pctClass(pnlVal)}">${formatPct(pnlVal)}${approxMark}</td>
      <td class="${pctClass(r.changePercent)}">${formatPct(r.changePercent)}</td>
      <td class="row-actions">
        <button class="edit-btn" data-symbol="${r.symbol}" aria-label="Editar ${r.symbol}" title="Editar cantidad o precio">✎</button>
        <button class="sell-btn" data-symbol="${r.symbol}" aria-label="Vender ${r.symbol}" title="Registrar venta">↓</button>
        <button class="delete-btn" data-id="${r.id}" data-symbol="${r.symbol}" aria-label="Eliminar ${r.symbol}">×</button>
      </td>
    </tr>
  `;}).join('');

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditFor(btn.dataset.symbol, rows);
    });
  });

  tbody.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sym = btn.dataset.symbol;
      const row = rows.find(r => r.symbol === sym);
      if (!row || !addAssetUIRef) return;
      addAssetUIRef.openSell({
        symbol: row.symbol, name: row.name,
        quoteType: row.quoteType, exchange: row.exchange, currency: row.currency,
      });
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symbol;
      removeAsset(sym);
      toast(`${sym} eliminado del portfolio`, 'info');
    });
  });
}

const expandedCards = new Set();
let cardsToggleBound = false;

function bindCardsToggle() {
  if (cardsToggleBound) return;
  const cards = document.getElementById('holdings-cards');
  if (!cards) return;
  cards.addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn') || e.target.closest('.sell-btn') || e.target.closest('.edit-btn')) return;
    const main = e.target.closest('.hc-main');
    if (!main) return;
    const card = main.closest('.holding-card');
    const sym = card.dataset.symbol;
    const isOpen = card.classList.toggle('expanded');
    main.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) expandedCards.add(sym); else expandedCards.delete(sym);
  });
  cardsToggleBound = true;
}

function renderCards(rows) {
  const cards = document.getElementById('holdings-cards');
  if (!cards) return;
  if (rows.length === 0) { cards.innerHTML = ''; return; }
  bindCardsToggle();
  cards.innerHTML = rows.map(r => {
    const isOpen = expandedCards.has(r.symbol);
    const pnlVal = getPnlPct(r);
    const pnlArrow = pnlVal == null ? '' : (parseFloat(pnlVal.toFixed(2)) >= 0 ? '▲' : '▼');
    const pnlCls = pnlVal == null ? '' : pctClass(pnlVal);
    const approxMark = pnlMode === 'arsReal' && r.fxApproximate ? '~' : '';
    const dp = displayPrice(r);
    const dap = displayAvgPrice(r);
    return `
    <div class="holding-card hc ${isOpen ? 'expanded' : ''}" data-symbol="${r.symbol}">
      <button class="hc-main" aria-expanded="${isOpen}">
        ${logoImg(r.symbol, r.quoteType, 36)}
        <div class="ticker-info">
          <div class="ticker-symbol mono">${r.symbol}</div>
          <div class="ticker-name">${escapeHTML(r.name || '')}</div>
        </div>
        <div class="hc-right">
          <span class="hc-value">${formatValueCell(r)}</span>
          <span class="hc-pnl ${pnlCls}">${pnlArrow} ${formatPct(pnlVal)}${approxMark}</span>
        </div>
        <svg class="hc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="hc-details">
        <div class="hc-details-inner">
          <div class="hc-details-grid">
            <div class="hc-detail">
              <span class="label">Precio actual</span>
              <span class="v price-cell" data-symbol="${r.symbol}">${dp.value != null ? formatPrice(dp.value, dp.currency) : '—'}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Cantidad</span>
              <span class="v">${formatNum(r.quantity)}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Precio compra</span>
              <span class="v">${dap.value != null ? formatPrice(dap.value, dap.currency) : '—'}${dap.hintARS ? `<span class="price-ars-hint">${formatARS(dap.hintARS)}</span>` : ''}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Variación día</span>
              <span class="v ${pctClass(r.changePercent)}">${formatPct(r.changePercent)}</span>
            </div>
            <div class="hc-detail-actions">
              <button class="edit-btn hc-edit" data-symbol="${r.symbol}" aria-label="Editar ${r.symbol}">✎ Editar</button>
              <button class="sell-btn hc-sell" data-symbol="${r.symbol}" aria-label="Vender ${r.symbol}">↓ Vender</button>
              <button class="hc-delete delete-btn" data-id="${r.id}" data-symbol="${r.symbol}">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  cards.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditFor(btn.dataset.symbol, rows);
    });
  });

  cards.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sym = btn.dataset.symbol;
      const row = rows.find(r => r.symbol === sym);
      if (!row || !addAssetUIRef) return;
      addAssetUIRef.openSell({
        symbol: row.symbol, name: row.name,
        quoteType: row.quoteType, exchange: row.exchange, currency: row.currency,
      });
    });
  });

  cards.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symbol;
      expandedCards.delete(sym);
      removeAsset(sym);
      toast(`${sym} eliminado del portfolio`, 'info');
    });
  });
}

function trackPriceFlash(rows) {
  rows.forEach(r => {
    if (!r.price) return;
    const prev = prevPrices.get(r.symbol);
    if (prev != null && prev !== r.price) {
      const dir = r.price > prev ? 'up' : 'down';
      document.querySelectorAll(`.price-cell[data-symbol="${r.symbol}"]`).forEach(el => {
        el.classList.remove('cell-flash-up', 'cell-flash-down');
        void el.offsetWidth;
        el.classList.add(`cell-flash-${dir}`);
      });
    }
    prevPrices.set(r.symbol, r.price);
  });
}

async function ensureChartLib() {
  if (window.Chart) return window.Chart;
  if (chartLibPromise) return chartLibPromise;
  chartLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
    s.async = true;
    s.onload = () => resolve(window.Chart);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return chartLibPromise;
}

async function renderCharts(rows) {
  const pieCanvas = document.getElementById('chart-pie');
  const barCanvas = document.getElementById('chart-bar');
  if (!pieCanvas || !barCanvas) return;

  if (rows.length === 0) {
    pieChart?.destroy(); pieChart = null;
    barChart?.destroy(); barChart = null;
    lastChartSignature = '';
    return;
  }

  const pnlValues = rows.map(r => getPnlPct(r) ?? 0);
  const signature = rows.map((r, i) => `${r.symbol}:${(r.valueARS ?? 0).toFixed(0)}:${pnlValues[i].toFixed(2)}`).join('|') + pnlMode;
  if (signature === lastChartSignature && pieChart && barChart) return;
  lastChartSignature = signature;

  let Chart;
  try { Chart = await ensureChartLib(); } catch { return; }
  if (!Chart) return;

  const labels = rows.map(r => r.symbol);
  const values = rows.map(r => r.valueARS ?? 0);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCanvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#111114', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 360 },
      cutout: '65%',
      plugins: {
        legend: { position: mobileMq.matches ? 'bottom' : 'right', labels: { color: '#a0a0a0', font: { family: 'Space Grotesk' }, boxWidth: 12 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatARS(ctx.parsed)}` } }
      }
    }
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: pnlMode === 'arsReal' ? 'P&L ARS real %' : 'P&L %',
        data: pnlValues,
        backgroundColor: pnlValues.map(v => v >= 0 ? 'rgba(34,214,122,0.7)' : 'rgba(255,77,94,0.7)'),
        borderColor: pnlValues.map(v => v >= 0 ? '#22D67A' : '#FF4D5E'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 360 },
      indexAxis: rows.length > 6 ? 'y' : 'x',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function formatARS(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function formatUSD(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function formatPrice(n, currency) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const decimals = abs > 0 && abs < 0.01 ? 8 : abs > 0 && abs < 1 ? 4 : 2;
  const intlCur = currency === 'GBp' ? 'GBP' : (currency || 'USD');
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: intlCur,
      minimumFractionDigits: 2, maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return n.toFixed(decimals);
  }
}

function formatNum(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const decimals = abs > 0 && abs < 0.0001 ? 8 : 4;
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: decimals }).format(n);
}

function formatPct(n) {
  if (n == null) return '—';
  const v = parseFloat(n.toFixed(2));
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function pctClass(n) {
  if (n == null) return '';
  return parseFloat(n.toFixed(2)) >= 0 ? 'pnl-pos' : 'pnl-neg';
}

function shortType(t) {
  return ({
    EQUITY: 'STOCK', ETF: 'ETF', CRYPTOCURRENCY: 'CRYPTO',
    CURRENCY: 'FX', INDEX: 'INDEX', FUTURE: 'FUT', MUTUALFUND: 'FUND'
  })[t] || 'OTHER';
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
