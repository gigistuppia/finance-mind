import { debouncedSearch } from '../search.js';

export function initSearchOverlay({ onSelect }) {
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-modal-input');
  const results = document.getElementById('search-results');
  const trigger = document.getElementById('search-trigger');

  function open() {
    overlay.classList.add('open');
    input.value = '';
    results.innerHTML = '';
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    overlay.classList.remove('open');
  }

  trigger.addEventListener('click', open);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });

  input.addEventListener('input', (e) => {
    const q = e.target.value;
    if (!q) { results.innerHTML = ''; return; }
    results.innerHTML = '<div class="search-group-label">Buscando…</div>';
    debouncedSearch(q, (groups) => renderResults(results, groups, (item) => {
      onSelect(item);
      close();
    }));
  });
}

function renderResults(container, groups, onPick) {
  if (groups.length === 0) {
    container.innerHTML = '<div class="empty"><h4>Sin resultados</h4><p>Probá con otro ticker o nombre.</p></div>';
    return;
  }
  container.innerHTML = groups.map(g => `
    <div class="search-group">
      <div class="search-group-label">${g.label}</div>
      ${g.items.map(i => `
        <div class="search-result-item" data-symbol="${i.symbol}">
          <span class="sym">${i.symbol}</span>
          <span class="nm">${escapeHTML(i.name)}</span>
          <span class="exch">${i.exchange}</span>
        </div>
      `).join('')}
    </div>
  `).join('');

  container.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const symbol = el.dataset.symbol;
      const flat = groups.flatMap(g => g.items);
      const item = flat.find(i => i.symbol === symbol);
      if (item) onPick(item);
    });
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
