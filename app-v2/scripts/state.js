const PORTFOLIO_KEY = 'fm2_portfolio';
const TRANSACTIONS_KEY = 'fm2_transactions';
const CCL_KEY = 'fm2_ccl';
const DOLAR_TIPO_KEY = 'fm2_dolar_tipo';
const WATCHLIST_KEY = 'fm2_watchlist';
const QUOTES_CACHE_KEY = 'fm2_quotes_cache';
const FX_RATES_KEY = 'fm2_fx_rates';
const MOVEMENTS_KEY = 'fm2_movements';
const MAX_MOVEMENTS = 500;
const FX_RATES_TTL = 30 * 60_000;

const listeners = new Set();

const state = {
  transactions: loadAndMigrate(),
  watchlist: load(WATCHLIST_KEY, []),
  movements: load(MOVEMENTS_KEY, []),
  // null hasta que dolarapi confirme el valor real
  ccl: (() => { const v = parseFloat(localStorage.getItem(CCL_KEY)); return isFinite(v) && v > 0 ? v : null; })(),
  dolarTipo: localStorage.getItem(DOLAR_TIPO_KEY) || 'contadoconliqui',
  quotes: load(QUOTES_CACHE_KEY, {}),
  fxRates: loadFxRates(),
  loading: false,
  online: navigator.onLine,
};

/* ── Helpers de carga ── */

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadFxRates() {
  try {
    const raw = localStorage.getItem(FX_RATES_KEY);
    if (!raw) return {};
    const { rates, ts } = JSON.parse(raw);
    if (!rates || Date.now() - ts > FX_RATES_TTL) return {};
    return rates;
  } catch {
    return {};
  }
}

/**
 * Carga transacciones. Si no existen pero hay portfolio viejo, migra una sola vez.
 * El portfolio viejo se renombra a fm2_portfolio_backup_v1 (nunca se borra).
 */
function loadAndMigrate() {
  const existing = localStorage.getItem(TRANSACTIONS_KEY);
  if (existing) {
    try { return JSON.parse(existing); } catch { return []; }
  }

  const oldPortfolio = load(PORTFOLIO_KEY, []);
  if (oldPortfolio.length === 0) return [];

  const migrated = oldPortfolio.map(p => ({
    id: crypto.randomUUID(),
    type: 'buy',
    symbol: p.symbol,
    name: p.name || p.symbol,
    quoteType: p.quoteType || 'EQUITY',
    exchange: p.exchange || '',
    currency: p.currency || 'USD',
    quantity: p.quantity,
    price: p.avgPrice,
    fee: 0,
    date: p.date || new Date().toISOString().slice(0, 10),
    inputPrice: p.avgPrice,
    inputCurrency: p.currency || 'USD',
    fxRateUsed: null,  // desconocido al migrar
    migrated: true,
    createdAt: Date.now(),
  }));

  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(migrated));
    localStorage.setItem('fm2_portfolio_backup_v1', localStorage.getItem(PORTFOLIO_KEY));
  } catch {}

  return migrated;
}

/* ── Persist ── */

function persistTransactions() {
  try { localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(state.transactions)); } catch {}
}

function persistCritical() {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(state.watchlist));
    if (state.ccl != null) localStorage.setItem(CCL_KEY, String(state.ccl));
    localStorage.setItem(DOLAR_TIPO_KEY, state.dolarTipo);
  } catch {}
}

let quotesPersistTimer = null;
function persistQuotesDeferred() {
  if (quotesPersistTimer) return;
  const doIt = () => {
    quotesPersistTimer = null;
    try { localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(state.quotes)); } catch {}
  };
  if ('requestIdleCallback' in window) {
    quotesPersistTimer = requestIdleCallback(doIt, { timeout: 2000 });
  } else {
    quotesPersistTimer = setTimeout(doIt, 1500);
  }
}

let fxRatesPersistTimer = null;
function persistFxRatesDeferred() {
  if (fxRatesPersistTimer) return;
  const doIt = () => {
    fxRatesPersistTimer = null;
    try {
      localStorage.setItem(FX_RATES_KEY, JSON.stringify({ rates: state.fxRates, ts: Date.now() }));
    } catch {}
  };
  if ('requestIdleCallback' in window) {
    fxRatesPersistTimer = requestIdleCallback(doIt, { timeout: 2000 });
  } else {
    fxRatesPersistTimer = setTimeout(doIt, 1500);
  }
}

function logMovement(type, payload) {
  state.movements.unshift({ id: crypto.randomUUID(), type, timestamp: Date.now(), ...payload });
  if (state.movements.length > MAX_MOVEMENTS) state.movements.length = MAX_MOVEMENTS;
  try { localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(state.movements)); } catch {}
}

/* ── API pública ── */

