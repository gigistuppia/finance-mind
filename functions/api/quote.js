const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    const m = data.chart?.result?.[0]?.meta;
    if (!m) return null;
    const price = m.regularMarketPrice ?? 0;
    const prev = m.chartPreviousClose ?? m.previousClose ?? price;
    return {
      symbol: m.symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: prev,
      regularMarketChange: price - prev,
      regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
      regularMarketDayHigh: m.regularMarketDayHigh ?? 0,
      regularMarketDayLow: m.regularMarketDayLow ?? 0,
      regularMarketVolume: m.regularMarketVolume ?? 0,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? 0,
      currency: m.currency || 'USD',
      exchange: m.exchangeName || '',
      quoteType: m.instrumentType || 'EQUITY',
      shortName: m.symbol,
    };
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing symbols param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const results = (await Promise.all(symbols.map(fetchChart))).filter(Boolean);
  return new Response(JSON.stringify({ quoteResponse: { result: results, error: null } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
