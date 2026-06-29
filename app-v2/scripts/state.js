const PORTFOLIO_KEY = 'fm2_portfolio';
const CCL_KEY = 'fm2_ccl';
const WATCHLIST_KEY = 'fm2_watchlist';
const QUOTES_CACHE_KEY = 'fm2_quotes_cache';
const MOVEMENTS_KEY = 'fm2_movements';
const MAX_MOVEMENTS = 500;

const listeners = new Set();

const state = {
  portfolio: load(PORTFOLIO_KEY, []),
  watchlist: load(WATCHLIST_KEY, []),
  movements: load(MOVEMENTS_KEY, []),
  ccl: parseFloat(localStorage.getItem(CCL_KEY)) || 1000,
  quotes: load(QUOTES_CACHE_KEY, {}),
  loading: false,
  online: navigator.onLine,
};

function logMovement(type, payload) {
  state.movements.unshift({
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    ...payload,
  });
  if (state.movements.length > MAX_MOVEMENTS) {
    state.movements.length = MAX_MOVEMENTS;
  }
  try { localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(state.movements)); } catch {}
}

export function getMovements() {
  return state.movements;
}

export function clearMovements() {
  state.movements = [];
  try { localStorage.removeItem(MOVEMENTS_KEY); } catch {}
  emit();
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/* Persist crítico (portfolio, watchlist, CCL) — sincrónico inmediato */
function persistCritical() {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state.portfolio));
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(state.watchlist));
    localStorage.setItem(CCL_KEY, String(state.ccl));
  } catch {}
}

/* Persist quotes cache — diferido (idle/timeout) para no bloquear render */
let quotesPersistTimer = null;
function persistQuotesDeferred() {
  if (quotesPersistTimer) return;
  const doIt = () => {
    quotesPersistTimer = null;
    try {
      localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(state.quotes));
    } catch {}
  };
  if ('requestIdleCallback' in window) {
    quotesPersistTimer = requestIdleCallback(doIt, { timeout: 2000 });
  } else {
    quotesPersistTimer = setTimeout(doIt, 1500);
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function addAsset(asset) {
  const existing = state.portfolio.find(p => p.symbol === asset.symbol);
  if (existing) {
    const totalQty = existing.quantity + asset.quantity;
    const totalCost = existing.quantity * existing.avgPrice + asset.quantity * asset.avgPrice;
    existing.avgPrice = totalCost / totalQty;
    existing.quantity = totalQty;
  } else {
    state.portfolio.push({
      id: crypto.randomUUID(),
      symbol: asset.symbol,
      name: asset.name,
      quoteType: asset.quoteType,
      exchange: asset.exchange,
      currency: asset.currency,
      quantity: asset.quantity,
      avgPrice: asset.avgPrice,
      date: asset.date || new Date().toISOString().slice(0, 10),
    });
  }
  logMovement('add', {
    symbol: asset.symbol,
    name: asset.name,
    quoteType: asset.quoteType,
    currency: asset.currency,
    quantity: asset.quantity,
    price: asset.avgPrice,
  });
  persistCritical();
  emit();
}

export function removeAsset(id) {
  const removed = state.portfolio.find(p => p.id === id);
  state.portfolio = state.portfolio.filter(p => p.id !== id);
  if (removed) {
    logMovement('remove', {
      symbol: removed.symbol,
      name: removed.name,
      quoteType: removed.quoteType,
      currency: removed.currency,
      quantity: removed.quantity,
      price: removed.avgPrice,
    });
  }
  persistCritical();
  emit();
}

export function updateAsset(id, patch) {
  const asset = state.portfolio.find(p => p.id === id);
  if (!asset) return;
  Object.assign(asset, patch);
  logMovement('update', {
    symbol: asset.symbol,
    name: asset.name,
    quoteType: asset.quoteType,
    currency: asset.currency,
    quantity: asset.quantity,
    price: asset.avgPrice,
  });
  persistCritical();
  emit();
}

export function setQuotes(quotesBySymbol) {
  Object.assign(state.quotes, quotesBySymbol);
  persistQuotesDeferred();
  emit();
}

export function setCCL(value) {
  state.ccl = value;
  persistCritical();
  emit();
}

export function setLoading(flag) {
  state.loading = flag;
  emit();
}

export function addToWatchlist(item) {
  if (state.watchlist.find(w => w.symbol === item.symbol)) return;
  state.watchlist.push({
    symbol: item.symbol,
    name: item.name,
    quoteType: item.quoteType,
    exchange: item.exchange,
  });
  logMovement('watch-add', {
    symbol: item.symbol,
    name: item.name,
    quoteType: item.quoteType,
  });
  persistCritical();
  emit();
}

export function removeFromWatchlist(symbol) {
  const removed = state.watchlist.find(w => w.symbol === symbol);
  state.watchlist = state.watchlist.filter(w => w.symbol !== symbol);
  if (removed) {
    logMovement('watch-remove', {
      symbol: removed.symbol,
      name: removed.name,
      quoteType: removed.quoteType,
    });
  }
  persistCritical();
  emit();
}

export function clearAll() {
  state.portfolio = [];
  state.watchlist = [];
  state.quotes = {};
  persistCritical();
  try { localStorage.removeItem(QUOTES_CACHE_KEY); } catch {}
  emit();
}

window.addEventListener('online', () => { state.online = true; emit(); });
window.addEventListener('offline', () => { state.online = false; emit(); });
