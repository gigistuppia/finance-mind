const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return Response.redirect(url.origin + '/landing/', 301);
    }
    if (url.pathname === '/api/search') return handleSearch(url);
    if (url.pathname === '/api/quote')  return handleQuote(url);

    return env.ASSETS.fetch(request);
  },
};

async function handleSearch(url) {
  const q = url.searchParams.get('q');
  if (!q) return json({ error: 'Missing q' }, 400);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&enableFuzzyQuery=true`,
      { headers: { 'User-Agent': UA } }
    );
    return json(await res.json(), 200, { 'Cache-Control': 'public, max-age=300' });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}

async function handleQuote(url) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  if (!symbols.length) return json({ error: 'Missing symbols' }, 400);
  const results = (await Promise.all(symbols.map(fetchChart))).filter(Boolean);
  return json({ quoteResponse: { result: results, error: null } }, 200, { 'Cache-Control': 'public, max-age=30' });
}

async function fetchChart(symbol) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: { 'User-Agent': UA } }
    );
    const data = await res.json();
    const m = data.chart?.result?.[0]?.meta;
    if (!m) return null;
    const price = m.regularMarketPrice ?? 0;
    const prev  = m.chartPreviousClose ?? m.previousClose ?? price;
    return {
      symbol: m.symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: prev,
      regularMarketChange: price - prev,
      regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
      regularMarketDayHigh:   m.regularMarketDayHigh   ?? 0,
      regularMarketDayLow:    m.regularMarketDayLow    ?? 0,
      regularMarketVolume:    m.regularMarketVolume    ?? 0,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow:  m.fiftyTwoWeekLow  ?? 0,
      currency:   m.currency        || 'USD',
      exchange:   m.exchangeName    || '',
      quoteType:  m.instrumentType  || 'EQUITY',
      shortName:  m.symbol,
    };
  } catch { return null; }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extra },
  });
}
