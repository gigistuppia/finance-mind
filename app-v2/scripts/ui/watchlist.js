import { getState, removeFromWatchlist, setQuotes } from '../state.js';
import { getQuotes } from '../api.js';
import { toast } from './toast.js';

let prevPrices = new Map();

export function renderWatchlist() {
  const { watchlist, quotes } = getState();
  const tbody = document.getElementById('watchlist-body');
  const cards = document.getElementById('watchlist-cards');
  const empty = document.getElementById('watchlist-empty');
  if (!tbody) return;

  if (watchlist.length === 0) {
    tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      if (!empty.querySelector('.empty-cta')) {
        const cta = document.createElement('div');
        cta.className = 'empty-cta';
        cta.innerHTML = `<button class="btn primary" id="empty-watch-btn">+ Agregar a watchlist</button>`;
        empty.appendChild(cta);
        cta.querySelector('#empty-watch-btn').addEventListener('click', () => {
          document.getElementById('watchlist-add').click();
        });
      }
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = watchlist.map(w => {
    const q = quotes[w.symbol];
    const price = q?.price;
    const chg = q?.changePercent ?? 0;
    const chgClass = chg >= 0 ? 'pnl-pos' : 'pnl-neg';
    const sign = chg >= 0 ? '+' : '';
    return `
      <tr data-symbol="${w.symbol}">
        <td>
          <div class="ticker-cell">
            <div>
              <div class="ticker-symbol">${w.symbol}</div>
              <div class="ticker-name">${escapeHTML(w.name || '')}</div>
            </div>
          </div>
        </td>
        <td><span class="type-badge" data-type="${w.quoteType || 'EQUITY'}">${shortType(w.quoteType)}</span></td>
        <td class="price-cell" data-symbol="${w.symbol}">${price != null ? formatPrice(price, q.currency) : '<span class="skeleton" style="display:inline-block;width:60px;height:14px;"></span>'}</td>
        <td class="${chgClass}">${q ? sign + chg.toFixed(2) + '%' : '—'}</td>
        <td>${q && q.dayLow ? formatPrice(q.dayLow, q.currency) + ' / ' + formatPrice(q.dayHigh, q.currency) : '—'}</td>
        <td>${q && q.low52 ? formatPrice(q.low52, q.currency) + ' / ' + formatPrice(q.high52, q.currency) : '—'}</td>
        <td><button class="delete-btn" data-sym="${w.symbol}" aria-label="Quitar">×</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.sym;
      removeFromWatchlist(sym);
      toast(`${sym} removido de watchlist`, 'info');
    });
  });

  if (cards) {
    cards.innerHTML = watchlist.map(w => {
      const q = quotes[w.symbol];
      const price = q?.price;
      const chg = q?.changePercent ?? 0;
      const chgClass = chg >= 0 ? 'pnl-pos' : 'pnl-neg';
      const sign = chg >= 0 ? '+' : '';
      return `
        <div class="holding-card" data-symbol="${w.symbol}">
          <div class="holding-card-head">
            <div>
              <div class="ticker-symbol mono">${w.symbol}</div>
              <div class="ticker-name">${escapeHTML(w.name || '')}</div>
            </div>
            <span class="type-badge" data-type="${w.quoteType || 'EQUITY'}">${shortType(w.quoteType)}</span>
          </div>
          <div class="holding-card-row">
            <span class="label">Precio</span>
            <span class="v price-cell" data-symbol="${w.symbol}">${price != null ? formatPrice(price, q.currency) : '—'}</span>
          </div>
          <div class="holding-card-row">
            <span class="label">Variación</span>
            <span class="v ${chgClass}">${q ? sign + chg.toFixed(2) + '%' : '—'}</span>
          </div>
          <div class="holding-card-row">
            <span class="label">Día</span>
            <span class="v">${q && q.dayLow ? formatPrice(q.dayLow, q.currency) + ' / ' + formatPrice(q.dayHigh, q.currency) : '—'}</span>
          </div>
          <div class="holding-card-row">
            <span class="label">52w</span>
            <span class="v">${q && q.low52 ? formatPrice(q.low52, q.currency) + ' / ' + formatPrice(q.high52, q.currency) : '—'}</span>
          </div>
          <div class="holding-card-row" style="justify-content:flex-end;">
            <button class="delete-btn" data-sym="${w.symbol}" aria-label="Quitar">× Quitar</button>
          </div>
        </div>
      `;
    }).join('');
    cards.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.sym;
        removeFromWatchlist(sym);
        toast(`${sym} removido de watchlist`, 'info');
      });
    });
  }

  // Price flash
  watchlist.forEach(w => {
    const q = quotes[w.symbol];
    if (!q?.price) return;
    const prev = prevPrices.get(w.symbol);
    if (prev != null && prev !== q.price) {
      const dir = q.price > prev ? 'up' : 'down';
      document.querySelectorAll(`.price-cell[data-symbol="${w.symbol}"]`).forEach(el => {
        el.classList.remove('cell-flash-up', 'cell-flash-down');
        void el.offsetWidth;
        el.classList.add(`cell-flash-${dir}`);
      });
    }
    prevPrices.set(w.symbol, q.price);
  });
}

export async function refreshWatchlistQuotes() {
  const { watchlist } = getState();
  if (watchlist.length === 0) return;
  const symbols = watchlist.map(w => w.symbol);
  try {
    const quotes = await getQuotes(symbols);
    if (Object.keys(quotes).length > 0) setQuotes(quotes);
  } catch (e) {
    // silently fall back to cache
  }
}

function formatPrice(n, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n || 0);
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
