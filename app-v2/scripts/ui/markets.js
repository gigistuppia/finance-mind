import { getQuotes } from '../api.js';
import { logoImg } from '../logos.js';

const CATEGORIES = [
  {
    key: 'us-tech',
    label: 'Acciones US — Tech',
    symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD']
  },
  {
    key: 'us-finance',
    label: 'Acciones US — Finanzas',
    symbols: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'BRK-B']
  },
  {
    key: 'global',
    label: 'Acciones Globales',
    symbols: ['SAP.DE', 'ASML', 'NVO', 'TM', 'BABA', 'TSM', 'SHEL', 'HSBC', 'MC.PA', 'NESN.SW', 'AZN', 'TTE', 'BHP', 'RIO']
  },
  {
    key: 'crypto',
    label: 'Crypto',
    symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'AVAX-USD']
  },
  {
    key: 'etfs',
    label: 'ETFs populares',
    symbols: ['SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'EEM', 'ARKK', 'SCHD']
  },
  {
    key: 'indices',
    label: 'Índices',
    symbols: ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX', '^MERV']
  },
  {
    key: 'commodities',
    label: 'Commodities',
    symbols: ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', 'PL=F', 'PA=F', 'ZW=F', 'ZS=F', 'ZC=F', 'KC=F', 'CC=F', 'SB=F', 'CT=F']
  },
  {
    key: 'forex',
    label: 'Forex',
    symbols: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'USDARS=X', 'USDBRL=X', 'USDMXN=X']
  },
];

let initialized = false;
let onSelectAsset = null;
let onAddToWatchlist = null;

export function initMarkets({ onSelect, onWatch }) {
  onSelectAsset = onSelect;
  onAddToWatchlist = onWatch;
  const container = document.getElementById('market-categories');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => `
    <div class="market-cat" data-cat="${c.key}">
      <div class="market-cat-head">
        <h3>${c.label}</h3>
        <span class="mono" style="color:var(--color-text-3);font-size:0.7rem;">${c.symbols.length} activos</span>
      </div>
      <div class="market-cat-grid" id="market-cat-${c.key}">
        ${c.symbols.map(s => `<div class="holding-card skeleton" data-symbol="${s}"><div class="holding-card-head"><span class="ticker-symbol mono">${s}</span></div></div>`).join('')}
      </div>
    </div>
  `).join('');

  initialized = true;
}

export async function loadMarkets() {
  if (!initialized) return;
  await Promise.all(CATEGORIES.map(async (cat) => {
    const quotes = await getQuotes(cat.symbols);
    renderCategory(cat, quotes);
  }));
}

function renderCategory(cat, quotes) {
  const body = document.getElementById(`market-cat-${cat.key}`);
  if (!body) return;
  body.innerHTML = cat.symbols.map(s => {
    const q = quotes[s];
    const logo = logoImg(s, q?.quoteType, 32);
    const name = q?.name || s;
    const type = shortType(q?.quoteType);
    if (!q) return `
      <div class="holding-card" data-symbol="${s}">
        <div class="holding-card-head">
          <div class="ticker-cell">${logo}<div class="ticker-info"><div class="ticker-symbol mono">${s}</div><div class="ticker-name">${name}</div></div></div>
          <span class="type-badge" data-type="EQUITY">${type}</span>
        </div>
        <div class="holding-card-row"><span class="label">Precio</span><span class="v">—</span></div>
        <div class="holding-card-row"><span class="label">Variación</span><span class="v">—</span></div>
        <div class="holding-card-actions">
          <button class="icon-btn" data-action="watch" data-symbol="${s}" title="Agregar a watchlist">★</button>
          <button class="icon-btn primary" data-action="add" data-symbol="${s}" title="Agregar al portfolio">+</button>
        </div>
      </div>`;
    const chgClass = q.changePercent >= 0 ? 'pnl-pos' : 'pnl-neg';
    const sign = q.changePercent >= 0 ? '+' : '';
    return `
      <div class="holding-card" data-symbol="${s}">
        <div class="holding-card-head">
          <div class="ticker-cell">${logo}<div class="ticker-info"><div class="ticker-symbol mono">${s}</div><div class="ticker-name">${escapeHTML(name)}</div></div></div>
          <span class="type-badge" data-type="${q.quoteType || 'EQUITY'}">${type}</span>
        </div>
        <div class="holding-card-row"><span class="label">Precio</span><span class="v mono">${formatPrice(q.price, q.currency)}</span></div>
        <div class="holding-card-row"><span class="label">Variación</span><span class="v mono ${chgClass}">${sign}${q.changePercent.toFixed(2)}%</span></div>
        ${q.dayLow ? `<div class="holding-card-row"><span class="label">Día</span><span class="v mono">${formatPrice(q.dayLow, q.currency)} / ${formatPrice(q.dayHigh, q.currency)}</span></div>` : ''}
        <div class="holding-card-actions">
          <button class="icon-btn" data-action="watch" data-symbol="${s}" title="Agregar a watchlist">★</button>
          <button class="icon-btn primary" data-action="add" data-symbol="${s}" title="Agregar al portfolio">+</button>
        </div>
      </div>
    `;
  }).join('');

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sym = btn.dataset.symbol;
      const q = quotes[sym];
      const item = {
        symbol: sym,
        name: q?.name || sym,
        quoteType: q?.quoteType || 'EQUITY',
        exchange: q?.exchange || '',
        currency: q?.currency || 'USD',
      };
      if (btn.dataset.action === 'watch') onAddToWatchlist?.(item);
      else onSelectAsset?.(item);
    });
  });
}

function shortType(t) {
  return ({ EQUITY: 'STOCK', ETF: 'ETF', CRYPTOCURRENCY: 'CRYPTO', CURRENCY: 'FX', INDEX: 'INDEX', FUTURE: 'FUT', MUTUALFUND: 'FUND' })[t] || 'OTHER';
}
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatPrice(n, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n || 0);
}
