import { debouncedSearch } from '../search.js';
import { getState } from '../state.js';

const RECENT_KEY = 'fm2_recent_searches';
const POPULAR_KEY = 'fm2_popular_picks';
const MAX_RECENT = 6;
const MAX_POPULAR = 12;

const TAB_DEFS = [
  { key: 'ALL', label: 'Todos' },
  { key: 'EQUITY', label: 'Acciones' },
  { key: 'CRYPTOCURRENCY', label: 'Crypto' },
  { key: 'ETF', label: 'ETFs' },
  { key: 'CURRENCY', label: 'Forex' },
  { key: 'INDEX', label: 'Índices' },
  { key: 'FUTURE', label: 'Commodities' },
  { key: 'MUTUALFUND', label: 'Fondos' },
];

const TYPE_LABEL = {
  EQUITY: 'STOCK', ETF: 'ETF', CRYPTOCURRENCY: 'CRYPTO',
  CURRENCY: 'FX', INDEX: 'INDEX', FUTURE: 'FUT', MUTUALFUND: 'FUND',
};

/* ── Recents ── */
function loadRecents() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function saveRecents(arr) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT))); } catch {}
}
function pushRecent(item) {
  const list = loadRecents().filter(i => i.symbol !== item.symbol);
  list.unshift({
    symbol: item.symbol,
    name: item.name,
    quoteType: item.quoteType,
    exchange: item.exchange,
  });
  saveRecents(list);
}

