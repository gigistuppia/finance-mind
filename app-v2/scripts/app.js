import { getState, getPortfolioItems, subscribe, setQuotes, setFxRates, setTransactions, addToWatchlist } from './state.js';
import { getQuotes, getLastMarketState } from './api.js';
import { initRouter, onRouteChange, currentRoute } from './router.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initAddAsset } from './ui/add-asset.js';
import { renderDashboard, setAddAssetUI } from './ui/dashboard.js';
import { renderTrialBadge, checkPaywall, initPaywall } from './ui/paywall.js';
import { initMarkets, loadMarkets } from './ui/markets.js';
import { renderWatchlist, refreshWatchlistQuotes } from './ui/watchlist.js';
import { initSettings } from './ui/settings.js';
import { initDolar } from './dolar.js';
import { toast } from './ui/toast.js';
import { renderMovements, initMovements } from './ui/movements.js';
import { renderAssets, initAssets } from './ui/assets.js';
import { checkSplits } from './splits.js';
import { initStaleness, onQuotesRefreshed } from './staleness.js';

const REFRESH_LIVE = 10_000;
const REFRESH_CLOSED = 60_000;
let addAssetUI = null;
let marketsLoaded = false;
let rafScheduled = false;
let pendingRoute = null;
let refreshTimer = null;

function scheduleRender(route) {
  pendingRoute = route;
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    const r = pendingRoute;
    pendingRoute = null;
    if (r === 'dashboard') renderDashboard();
    else if (r === 'watchlist') renderWatchlist();
    else if (r === 'movimientos') renderMovements();
    else if (r === 'activos') renderAssets();
  });
}

async function refreshQuotes() {
  const { watchlist } = getState();
  const portfolioItems = getPortfolioItems();
  const allItems = [...portfolioItems, ...watchlist];
  const symbols = [...new Set(allItems.map(p => p.symbol))];

  // Detectar monedas no-USD, no-ARS para traer sus tasas cruzadas
  const currencies = new Set();
  for (const item of portfolioItems) {
    const cur = item.currency || 'USD';
    if (cur !== 'USD' && cur !== 'ARS') {
      currencies.add(cur === 'GBp' ? 'GBP' : cur);
    }
  }
  const fxSymbols = [...currencies].map(c => `${c}USD=X`);
  const allSymbols = [...new Set([...symbols, ...fxSymbols])];

  if (allSymbols.length === 0) return;
  try {
    const quotes = await getQuotes(allSymbols);
    if (Object.keys(quotes).length > 0) {
      const fxRates = {};
      for (const cur of currencies) {
        const q = quotes[`${cur}USD=X`];
        if (q?.price > 0) fxRates[cur] = q.price;
      }
      if (Object.keys(fxRates).length > 0) setFxRates(fxRates);
      setQuotes(quotes);
      onQuotesRefreshed();
    }
  } catch {
    // silently fail — cache servirá hasta que la red vuelva
  }
}

async function onRouteEnter(route) {
  if (route === 'mercados' && !marketsLoaded) {
    marketsLoaded = true;
    loadMarkets();
  }
  if (route === 'watchlist') {
    refreshWatchlistQuotes();
  }
  scheduleRender(route);
  // Actualizar bottom nav indicator
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    if (el.dataset.route) {
      el.classList.toggle('active', el.dataset.route === route);
    }
  });
}

/* ── HEADER scroll: transparente → blur dark ── */
function initHeaderScroll() {
  const header = document.getElementById('app-header');
  if (!header) return;

  let scrolled = false;
  let ticking = false;

  function update() {
    ticking = false;
    const shouldBeScrolled = window.scrollY > 12;
    if (shouldBeScrolled !== scrolled) {
      scrolled = shouldBeScrolled;
      header.classList.toggle('scrolled', scrolled);
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
}

/* ── Mobile sidebar (drawer + backdrop) ── */
function initMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggle = document.getElementById('menu-toggle');
  if (!sidebar || !backdrop) return;

  function open() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  }
  function close() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }

  toggle?.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) close();
    else open();
  });
  backdrop.addEventListener('click', close);

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) close();
    });
  });

  window.addEventListener('hashchange', () => {
    if (window.innerWidth <= 768) close();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) close();
  });
}

