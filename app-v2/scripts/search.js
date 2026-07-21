import { searchInstruments } from './api.js';

const LOCAL_CATALOG = [
  { symbol: 'GC=F',  name: 'Oro · Gold',                   quoteType: 'FUTURE',   exchange: 'COMEX',   keywords: ['oro', 'gold', 'xau', 'xauusd'] },
  { symbol: 'SI=F',  name: 'Plata · Silver',               quoteType: 'FUTURE',   exchange: 'COMEX',   keywords: ['plata', 'silver', 'xag', 'xagusd'] },
  { symbol: 'CL=F',  name: 'Petróleo WTI · Crude Oil',     quoteType: 'FUTURE',   exchange: 'NYMEX',   keywords: ['petroleo', 'petróleo', 'oil', 'wti', 'crudo', 'crude'] },
  { symbol: 'BZ=F',  name: 'Petróleo Brent · Brent Oil',   quoteType: 'FUTURE',   exchange: 'NYMEX',   keywords: ['brent', 'petroleo', 'petróleo', 'oil', 'crudo'] },
  { symbol: 'NG=F',  name: 'Gas Natural · Natural Gas',    quoteType: 'FUTURE',   exchange: 'NYMEX',   keywords: ['gas', 'natural gas', 'gas natural'] },
  { symbol: 'HG=F',  name: 'Cobre · Copper',               quoteType: 'FUTURE',   exchange: 'COMEX',   keywords: ['cobre', 'copper'] },
  { symbol: 'PL=F',  name: 'Platino · Platinum',           quoteType: 'FUTURE',   exchange: 'NYMEX',   keywords: ['platino', 'platinum', 'xpt'] },
  { symbol: 'PA=F',  name: 'Paladio · Palladium',          quoteType: 'FUTURE',   exchange: 'NYMEX',   keywords: ['paladio', 'palladium', 'xpd'] },
  { symbol: 'ZW=F',  name: 'Trigo · Wheat',                quoteType: 'FUTURE',   exchange: 'CBOT',    keywords: ['trigo', 'wheat'] },
  { symbol: 'ZS=F',  name: 'Soja · Soybean',               quoteType: 'FUTURE',   exchange: 'CBOT',    keywords: ['soja', 'soybean', 'soy'] },
  { symbol: 'ZC=F',  name: 'Maíz · Corn',                  quoteType: 'FUTURE',   exchange: 'CBOT',    keywords: ['maiz', 'maíz', 'corn'] },
  { symbol: 'KC=F',  name: 'Café · Coffee',                quoteType: 'FUTURE',   exchange: 'NYBOT',   keywords: ['cafe', 'café', 'coffee'] },
  { symbol: 'CC=F',  name: 'Cacao · Cocoa',                quoteType: 'FUTURE',   exchange: 'NYBOT',   keywords: ['cacao', 'cocoa'] },
  { symbol: 'SB=F',  name: 'Azúcar · Sugar',               quoteType: 'FUTURE',   exchange: 'NYBOT',   keywords: ['azucar', 'azúcar', 'sugar'] },
  { symbol: 'CT=F',  name: 'Algodón · Cotton',             quoteType: 'FUTURE',   exchange: 'NYBOT',   keywords: ['algodon', 'algodón', 'cotton'] },
  { symbol: 'SAP.DE',  name: 'SAP SE',                    quoteType: 'EQUITY',   exchange: 'XETRA',   keywords: ['sap'] },
  { symbol: 'ASML',    name: 'ASML Holding',              quoteType: 'EQUITY',   exchange: 'NASDAQ',  keywords: ['asml', 'semiconductores', 'chips'] },
  { symbol: 'NVO',     name: 'Novo Nordisk',              quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['novo', 'nordisk', 'pharma', 'ozempic'] },
  { symbol: 'TM',      name: 'Toyota Motor Corp',         quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['toyota'] },
  { symbol: 'BABA',    name: 'Alibaba Group',             quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['alibaba', 'china'] },
  { symbol: 'TSM',     name: 'Taiwan Semiconductor',      quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['tsmc', 'taiwan', 'semiconductor', 'chips'] },
  { symbol: 'SHEL',    name: 'Shell PLC',                 quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['shell', 'oil', 'energy'] },
  { symbol: 'HSBC',    name: 'HSBC Holdings',             quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['hsbc', 'bank'] },
  { symbol: 'MC.PA',   name: 'LVMH Moët Hennessy',       quoteType: 'EQUITY',   exchange: 'PARIS',   keywords: ['lvmh', 'louis vuitton', 'lujo', 'luxury'] },
  { symbol: 'NESN.SW', name: 'Nestlé SA',                 quoteType: 'EQUITY',   exchange: 'SIX',     keywords: ['nestle', 'nestlé'] },
  { symbol: 'ROG.SW',  name: 'Roche Holding',             quoteType: 'EQUITY',   exchange: 'SIX',     keywords: ['roche', 'pharma'] },
  { symbol: 'AZN',     name: 'AstraZeneca',               quoteType: 'EQUITY',   exchange: 'NASDAQ',  keywords: ['astrazeneca', 'pharma'] },
  { symbol: 'TTE',     name: 'TotalEnergies SE',          quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['total', 'totalenergies', 'energy', 'oil'] },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries',   quoteType: 'EQUITY',   exchange: 'NSE',     keywords: ['reliance', 'india'] },
  { symbol: 'BHP',     name: 'BHP Group',                 quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['bhp', 'mining', 'mineria', 'minería'] },
  { symbol: 'RIO',     name: 'Rio Tinto',                 quoteType: 'EQUITY',   exchange: 'NYSE',    keywords: ['rio', 'tinto', 'mining', 'mineria', 'minería'] },
];

function searchLocalCatalog(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return LOCAL_CATALOG.filter(item => {
    if (item.symbol.toLowerCase().includes(q)) return true;
    if (item.name.toLowerCase().includes(q)) return true;
    return item.keywords.some(kw => {
      const nkw = kw.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return nkw.includes(q) || q.includes(nkw);
    });
  }).map(({ keywords, ...rest }) => rest);
}

let debounceTimer = null;

export function debouncedSearch(query, onResults, delay = 300) {
  clearTimeout(debounceTimer);
  if (!query || query.trim().length < 1) {
    onResults([]);
    return;
  }
  debounceTimer = setTimeout(async () => {
    const [apiResults, localMatches] = await Promise.all([
      searchInstruments(query),
      Promise.resolve(searchLocalCatalog(query)),
    ]);
    const localSymbols = new Set(localMatches.map(r => r.symbol));
    const prioritized = localMatches.map(r => ({ ...r, _priority: true }));
    const merged = [
      ...prioritized,
      ...apiResults.filter(r => !localSymbols.has(r.symbol)),
    ];
    onResults(groupByType(merged));
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
    EQUITY: 'STOCK', ETF: 'ETF', CRYPTOCURRENCY: 'CRYPTO',
    CURRENCY: 'FX', INDEX: 'INDEX', FUTURE: 'FUT', MUTUALFUND: 'FUND',
  }[quoteType] || '—';
}
