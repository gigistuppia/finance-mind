import { computeHoldings } from '../portfolio.js';
import { removeAsset } from '../state.js';
import { toast } from './toast.js';
import { logoImg } from '../logos.js';

let pieChart = null;
let barChart = null;
let lastChartSignature = '';
let chartLibPromise = null;
let prevPrices = new Map(); // symbol -> last seen price (for flash effect)

const CHART_COLORS = [
  '#7C8AFF', '#5BC9FF', '#22D67A', '#F5C518', '#FF4D5E',
  '#A78BFA', '#FF8A4C', '#34D399', '#F472B6', '#94A3B8'
];

const SORTABLE_COLS = [
  { key: 'symbol',        label: 'Activo',       th: 0, type: 'str',  default: 'asc' },
  { key: 'quoteType',     label: 'Tipo',         th: 1, type: 'str' },
  { key: 'quantity',      label: 'Cantidad',     th: 2, type: 'num' },
  { key: 'avgPrice',      label: 'Precio compra',th: 3, type: 'num' },
  { key: 'price',         label: 'Precio actual',th: 4, type: 'num' },
  { key: 'valueARS',      label: 'Valor ARS',    th: 5, type: 'num', default: 'desc' },
  { key: 'weight',        label: 'Peso',         th: 6, type: 'num' },
  { key: 'pnlPct',        label: 'P&L',          th: 7, type: 'num' },
  { key: 'changePercent', label: 'Día',          th: 8, type: 'num' },
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
      // Trigger re-render via state subscribe (no-op directly, dashboard.renderDashboard handles it)
      renderDashboard();
    });
  });
  sortableBound = true;
}

function updateSortIndicators() {
  document.querySelectorAll('.holdings thead th.sortable').forEach((th, i) => {
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
  document.querySelectorAll('.hfilter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      holdingsFilter = btn.dataset.filter;
      document.querySelectorAll('.hfilter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === holdingsFilter)
      );
      renderDashboard();
    });
  });
  filterBound = true;
}

function filterRows(rows) {
  if (holdingsFilter === 'USD') return rows.filter(r => r.currency !== 'ARS');
  if (holdingsFilter === 'ARS') return rows.filter(r => r.currency === 'ARS');
  return rows;
}