function initOnlineIndicator() {
  let banner = null;

  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.textContent = 'Sin conexión — datos cacheados';
    document.body.prepend(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
  }

  function hideBanner() {
    if (!banner) return;
    banner.classList.remove('show');
    banner.addEventListener('transitionend', () => banner.remove(), { once: true });
    banner = null;
    toast('Conexión restablecida', 'success', 2200);
    refreshQuotes();
  }

  if (!navigator.onLine) showBanner();
  window.addEventListener('online', hideBanner);
  window.addEventListener('offline', showBanner);
}

function hasLiveSymbols() {
  const { watchlist } = getState();
  const portfolioItems = getPortfolioItems();
  return [...portfolioItems, ...watchlist].some(p =>
    p.symbol.endsWith('-USD') || p.symbol.endsWith('-EUR') ||
    p.symbol.endsWith('-BTC') || p.symbol.endsWith('=X')
  );
}

function getRefreshInterval() {
  if (hasLiveSymbols()) return REFRESH_LIVE;
  const state = getLastMarketState();
  return state === 'OPEN' ? REFRESH_LIVE : REFRESH_CLOSED;
}

function scheduleAdaptiveRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const interval = getRefreshInterval();
  refreshTimer = setTimeout(async () => {
    if (document.visibilityState !== 'hidden') {
      await refreshQuotes();
    }
    scheduleAdaptiveRefresh();
  }, interval);
}

function init() {
  initPaywall();
  renderTrialBadge();
  checkPaywall();
  initDolar();
  initStaleness();
  initHeaderScroll();
  initMobileNav();
  initOnlineIndicator();

  addAssetUI = initAddAsset({
    onAdd: (asset, mode) => {
      refreshQuotes();
      const msg = mode === 'edit' ? `${asset.symbol} actualizado`
        : mode === 'sell' ? `Venta de ${asset.symbol} registrada`
        : `${asset.symbol} agregado al portfolio`;
      toast(msg, 'success');
    }
  });
  setAddAssetUI(addAssetUI);

  const searchUI = initSearchOverlay({ onSelect: (item) => addAssetUI.open(item) });

  initMarkets({
    onSelect: (item) => addAssetUI.open(item),
    onWatch: (item) => {
      addToWatchlist(item);
      toast(`${item.symbol} agregado a la watchlist`, 'success');
    },
  });

  initSettings();
  initMovements();
  initAssets();

  document.getElementById('watchlist-add')?.addEventListener('click', () => {
    searchUI.open((item) => {
      addToWatchlist(item);
      refreshWatchlistQuotes();
      toast(`${item.symbol} agregado a la watchlist`, 'success');
    });
  });

  document.getElementById('add-trigger')?.addEventListener('click', () => {
    searchUI.open();
  });

  initRouter();
  onRouteChange((route) => onRouteEnter(route));

  subscribe(() => scheduleRender(currentRoute()));

  // Render inicial síncrono (no via rAF) para garantizar binding de sortable/CTA
  const route = currentRoute();
  if (route === 'dashboard') renderDashboard();
  else if (route === 'watchlist') renderWatchlist();
  else if (route === 'activos') renderAssets();
  else if (route === 'movimientos') renderMovements();
  // y refresh del bnav active
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    if (el.dataset.route) el.classList.toggle('active', el.dataset.route === route);
  });

  refreshQuotes();
  scheduleAdaptiveRefresh();

  // Chequeo de splits: una vez por día por símbolo, en background
  setTimeout(() => {
    checkSplits((adjustedTxs) => setTransactions(adjustedTxs));
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshQuotes();
      scheduleAdaptiveRefresh();
    }
  });

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
