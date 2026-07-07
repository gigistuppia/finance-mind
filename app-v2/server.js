const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 4175;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const yahooAgent = new https.Agent({ rejectUnauthorized: false });

function proxyYahoo(targetUrl, res) {
  https.get(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    agent: yahooAgent
  }, (yres) => {
    const chunks = [];
    yres.on('data', (c) => chunks.push(c));
    yres.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(Buffer.concat(chunks));
    });
  }).on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/api/search') {
    const q = url.searchParams.get('q') || '';
    const target = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
    return proxyYahoo(target, res);
  }
  if (pathname === '/api/chart') {
    const symbol = url.searchParams.get('symbol') || '';
    const range = url.searchParams.get('range') || '1d';
    const interval = url.searchParams.get('interval') || '1d';
    const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    return proxyYahoo(target, res);
  }
  if (pathname === '/api/quote') {
    const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);

    function fetchChartFallback(s) {
      return new Promise((resolve) => {
        https.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          agent: yahooAgent
        }, (yres) => {
          const chunks = [];
          yres.on('data', (c) => chunks.push(c));
          yres.on('end', () => {
            try {
              const data = JSON.parse(Buffer.concat(chunks).toString());
              const m = data.chart?.result?.[0]?.meta;
              if (!m) return resolve(null);
              const price = m.regularMarketPrice ?? 0;
              const prev = m.chartPreviousClose ?? m.previousClose ?? price;
              resolve({
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
                marketState: 'UNKNOWN',
              });
            } catch { resolve(null); }
          });
        }).on('error', () => resolve(null));
      });
    }

    async function tryV7Quote() {
      try {
        const consentRes = await new Promise((resolve, reject) => {
          https.get('https://fc.yahoo.com', { agent: yahooAgent, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, resolve).on('error', reject);
        });
        const setCookie = consentRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

        const crumb = await new Promise((resolve, reject) => {
          https.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Cookie: setCookie },
            agent: yahooAgent
          }, (r) => {
            const chunks = [];
            r.on('data', c => chunks.push(c));
            r.on('end', () => resolve(Buffer.concat(chunks).toString()));
          }).on('error', reject);
        });

        if (!crumb || crumb.includes('{')) return null;

        const quoteUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(crumb)}`;
        const data = await new Promise((resolve, reject) => {
          https.get(quoteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Cookie: setCookie },
            agent: yahooAgent
          }, (r) => {
            const chunks = [];
            r.on('data', c => chunks.push(c));
            r.on('end', () => {
              try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
              catch { resolve(null); }
            });
          }).on('error', reject);
        });

        const results = data?.quoteResponse?.result;
        if (!results || results.length === 0) return null;
        return results.map(q => ({
          symbol: q.symbol,
          regularMarketPrice: q.regularMarketPrice ?? 0,
          regularMarketPreviousClose: q.regularMarketPreviousClose ?? 0,
          regularMarketChange: q.regularMarketChange ?? 0,
          regularMarketChangePercent: q.regularMarketChangePercent ?? 0,
          regularMarketDayHigh: q.regularMarketDayHigh ?? 0,
          regularMarketDayLow: q.regularMarketDayLow ?? 0,
          regularMarketOpen: q.regularMarketOpen ?? 0,
          regularMarketVolume: q.regularMarketVolume ?? 0,
          marketCap: q.marketCap ?? 0,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
          currency: q.currency || 'USD',
          exchange: q.exchange || '',
          quoteType: q.quoteType || 'EQUITY',
          shortName: q.shortName || q.longName || q.symbol,
          marketState: q.marketState || 'CLOSED',
        }));
      } catch { return null; }
    }

    (async () => {
      let results = await tryV7Quote();
      if (!results) {
        results = (await Promise.all(symbols.map(fetchChartFallback))).filter(Boolean);
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ quoteResponse: { result: results, error: null } }));
    })();
    return;
  }

  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Finance Mind App v2 running at http://localhost:${PORT}`);
});
