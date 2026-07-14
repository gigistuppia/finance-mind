import { getState, getPortfolioItems } from './state.js';

const TICK_INTERVAL = 30_000; // actualiza el label cada 30s
let tickTimer = null;

function getMostRecentQuoteAge() {
  const { quotes } = getState();
  const portfolioItems = getPortfolioItems();
  if (portfolioItems.length === 0) return null;

  let mostRecent = null;
  for (const item of portfolioItems) {
    const q = quotes[item.symbol];
    if (q?.updatedAt) {
      if (mostRecent === null || q.updatedAt > mostRecent) mostRecent = q.updatedAt;
    }
  }
  return mostRecent ? Date.now() - mostRecent : null;
}

function ageLabel(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)}h`;
}

function update() {
  const dot = document.getElementById('freshness-dot');
  const label = document.getElementById('freshness-label');
  const wrapper = document.getElementById('data-freshness');
  if (!dot || !label || !wrapper) return;

  const ageMs = getMostRecentQuoteAge();

  if (ageMs === null) {
    wrapper.classList.remove('visible');
    return;
  }

  wrapper.classList.add('visible');
  label.textContent = ageLabel(ageMs);

  dot.classList.remove('fresh', 'aging', 'stale');
  if (ageMs < 2 * 60_000) {
    dot.classList.add('fresh');
  } else if (ageMs < 5 * 60_000) {
    dot.classList.add('aging');
  } else {
    dot.classList.add('stale');
  }
}

export function initStaleness() {
  update();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(update, TICK_INTERVAL);
}

/** Llamar después de cada refreshQuotes exitoso para actualizar inmediatamente. */
export function onQuotesRefreshed() {
  update();
}
