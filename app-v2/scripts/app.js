import { getState, subscribe, setQuotes, addToWatchlist } from './state.js';
import { getQuotes } from './api.js';
import { initRouter, onRouteChange, currentRoute } from './router.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initAddAsset } from './ui/add-asset.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderTrialBadge, checkPaywall, initPaywall } from './ui/paywall.js';
import { initMarkets, loadMarkets } from './ui/markets.js';
import { renderWatchlist, refreshWatchlistQuotes } from './ui/watchlist.js';
import { initSettings } from './ui/settings.js';
import { initDolar } from './dolar.js';
import { toast } from './ui/toast.js';

const REFRESH_MS = 60_000;
let addAssetUI = null;
let marketsLoaded = false;
let rafScheduled = false;
let pendingRoute = null;

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
  });
}

async function refreshQuotes() {
  const { portfolio, watchlist } = getState();
  const symbols = [...new Set([...portfolio, ...watchlist].map(p => p.symbol))];
  if (symbols.length === 0) return;
  try {
    const quotes = await getQuotes(symbols);
    if (Object.keys(quotes).length > 0) setQuotes(quotes);
  } catch (e) {
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
  let wasOffline = !navigator.onLine;
  window.addEventListener('online', () => {
    if (wasOffline) {
      toast('Conexión restablecida', 'success', 2200);
      refreshQuotes();
    }
    wasOffline = false;
  });
  window.addEventListener('offline', () => {
    wasOffline = true;
    toast('Sin conexión — mostrando datos cacheados', 'warn', 3200);
  });
}

function init() {
  initPaywall();
  renderTrialBadge();
  checkPaywall();
  initDolar();
  initHeaderScroll();
  initMobileNav();
  initOnlineIndicator();

  addAssetUI = initAddAsset({
    onAdd: (asset) => {
      refreshQuotes();
      toast(`${asset.symbol} agregado al portfolio`, 'success');
    }
  });

  const searchUI = initSearchOverlay({ onSelect: (item) => addAssetUI.open(item) });

  initMarkets({
    onSelect: (item) => addAssetUI.open(item),
    onWatch: (item) => {
      addToWatchlist(item);
      toast(`${item.symbol} agregado a la watchlist`, 'success');
    },
  });

  initSettings();

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
  // y refresh del bnav active
  document.querySelectorAll('#bottom-nav .bnav-item').forEach(el => {
    if (el.dataset.route) el.classList.toggle('active', el.dataset.route === route);
  });

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
