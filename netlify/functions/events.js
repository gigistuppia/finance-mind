const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

let cachedCookie = null;
let cookieExpiry = 0;

async function getCookie() {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;
  try {
    const res = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    });
    const raw = res.headers.get('set-cookie') || '';
    const cookie = raw.split(';')[0];
    if (cookie) {
      cachedCookie = cookie;
      cookieExpiry = Date.now() + 10 * 60_000;
      return cookie;
    }
  } catch {}
  return null;
}

export default async (req) => {
  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol');
  const from = parseInt(url.searchParams.get('from') || '0', 10);

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=3600',
  };

  try {
    const cookie = await getCookie();
    const period1 = Math.max(0, from - 86400); // un día antes por seguridad
    const period2 = Math.floor(Date.now() / 1000);
    const chartUrl = `${CHART_URL}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits`;

    const fetchHeaders = { 'User-Agent': UA };
    if (cookie) fetchHeaders['Cookie'] = cookie;

    const res = await fetch(chartUrl, { headers: fetchHeaders });
    if (!res.ok) {
      return new Response(JSON.stringify({ splits: [] }), { status: 200, headers });
    }

    const data = await res.json();
    const rawSplits = data?.chart?.result?.[0]?.events?.splits;

    const splits = rawSplits
      ? Object.values(rawSplits)
          .filter(s => s.date > from)
          .map(s => ({
            date: s.date,         // unix timestamp
            numerator: s.numerator,
            denominator: s.denominator,
            ratio: s.numerator / s.denominator,  // e.g. 4 for 4:1 split
          }))
          .sort((a, b) => a.date - b.date)
      : [];

    return new Response(JSON.stringify({ splits }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ splits: [], error: String(err) }), {
      status: 200,
      headers,
    });
  }
};

export const config = { path: '/api/events' };