export function getState() { return state; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/** Agrega una compra al portfolio. Mantiene compatibilidad con el código existente. */
export function addAsset(asset) {
  if (state.transactions.length >= MAX_MOVEMENTS) return; // límite de seguridad

  const tx = {
    id: crypto.randomUUID(),
    type: 'buy',
    symbol: asset.symbol,
    name: asset.name || asset.symbol,
    quoteType: asset.quoteType || 'EQUITY',
    exchange: asset.exchange || '',
    currency: asset.currency || 'USD',
    quantity: asset.quantity,
    price: asset.avgPrice,        // precio unitario en moneda NATIVA del activo
    fee: asset.fee ?? 0,
    date: asset.date || new Date().toISOString().slice(0, 10),
    inputPrice: asset.inputPrice ?? asset.avgPrice,
    inputCurrency: asset.inputCurrency ?? asset.currency ?? 'USD',
    fxRateUsed: asset.fxRateUsed ?? null,
    createdAt: Date.now(),
  };
  state.transactions.push(tx);
  logMovement('buy', {
    symbol: tx.symbol, name: tx.name, quoteType: tx.quoteType,
    currency: tx.currency, quantity: tx.quantity, price: tx.price, fee: tx.fee,
  });
  persistTransactions();
  emit();
}

/** Registra una venta. quantity y price en moneda nativa del activo. */
export function addSell(sell) {
  const tx = {
    id: crypto.randomUUID(),
    type: 'sell',
    symbol: sell.symbol,
    name: sell.name || sell.symbol,
    quoteType: sell.quoteType || 'EQUITY',
    exchange: sell.exchange || '',
    currency: sell.currency || 'USD',
    quantity: sell.quantity,
    price: sell.price,
    fee: sell.fee ?? 0,
    date: sell.date || new Date().toISOString().slice(0, 10),
    inputPrice: sell.inputPrice ?? sell.price,
    inputCurrency: sell.inputCurrency ?? sell.currency ?? 'USD',
    fxRateUsed: sell.fxRateUsed ?? null,
    createdAt: Date.now(),
  };
  state.transactions.push(tx);
  logMovement('sell', {
    symbol: tx.symbol, name: tx.name, quoteType: tx.quoteType,
    currency: tx.currency, quantity: tx.quantity, price: tx.price, fee: tx.fee,
  });
  persistTransactions();
  emit();
}

/** Elimina TODAS las transacciones de un símbolo (cierra la posición). */
export function removeAsset(symbol) {
  const removed = state.transactions.filter(t => t.symbol === symbol);
  if (removed.length === 0) return;
  state.transactions = state.transactions.filter(t => t.symbol !== symbol);
  logMovement('remove', {
    symbol, name: removed[0].name, quoteType: removed[0].quoteType, currency: removed[0].currency,
  });
  persistTransactions();
  emit();
}

export function setQuotes(quotesBySymbol) {
  Object.assign(state.quotes, quotesBySymbol);
  persistQuotesDeferred();
  emit();
}

export function setFxRates(rates) {
  Object.assign(state.fxRates, rates);
  persistFxRatesDeferred();
  emit();
}

export function setCCL(value) {
  state.ccl = value;
  persistCritical();
  emit();
}

export function setDolarTipo(tipo) {
  state.dolarTipo = tipo;
  persistCritical();
}

export function setLoading(flag) {
  state.loading = flag;
  emit();
}

export function addToWatchlist(item) {
  if (state.watchlist.find(w => w.symbol === item.symbol)) return;
  state.watchlist.push({
    symbol: item.symbol, name: item.name,
    quoteType: item.quoteType, exchange: item.exchange,
  });
  logMovement('watch-add', { symbol: item.symbol, name: item.name, quoteType: item.quoteType });
  persistCritical();
  emit();
}

export function removeFromWatchlist(symbol) {
  const removed = state.watchlist.find(w => w.symbol === symbol);
  state.watchlist = state.watchlist.filter(w => w.symbol !== symbol);
  if (removed) {
    logMovement('watch-remove', { symbol: removed.symbol, name: removed.name, quoteType: removed.quoteType });
  }
  persistCritical();
  emit();
}

export function getMovements() { return state.movements; }

export function clearMovements() {
  state.movements = [];
  try { localStorage.removeItem(MOVEMENTS_KEY); } catch {}
  emit();
}

export function clearAll() {
  state.transactions = [];
  state.watchlist = [];
  state.quotes = {};
  state.fxRates = {};
  persistCritical();
  persistTransactions();
  try { localStorage.removeItem(QUOTES_CACHE_KEY); } catch {}
  try { localStorage.removeItem(FX_RATES_KEY); } catch {}
  emit();
}

/** Retorna la lista de posiciones únicas para refreshQuotes (símbolo + moneda). */
export function getPortfolioItems() {
  const seen = new Map();
  for (const tx of state.transactions) {
    if (!seen.has(tx.symbol)) seen.set(tx.symbol, { symbol: tx.symbol, currency: tx.currency });
  }
  return [...seen.values()];
}

window.addEventListener('online', () => { state.online = true; emit(); });
window.addEventListener('offline', () => { state.online = false; emit(); });