/* ── Más buscados (tracking de selecciones) ── */
function loadPopular() {
  try { return JSON.parse(localStorage.getItem(POPULAR_KEY)) || {}; } catch { return {}; }
}
function savePopular(obj) {
  try { localStorage.setItem(POPULAR_KEY, JSON.stringify(obj)); } catch {}
}
function bumpPopular(item) {
  const all = loadPopular();
  const cur = all[item.symbol] || { symbol: item.symbol, name: item.name, quoteType: item.quoteType, exchange: item.exchange, count: 0 };
  cur.count += 1;
  cur.name = item.name || cur.name;
  cur.quoteType = item.quoteType || cur.quoteType;
  cur.exchange = item.exchange || cur.exchange;
  all[item.symbol] = cur;
  savePopular(all);
}
function getTopPopular(n = MAX_POPULAR) {
  const all = loadPopular();
  return Object.values(all)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function initSearchOverlay({ onSelect }) {
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-modal-input');
  const results = document.getElementById('search-results');
  const tabsEl = document.getElementById('search-tabs');
  const closeBtn = document.getElementById('search-modal-close');
  const trigger = document.getElementById('search-trigger');

  let activeCallback = onSelect;
  let allResults = [];
  let activeTab = 'ALL';
  let focusedIdx = -1;
  let lastQuery = '';

  function open(customCallback) {
    activeCallback = customCallback || onSelect;
    overlay.classList.add('open');
    input.value = '';
    activeTab = 'ALL';
    focusedIdx = -1;
    allResults = [];
    renderEmpty();
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'none';
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    activeCallback = onSelect;
  }

  trigger.addEventListener('click', () => open());
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const bnavSearch = document.getElementById('bnav-search');
  if (bnavSearch) bnavSearch.addEventListener('click', () => open());

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open();
      return;
    }
    if (!overlay.classList.contains('open')) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const visible = filteredResults();
      if (focusedIdx >= 0 && visible[focusedIdx]) {
        pick(visible[focusedIdx]);
      } else if (visible[0]) {
        pick(visible[0]);
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleTab(e.shiftKey ? -1 : 1);
    }
  });

  input.addEventListener('input', (e) => {
    const q = e.target.value;
    lastQuery = q;
    focusedIdx = -1;

    if (!q.trim()) {
      allResults = [];
      renderEmpty();
      tabsEl.innerHTML = '';
      tabsEl.style.display = 'none';
      return;
    }

    showLoading();
    debouncedSearch(q, (groups) => {
      if (lastQuery !== q) return;
      allResults = groups.flatMap(g => g.items);
      activeTab = 'ALL';
      focusedIdx = allResults.length > 0 ? 0 : -1;
      renderTabs(allResults);
      renderResults();
    });
  });

  function showLoading() {
    results.innerHTML = `
      <div class="search-loading">
        <span class="spinner"></span> Buscando…
      </div>`;
  }

  function renderEmpty() {
    const recents = loadRecents();
    const popular = getTopPopular();

    const recentsHtml = recents.length > 0 ? `
      <div class="search-section-label">
        <span>Recientes</span>
        <button class="clear-recents" id="clear-recents">Borrar</button>
      </div>
      <div class="search-results-list">
        ${recents.map(r => renderRowHTML(r, -1)).join('')}
      </div>
    ` : '';

    const popularHtml = popular.length > 0 ? `
      <div class="search-section-label"><span>Más buscados</span></div>
      <div class="search-results-list">
        ${popular.map(r => renderRowHTML(r, -1)).join('')}
      </div>
    ` : `
      <div class="search-section-label"><span>Más buscados</span></div>
      <div class="search-empty" style="padding: 24px 16px;">
        <p>Tus búsquedas más frecuentes aparecerán acá.</p>
      </div>
    `;

    results.innerHTML = `
      ${recentsHtml}
      ${popularHtml}`;

    const clearBtn = results.querySelector('#clear-recents');
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveRecents([]);
      renderEmpty();
    });

    // Click handlers para items en recientes/populares
    results.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const sym = el.dataset.sym;
        const fromAny = [...loadRecents(), ...getTopPopular()].find(r => r.symbol === sym);
        if (fromAny) pick(fromAny);
      });
    });
  }

  function renderTabs(items) {
    tabsEl.style.display = '';
    const counts = items.reduce((acc, it) => {
      const k = TAB_DEFS.find(t => t.key === it.quoteType) ? it.quoteType : null;
      if (k) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    counts.ALL = items.length;

    tabsEl.innerHTML = TAB_DEFS
      .filter(t => t.key === 'ALL' || counts[t.key] > 0)
      .map(t => {
        const c = counts[t.key] || 0;
        const active = t.key === activeTab ? 'active' : '';
        return `<button class="search-tab ${active}" data-tab="${t.key}">${t.label}${c > 0 ? `<span class="count">${c}</span>` : ''}</button>`;
      }).join('');

    tabsEl.querySelectorAll('.search-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        focusedIdx = filteredResults().length > 0 ? 0 : -1;
        renderTabs(allResults);
        renderResults();
      });
    });
  }

  function filteredResults() {
    if (activeTab === 'ALL') return allResults;
    return allResults.filter(r => r.quoteType === activeTab);
  }

  function renderResults() {
    const items = filteredResults();
    if (items.length === 0) {
      results.innerHTML = `
        <div class="search-empty">
          <h4>Sin resultados</h4>
          <p>Probá con otro ticker o nombre.</p>
        </div>`;
      return;
    }
    results.innerHTML = items.map((i, idx) => renderRowHTML(i, idx)).join('');

    results.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const visible = filteredResults();
        if (!Number.isNaN(idx) && visible[idx]) pick(visible[idx]);
      });
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.dataset.idx, 10);
        if (!Number.isNaN(idx)) {
          focusedIdx = idx;
          updateFocus();
        }
      });
    });

    updateFocus();
  }

  function renderRowHTML(i, idx) {
    const type = TYPE_LABEL[i.quoteType] || 'OTHER';
    const tColor = typeColor(i.quoteType);
    const q = lastQuery.trim();
    const cached = getState().quotes[i.symbol];

    let priceHtml = '<span class="price-prev muted"><span class="pp-val">—</span></span>';
    if (cached && cached.price > 0) {
      const cls = cached.changePercent >= 0 ? 'pos' : 'neg';
      const sign = cached.changePercent >= 0 ? '+' : '';
      priceHtml = `
        <span class="price-prev ${cls}">
          <span class="pp-val">${formatPrice(cached.price, cached.currency)}</span>
          <span class="pp-chg">${sign}${cached.changePercent.toFixed(2)}%</span>
        </span>`;
    }

    const idxAttr = idx >= 0 ? `data-idx="${idx}"` : '';
    return `
      <div class="search-result-item ${idx === focusedIdx ? 'focused' : ''}" ${idxAttr} data-sym="${i.symbol}">
        <span class="sym">${highlight(i.symbol, q)}</span>
        <span class="nm">${highlight(escapeHTML(i.name || ''), q)}</span>
        <span class="mini-type" style="color:${tColor}">${type}</span>
        ${priceHtml}
        <span class="exch">${shortExch(i.exchange)}</span>
      </div>`;
  }

  function updateFocus() {
    results.querySelectorAll('.search-result-item').forEach((el, i) => {
      const idx = parseInt(el.dataset.idx, 10);
      el.classList.toggle('focused', !Number.isNaN(idx) && idx === focusedIdx);
    });
    const el = results.querySelector('.search-result-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function moveFocus(dir) {
    const items = filteredResults();
    if (items.length === 0) return;
    focusedIdx = (focusedIdx + dir + items.length) % items.length;
    updateFocus();
  }

  function cycleTab(dir) {
    const visibleTabs = Array.from(tabsEl.querySelectorAll('.search-tab')).map(b => b.dataset.tab);
    if (visibleTabs.length === 0) return;
    const idx = visibleTabs.indexOf(activeTab);
    const next = visibleTabs[(idx + dir + visibleTabs.length) % visibleTabs.length];
    activeTab = next;
    focusedIdx = filteredResults().length > 0 ? 0 : -1;
    renderTabs(allResults);
    renderResults();
  }

  function pick(item) {
    pushRecent(item);
    bumpPopular(item);
    activeCallback(item);
    close();
  }

  return { open, close };
}

function shortExch(e) {
  if (!e) return '';
  return e.split(' ')[0].slice(0, 6);
}

function typeColor(t) {
  return ({
    EQUITY: 'var(--color-stock)',
    ETF: 'var(--color-etf)',
    CRYPTOCURRENCY: 'var(--color-crypto)',
    CURRENCY: 'var(--color-forex)',
    INDEX: 'var(--color-index)',
    FUTURE: 'var(--color-commodity)',
    MUTUALFUND: 'var(--color-fund)',
  })[t] || 'var(--color-text-2)';
}

function highlight(text, q) {
  if (!q) return text;
  const safe = String(text);
  const re = new RegExp(`(${escapeRegex(q)})`, 'ig');
  return safe.replace(re, '<mark style="background:rgba(var(--color-accent-rgb),0.18);color:var(--color-accent);padding:0 2px;border-radius:2px;">$1</mark>');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatPrice(n, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(n || 0);
}
