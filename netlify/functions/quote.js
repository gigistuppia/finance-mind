const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const CRUMB_URL = 'https://query2.finance.yahoo.com/v1/test/getcrumb';
const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

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
      headers: {
        'User-Agent': UA,
        Cookie: setCookie.split(';')[0],
      },
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

async function fetchQuotesV7(symbols) {
  const auth = await getCookieAndCrumb();
  if (!auth) return null;

  const url = `${QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(auth.crumb)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Cookie: auth.cookie,
    },
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
    // Pre/post market (null = no disponible)
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

async function fetchChart(symbol) {
  const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    const m = data.chart?.result?.[0]?.meta;
    if (!m) return null;
    const price = m.regularMarketPrice != null ? m.regularMarketPrice : null;
    if (price === null) return null; // sin precio no vale la pena el fallback
    const prev = m.chartPreviousClose ?? m.previousClose ?? null;
    return {
      symbol: m.symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: prev,
      regularMarketChange: prev != null ? price - prev : null,
      regularMarketChangePercent: prev != null && prev !== 0 ? ((price - prev) / prev) * 100 : null,
      regularMarketDayHigh: m.regularMarketDayHigh ?? 0,
      regularMarketDayLow: m.regularMarketDayLow ?? 0,
      regularMarketVolume: m.regularMarketVolume ?? 0,
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
      quoteType: m.instrumentType || 'EQUITY',
      shortName: m.symbol,
      marketState: 'UNKNOWN',
    };
  } catch {
    return null;
  }
}

exports.handler = async function (event) {
  const symbols = ((event.queryStringParameters || {}).symbols || '')
    .split(',')
    .filter(Boolean);
  if (symbols.length === 0) {
    return { statusCode: 400, body: '{"error":"Missing symbols param"}' };
  }

  let results = await fetchQuotesV7(symbols);

  if (!results) {
    results = (await Promise.all(symbols.map(fetchChart))).filter(Boolean);
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=8',
    },
    body: JSON.stringify({ quoteResponse: { result: results || [], error: null } }),
  };
};
