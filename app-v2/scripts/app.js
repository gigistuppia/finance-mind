import { getState, subscribe, setQuotes, setCCL, addToWatchlist } from './state.js';
import { getQuotes } from './api.js';
import { initRouter, onRouteChange, currentRoute } from './router.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initAddAsset } from './ui/add-asset.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderTrialBadge, checkPaywall, initPaywall } from './ui/paywall.js';
import { initMarkets, loadMarkets } from './ui/markets.js';
import { renderWatchlist, refreshWatchlistQuotes } from './ui/watchlist.js';
import { initSettings } from './ui/settings.js';

const REFRESH_MS = 60_000;
let addAssetUI = null;
let marketsLoaded = false;

async function refreshQuotes() {
  const { portfolio, watchlist } = getState();
  const symbols = [...new Set([...portfolio, ...watchlist].map(p => p.symbol))];
  if (symbols.length === 0) return;
  const quotes = await getQuotes(symbols);
  if (Object.keys(quotes).length > 0) setQuotes(quotes);
}

function initCCL() {
  const input = document.getElementById('ccl-input');
  if (!input) return;
  input.value = getState().ccl;
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (v > 0) setCCL(v);
  });
}

function renderForRoute(route) {
  if (route === 'dashboard') renderDashboard();
  if (route === 'watchlist') renderWatchlist();
}

async function onRouteEnter(route) {
  if (route === 'mercados' && !marketsLoaded) {
    marketsLoaded = true;
    await loadMarkets();
  }
  if (route === 'watchlist') {
    await refreshWatchlistQuotes();
  }
  renderForRoute(route);
}

function init() {
  initPaywall();
  renderTrialBadge();
  checkPaywall();
  initCCL();

  addAssetUI = initAddAsset({ onAdd: refreshQuotes });

  initSearchOverlay({ onSelect: (item) => addAssetUI.open(item) });

  initMarkets({
    onSelect: (item) => addAssetUI.open(item),
    onWatch: (item) => addToWatchlist(item),
  });

  initSettings();

  document.getElementById('watchlist-add')?.addEventListener('click', () => {
    document.getElementById('search-trigger')?.click();
  });

  initRouter();
  onRouteChange((route) => onRouteEnter(route));

  subscribe(() => renderForRoute(currentRoute()));
  renderForRoute(currentRoute());

  refreshQuotes();
  setInterval(refreshQuotes, REFRESH_MS);

  setInterval(() => {
    renderTrialBadge();
    checkPaywall();
  }, 60_000 * 30);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
