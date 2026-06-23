import { computeHoldings } from '../portfolio.js';
import { removeAsset } from '../state.js';

let pieChart = null;
let barChart = null;

const CHART_COLORS = [
  '#1C8AFF', '#00BCD4', '#00E676', '#F4B400', '#DB4437',
  '#9C27B0', '#FF6D00', '#00B0FF', '#76FF03', '#FF4081'
];

export function renderDashboard() {
  const { rows, summary } = computeHoldings();
  renderSummary(summary);
  renderHoldings(rows);
  renderCharts(rows);
}

function renderSummary(s) {
  document.getElementById('sum-value-ars').textContent = formatARS(s.totalValueARS);
  document.getElementById('sum-value-usd').textContent = formatUSD(s.totalValueUSD);
  const pnl = document.getElementById('sum-pnl');
  pnl.textContent = `${s.totalPnL >= 0 ? '+' : ''}${formatARS(s.totalPnL)}`;
  pnl.className = 'value mono ' + (s.totalPnL >= 0 ? 'pnl-pos' : 'pnl-neg');
  const pct = document.getElementById('sum-pnl-pct');
  pct.textContent = `${s.totalPnLPct >= 0 ? '+' : ''}${s.totalPnLPct.toFixed(2)}%`;
  pct.className = 'delta mono ' + (s.totalPnL >= 0 ? 'pos' : 'neg');
  document.getElementById('sum-count').textContent = String(s.count);
}

function renderHoldings(rows) {
  const tbody = document.getElementById('holdings-body');
  const emptyState = document.getElementById('holdings-empty');
  if (rows.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <div class="ticker-cell">
          <div>
            <div class="ticker-symbol">${r.symbol}</div>
            <div class="ticker-name">${escapeHTML(r.name || '')}</div>
          </div>
        </div>
      </td>
      <td><span class="type-badge" data-type="${r.quoteType || 'EQUITY'}">${shortType(r.quoteType)}</span></td>
      <td>${formatNum(r.quantity)}</td>
      <td>${formatPrice(r.avgPrice, r.currency)}</td>
      <td>${formatPrice(r.price, r.currency)}</td>
      <td>${formatARS(r.valueARS)}</td>
      <td>${r.weight.toFixed(1)}%</td>
      <td class="${r.pnlNative >= 0 ? 'pnl-pos' : 'pnl-neg'}">
        ${r.pnlNative >= 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%
      </td>
      <td class="${r.changePercent >= 0 ? 'pnl-pos' : 'pnl-neg'}">
        ${r.changePercent >= 0 ? '+' : ''}${r.changePercent.toFixed(2)}%
      </td>
      <td><button class="delete-btn" data-id="${r.id}" aria-label="Eliminar">×</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => removeAsset(btn.dataset.id));
  });
}

function renderCharts(rows) {
  const Chart = window.Chart;
  if (!Chart) return;

  const pieCanvas = document.getElementById('chart-pie');
  const barCanvas = document.getElementById('chart-bar');
  if (!pieCanvas || !barCanvas) return;

  if (rows.length === 0) {
    pieChart?.destroy(); pieChart = null;
    barChart?.destroy(); barChart = null;
    return;
  }

  const labels = rows.map(r => r.symbol);
  const values = rows.map(r => r.valueARS);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(pieCanvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#15161a', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#a0a0a0', font: { family: 'Space Grotesk' } } },
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
        backgroundColor: rows.map(r => r.pnlPct >= 0 ? 'rgba(0,230,118,0.7)' : 'rgba(255,23,68,0.7)'),
        borderColor: rows.map(r => r.pnlPct >= 0 ? '#00E676' : '#FF1744'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: rows.length > 6 ? 'y' : 'x',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#a0a0a0' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function formatARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
}
function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);
}
function formatPrice(n, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n || 0);
}
function formatNum(n) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(n || 0);
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
