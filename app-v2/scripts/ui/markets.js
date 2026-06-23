import { getQuotes } from '../api.js';

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
    symbols: ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'ZC=F']
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
      <div class="market-cat-body" id="market-cat-${c.key}">
        ${c.symbols.map(s => `<div class="market-row skeleton" data-symbol="${s}">${s}</div>`).join('')}
      </div>
    </div>
  `).join('');

  initialized = true;
}

export async function loadMarkets() {
  if (!initialized) return;
  for (const cat of CATEGORIES) {
    const quotes = await getQuotes(cat.symbols);
    renderCategory(cat, quotes);
  }
}

function renderCategory(cat, quotes) {
  const body = document.getElementById(`market-cat-${cat.key}`);
  if (!body) return;
  body.innerHTML = cat.symbols.map(s => {
    const q = quotes[s];
    if (!q) return `<div class="market-row" data-symbol="${s}"><span class="mono">${s}</span><span style="color:var(--color-text-3);">—</span></div>`;
    const chgClass = q.changePercent >= 0 ? 'pnl-pos' : 'pnl-neg';
    const sign = q.changePercent >= 0 ? '+' : '';
    return `
      <div class="market-row" data-symbol="${s}">
        <div class="mr-sym">
          <span class="mono" style="font-weight:700;">${s}</span>
        </div>
        <div class="mr-price mono">${formatPrice(q.price, q.currency)}</div>
        <div class="mr-chg mono ${chgClass}">${sign}${q.changePercent.toFixed(2)}%</div>
        <div class="mr-actions">
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

function formatPrice(n, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n || 0);
}
