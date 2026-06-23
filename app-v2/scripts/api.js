const QUOTE_TTL = 60_000;
const SEARCH_TTL = 5 * 60_000;

const quoteCache = new Map();
const searchCache = new Map();
const pendingQuotes = new Map();

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchInstruments(query) {
  const q = query.trim();
  if (!q) return [];

  const cached = searchCache.get(q.toLowerCase());
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;

  try {
    const data = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
    const quotes = (data.quotes || []).map(normalizeSearchResult);
    searchCache.set(q.toLowerCase(), { ts: Date.now(), data: quotes });
    return quotes;
  } catch (e) {
    console.error('search failed', e);
    return cached?.data || [];
  }
}

function normalizeSearchResult(q) {
  return {
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    exchange: q.exchDisp || q.exchange || '',
    quoteType: q.quoteType || q.typeDisp || 'EQUITY',
    sector: q.sector || '',
    industry: q.industry || '',
  };
}

export async function getQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};
  const now = Date.now();
  const result = {};
  const toFetch = [];

  for (const s of symbols) {
    const cached = quoteCache.get(s);
    if (cached && now - cached.ts < QUOTE_TTL) {
      result[s] = cached.data;
    } else {
      toFetch.push(s);
    }
  }

  if (toFetch.length === 0) return result;

  const batches = chunk(toFetch, 50);
  await Promise.all(batches.map(async (batch) => {
    const key = batch.join(',');
    let promise = pendingQuotes.get(key);
    if (!promise) {
      promise = fetchJSON(`/api/quote?symbols=${encodeURIComponent(key)}`)
        .finally(() => pendingQuotes.delete(key));
      pendingQuotes.set(key, promise);
    }
    try {
      const data = await promise;
      const quotes = data?.quoteResponse?.result || [];
      for (const q of quotes) {
        const normalized = normalizeQuote(q);
        quoteCache.set(q.symbol, { ts: now, data: normalized });
        result[q.symbol] = normalized;
      }
    } catch (e) {
      console.error('quote batch failed', e);
    }
  }));

  return result;
}

function normalizeQuote(q) {
  return {
    symbol: q.symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ?? 0,
    name: q.shortName || q.longName || q.symbol,
    currency: q.currency || 'USD',
    exchange: q.exchange || '',
    quoteType: q.quoteType || 'EQUITY',
    high52: q.fiftyTwoWeekHigh ?? 0,
    low52: q.fiftyTwoWeekLow ?? 0,
    dayHigh: q.regularMarketDayHigh ?? 0,
    dayLow: q.regularMarketDayLow ?? 0,
    open: q.regularMarketOpen ?? 0,
    prevClose: q.regularMarketPreviousClose ?? 0,
    updatedAt: Date.now(),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
