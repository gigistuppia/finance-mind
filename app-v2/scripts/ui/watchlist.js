import { getState, removeFromWatchlist } from '../state.js';
import { getQuotes } from '../api.js';

export function renderWatchlist() {
  const { watchlist, quotes } = getState();
  const tbody = document.getElementById('watchlist-body');
  const empty = document.getElementById('watchlist-empty');
  if (!tbody) return;

  if (watchlist.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = watchlist.map(w => {
    const q = quotes[w.symbol];
    const price = q?.price;
    const chg = q?.changePercent ?? 0;
    const chgClass = chg >= 0 ? 'pnl-pos' : 'pnl-neg';
    const sign = chg >= 0 ? '+' : '';
    return `
      <tr>
        <td>
          <div class="ticker-cell">
            <div>
              <div class="ticker-symbol">${w.symbol}</div>
              <div class="ticker-name">${escapeHTML(w.name || '')}</div>
            </div>
          </div>
        </td>
        <td><span class="type-badge" data-type="${w.quoteType || 'EQUITY'}">${shortType(w.quoteType)}</span></td>
        <td>${price != null ? formatPrice(price, q.currency) : '—'}</td>
        <td class="${chgClass}">${q ? sign + chg.toFixed(2) + '%' : '—'}</td>
        <td>${q ? formatPrice(q.dayLow, q.currency) + ' / ' + formatPrice(q.dayHigh, q.currency) : '—'}</td>
        <td>${q ? formatPrice(q.low52, q.currency) + ' / ' + formatPrice(q.high52, q.currency) : '—'}</td>
        <td><button class="delete-btn" data-sym="${w.symbol}" aria-label="Quitar">×</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromWatchlist(btn.dataset.sym));
  });
}

export async function refreshWatchlistQuotes() {
  const { watchlist } = getState();
  if (watchlist.length === 0) return;
  const symbols = watchlist.map(w => w.symbol);
  const quotes = await getQuotes(symbols);
  const { setQuotes } = await import('../state.js');
  if (Object.keys(quotes).length > 0) setQuotes(quotes);
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
