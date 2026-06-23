const PORTFOLIO_KEY = 'fm2_portfolio';
const CCL_KEY = 'fm2_ccl';
const WATCHLIST_KEY = 'fm2_watchlist';
const QUOTES_CACHE_KEY = 'fm2_quotes_cache';

const listeners = new Set();

const state = {
  portfolio: load(PORTFOLIO_KEY, []),
  watchlist: load(WATCHLIST_KEY, []),
  ccl: parseFloat(localStorage.getItem(CCL_KEY)) || 1000,
  quotes: load(QUOTES_CACHE_KEY, {}),
  loading: false,
  online: navigator.onLine,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state.portfolio));
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(state.watchlist));
  localStorage.setItem(CCL_KEY, String(state.ccl));
  localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(state.quotes));
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
  persist();
  emit();
}

export function removeAsset(id) {
  state.portfolio = state.portfolio.filter(p => p.id !== id);
  persist();
  emit();
}

export function updateAsset(id, patch) {
  const asset = state.portfolio.find(p => p.id === id);
  if (!asset) return;
  Object.assign(asset, patch);
  persist();
  emit();
}

export function setQuotes(quotesBySymbol) {
  Object.assign(state.quotes, quotesBySymbol);
  persist();
  emit();
}

export function setCCL(value) {
  state.ccl = value;
  persist();
  emit();
}

export function setLoading(flag) {
  state.loading = flag;
  emit();
}

window.addEventListener('online', () => { state.online = true; emit(); });
window.addEventListener('offline', () => { state.online = false; emit(); });
