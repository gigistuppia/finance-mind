import { searchInstruments } from './api.js';

let debounceTimer = null;

export function debouncedSearch(query, onResults, delay = 300) {
  clearTimeout(debounceTimer);
  if (!query || query.trim().length < 1) {
    onResults([]);
    return;
  }
  debounceTimer = setTimeout(async () => {
    const results = await searchInstruments(query);
    onResults(groupByType(results));
  }, delay);
}

export function groupByType(results) {
  const groups = {
    EQUITY: { label: 'Acciones', items: [] },
    ETF: { label: 'ETFs', items: [] },
    CRYPTOCURRENCY: { label: 'Crypto', items: [] },
    CURRENCY: { label: 'Forex', items: [] },
    INDEX: { label: 'Índices', items: [] },
    FUTURE: { label: 'Commodities', items: [] },
    MUTUALFUND: { label: 'Fondos', items: [] },
    OTHER: { label: 'Otros', items: [] },
  };

  for (const r of results) {
    const key = groups[r.quoteType] ? r.quoteType : 'OTHER';
    groups[key].items.push(r);
  }

  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([key, g]) => ({ key, ...g }));
}

export function typeIcon(quoteType) {
  return {
    EQUITY: '📈',
    ETF: '📊',
    CRYPTOCURRENCY: '₿',
    CURRENCY: '💱',
    INDEX: '🔢',
    FUTURE: '🛢️',
    MUTUALFUND: '🏦',
  }[quoteType] || '•';
}
