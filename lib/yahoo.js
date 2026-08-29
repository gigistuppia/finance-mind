/**
 * Acceso a Yahoo Finance. Sin dependencias de Vercel — lo usan tanto las
 * funciones HTTP de /api como el bot del cron.
 *
 * CommonJS a propósito: el repo no declara "type": "module" para no romper
 * netlify/functions/*.js mientras dure la migración (ver CLAUDE.md §1 Deploy).
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb';
const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';

// Cache a nivel módulo: sobrevive mientras la instancia esté caliente.
let cachedCookieCrumb = null;
let cookieCrumbExpiry = 0;

async function getCookieAndCrumb() {
  if (cachedCookieCrumb && Date.now() < cookieCrumbExpiry) {
    return cachedCookieCrumb;
  }
  try {
    const consentRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    });
    const setCookie = consentRes.headers.get('set-cookie') || '';

    const crumbRes = await fetch(CRUMB_URL, {
      headers: { 'User-Agent': UA, Cookie: setCookie.split(';')[0] },
    });
    const crumb = await crumbRes.text();

    if (crumb && !crumb.includes('{')) {
      cachedCookieCrumb = { cookie: setCookie.split(';')[0], crumb };
      cookieCrumbExpiry = Date.now() + 10 * 60_000;
      return cachedCookieCrumb;
    }
  } catch {}
  return null;
}

/** Camino rico: v7/quote. Trae marketCap, pre/post market y marketState. */
async function fetchQuotesV7(symbols) {
  const auth = await getCookieAndCrumb();
  if (!auth) return null;

  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(auth.crumb)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: auth.cookie },
  });
  if (!res.ok) {
    cachedCookieCrumb = null;
    return null;
  }
  const data = await res.json();
  const results = data?.quoteResponse?.result;
  if (!results || results.length === 0) return null;

  return results.map((q) => ({
    symbol: q.symbol,
    // null = sin precio real; nunca 0 (evita P&L −100% falso)
    regularMarketPrice: q.regularMarketPrice != null ? q.regularMarketPrice : null,
    regularMarketPreviousClose: q.regularMarketPreviousClose != null ? q.regularMarketPreviousClose : null,
    regularMarketChange: q.regularMarketChange != null ? q.regularMarketChange : null,
    regularMarketChangePercent: q.regularMarketChangePercent != null ? q.regularMarketChangePercent : null,
    regularMarketDayHigh: q.regularMarketDayHigh ?? 0,
    regularMarketDayLow: q.regularMarketDayLow ?? 0,
    regularMarketOpen: q.regularMarketOpen ?? 0,
    regularMarketVolume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ?? 0,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
    preMarketPrice: q.preMarketPrice != null ? q.preMarketPrice : null,
    preMarketChange: q.preMarketChange != null ? q.preMarketChange : null,
    preMarketChangePercent: q.preMarketChangePercent != null ? q.preMarketChangePercent : null,
    postMarketPrice: q.postMarketPrice != null ? q.postMarketPrice : null,
    postMarketChange: q.postMarketChange != null ? q.postMarketChange : null,
    postMarketChangePercent: q.postMarketChangePercent != null ? q.postMarketChangePercent : null,
    currency: q.currency || 'USD',
    exchange: q.exchange || '',
    exchangeTimezoneName: q.exchangeTimezoneName || '',
    quoteType: q.quoteType || 'EQUITY',
    shortName: q.shortName || q.longName || q.symbol,
    longName: q.longName || '',
    marketState: q.marketState || 'CLOSED',
  }));
}

/** Fallback pobre pero robusto: v8/chart. No necesita cookie ni crumb. */
async function fetchChart(symbol) {
  try {
    const res = await fetch(
      `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': UA } }
    );
    const data = await res.json();
    const m = data.chart?.result?.[0]?.meta;
    if (!m) return null;
    const price = m.regularMarketPrice != null ? m.regularMarketPrice : null;
    if (price === null) return null;
    const prev = m.chartPreviousClose ?? m.previousClose ?? null;
    return {
      symbol: m.symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: prev,
      regularMarketChange: prev != null ? price - prev : null,
      regularMarketChangePercent: prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null,
      regularMarketDayHigh: m.regularMarketDayHigh ?? 0,
      regularMarketDayLow: m.regularMarketDayLow ?? 0,
      regularMarketOpen: 0,
      regularMarketVolume: m.regularMarketVolume ?? 0,
      marketCap: 0,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? 0,
      preMarketPrice: null,
      preMarketChange: null,
      preMarketChangePercent: null,
      postMarketPrice: null,
      postMarketChange: null,
      postMarketChangePercent: null,
      currency: m.currency || 'USD',
      exchange: m.exchangeName || '',
      exchangeTimezoneName: m.exchangeTimezoneName || '',
      quoteType: m.instrumentType || 'EQUITY',
      shortName: m.symbol,
      longName: '',
      marketState: 'UNKNOWN',
    };
  } catch {
    return null;
  }
}

/**
 * Cotizaciones. Intenta v7 (rico) y cae a chart por símbolo si falla.
 * Devuelve siempre un array, nunca null.
 */
async function getQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const rich = await fetchQuotesV7(symbols);
  if (rich) return rich;
  const fallback = await Promise.all(symbols.map(fetchChart));
  return fallback.filter(Boolean);
}

/** Búsqueda de instrumentos. `newsCount > 0` devuelve además noticias. */
async function search(query, { quotesCount = 15, newsCount = 0 } = {}) {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}`
    + `&quotesCount=${quotesCount}&newsCount=${newsCount}&listsCount=0`
    + `&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Yahoo search HTTP ${res.status}`);
  return res.json();
}

/**
 * Velas diarias. Insumo de indicators.js y patterns.js.
 * Devuelve { symbol, currency, candles: [{ t, o, h, l, c, v }] } con las
 * velas incompletas (cualquier OHLC en null) ya descartadas.
 */
async function getCandles(symbol, { range = '1y', interval = '1d' } = {}) {
  const res = await fetch(
    `${CHART_URL}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    { headers: { 'User-Agent': UA } }
  );
  if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Sin datos para ${symbol}`);

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles = [];

  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ t: ts[i] * 1000, o, h, l, c, v: q.volume?.[i] ?? 0 });
  }

  return {
    symbol: result.meta?.symbol || symbol,
    currency: result.meta?.currency || 'USD',
    exchangeTimezoneName: result.meta?.exchangeTimezoneName || '',
    candles,
  };
}

module.exports = { getQuotes, search, getCandles, fetchQuotesV7, fetchChart };