function updateValueColHeader() {
  const col = SORTABLE_COLS.find(c => c.key === 'valueARS');
  if (!col) return;
  const th = document.querySelectorAll('.holdings thead th')[col.th];
  if (!th) return;
  const label = holdingsFilter === 'USD' ? 'Valor USD' : 'Valor ARS';
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

export function renderDashboard() {
  const { rows, summary } = computeHoldings();

  const allMissing = rows.length > 0 && rows.every(r => !r.price);
  toggleSummarySkeleton(allMissing);

  const sorted = sortRows(rows);
  const filtered = filterRows(sorted);

  bindFilter();
  bindSortable();
  updateSortIndicators();
  updateValueColHeader();

  renderSummary(summary);
  renderHoldings(filtered);
  renderCards(filtered);
  trackPriceFlash(sorted);
  renderCharts(sorted);
}

function toggleSummarySkeleton(loading) {
  document.querySelectorAll('.summary-card').forEach(c => {
    c.classList.toggle('is-skeleton', loading);
  });
}

function renderSummary(s) {
  // Si no hay CCL real todavía, mostrar skeleton/guión en métricas ARS
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
    const priceDisplay = r.price != null
      ? formatPrice(r.displayPrice ?? r.price, r.currency)
      : '<span class="skeleton" style="display:inline-block;width:60px;height:14px;"></span>';
    const marketBadge = r.marketState === 'PRE'
      ? ' <span class="market-badge pre" title="Horario pre-market">PRE</span>'
      : (r.marketState === 'POST' || r.marketState === 'POSTPOST')
        ? ' <span class="market-badge post" title="Horario post-market">POST</span>'
        : '';
    const staleTitle = r.quoteAge != null && r.quoteAge > 5 * 60_000
      ? ` title="Cotización de hace ${Math.round(r.quoteAge / 60_000)} min"`
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
      <td>${formatPrice(r.avgPrice, r.currency)}</td>
      <td class="price-cell${r.quoteAge != null && r.quoteAge > 5 * 60_000 ? ' stale' : ''}" data-symbol="${r.symbol}"${staleTitle}>${priceDisplay}${marketBadge}</td>
      <td>${holdingsFilter === 'USD' ? formatUSD(r.valueUSD) : formatARS(r.valueARS)}</td>
      <td>${r.weight.toFixed(1)}%</td>
      <td class="${pctClass(r.pnlPct)}">${formatPct(r.pnlPct)}</td>
      <td class="${pctClass(r.changePercent)}">${formatPct(r.changePercent)}</td>
      <td><button class="delete-btn" data-id="${r.id}" data-symbol="${r.symbol}" aria-label="Eliminar">×</button></td>
    </tr>
  `;}).join('');

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symbol;
      removeAsset(btn.dataset.id);
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
    if (e.target.closest('.delete-btn')) return;
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
    const pnlArrow = r.pnlPct == null ? '' : (parseFloat(r.pnlPct.toFixed(2)) >= 0 ? '▲' : '▼');
    const pnlCls = r.pnlPct == null ? '' : pctClass(r.pnlPct);
    return `
    <div class="holding-card hc ${isOpen ? 'expanded' : ''}" data-symbol="${r.symbol}">
      <button class="hc-main" aria-expanded="${isOpen}">
        ${logoImg(r.symbol, r.quoteType, 36)}
        <div class="ticker-info">
          <div class="ticker-symbol mono">${r.symbol}</div>
          <div class="ticker-name">${escapeHTML(r.name || '')}</div>
        </div>
        <div class="hc-right">
          <span class="hc-value">${holdingsFilter === 'USD' ? formatUSD(r.valueUSD) : formatARS(r.valueARS)}</span>
          <span class="hc-pnl ${pnlCls}">${pnlArrow} ${formatPct(r.pnlPct)}</span>
        </div>
        <svg class="hc-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="hc-details">
        <div class="hc-details-inner">
          <div class="hc-details-grid">
            <div class="hc-detail">
              <span class="label">Precio actual</span>
              <span class="v price-cell" data-symbol="${r.symbol}">${formatPrice(r.displayPrice ?? r.price, r.currency)}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Cantidad</span>
              <span class="v">${formatNum(r.quantity)}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Precio compra</span>
              <span class="v">${formatPrice(r.avgPrice, r.currency)}</span>
            </div>
            <div class="hc-detail">
              <span class="label">Variación día</span>
              <span class="v ${pctClass(r.changePercent)}">${formatPct(r.changePercent)}</span>
            </div>
            <button class="hc-delete delete-btn" data-id="${r.id}" data-symbol="${r.symbol}">Eliminar del portfolio</button>
          </div>
        </div>
      </div>
    </div>
  `;
  }).join('');

  cards.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symbol;
      expandedCards.delete(sym);
      removeAsset(btn.dataset.id);
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
        // restart animation
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

  // Firma para evitar rebuilds innecesarios
  const signature = rows.map(r => `${r.symbol}:${r.valueARS.toFixed(0)}:${r.pnlPct.toFixed(2)}`).join('|');
  if (signature === lastChartSignature && pieChart && barChart) return;
  lastChartSignature = signature;

  let Chart;
  try { Chart = await ensureChartLib(); } catch { return; }
  if (!Chart) return;

  const labels = rows.map(r => r.symbol);
  const values = rows.map(r => r.valueARS);
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
        label: 'P&L %',
        data: rows.map(r => r.pnlPct),
        backgroundColor: rows.map(r => r.pnlPct >= 0 ? 'rgba(34,214,122,0.7)' : 'rgba(255,77,94,0.7)'),
        borderColor: rows.map(r => r.pnlPct >= 0 ? '#22D67A' : '#FF4D5E'),
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
  // Decimales dinámicos según magnitud del precio (crypto < $0.01 necesita 8 decimales)
  const abs = Math.abs(n);
  const decimals = abs > 0 && abs < 0.01 ? 8 : abs > 0 && abs < 1 ? 4 : 2;
  // GBp (peniques) no es un código ISO válido — mostrar como GBP
  const intlCur = currency === 'GBp' ? 'GBP' : (currency || 'USD');
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: intlCur,
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
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

/** Formatea un porcentaje con signo. null → '—'. Evita '−0.00%' decidiendo signo post-redondeo. */
function formatPct(n) {
  if (n == null) return '—';
  const v = parseFloat(n.toFixed(2));
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Clase CSS para un porcentaje. null → '' (color neutro). */
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
