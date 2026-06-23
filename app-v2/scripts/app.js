import { getState, subscribe, setQuotes, setCCL } from './state.js';
import { getQuotes } from './api.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initAddAsset } from './ui/add-asset.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderTrialBadge, checkPaywall, initPaywall } from './ui/paywall.js';

const REFRESH_MS = 60_000;

async function refreshQuotes() {
  const { portfolio } = getState();
  if (portfolio.length === 0) return;
  const symbols = [...new Set(portfolio.map(p => p.symbol))];
  const quotes = await getQuotes(symbols);
  if (Object.keys(quotes).length > 0) setQuotes(quotes);
}

function initCCL() {
  const input = document.getElementById('ccl-input');
  input.value = getState().ccl;
  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    if (v > 0) setCCL(v);
  });
}

function init() {
  initPaywall();
  renderTrialBadge();
  checkPaywall();

  initCCL();

  const addAsset = initAddAsset({ onAdd: refreshQuotes });
  initSearchOverlay({ onSelect: (item) => addAsset.open(item) });

  subscribe(() => renderDashboard());
  renderDashboard();

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
