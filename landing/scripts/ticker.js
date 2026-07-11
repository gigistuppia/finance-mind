window.FM = window.FM || {};

(function () {
  const SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'JPM'];
  const NAMES = {
    AAPL: 'Apple', NVDA: 'NVIDIA', TSLA: 'Tesla', MSFT: 'Microsoft',
    GOOGL: 'Alphabet', META: 'Meta', AMZN: 'Amazon', JPM: 'JPMorgan',
  };
  const LOGO_SLUGS = {
    AAPL: 'apple', NVDA: 'nvidia', TSLA: 'tesla', MSFT: 'microsoft',
    GOOGL: 'alphabet', META: 'meta-platforms', AMZN: 'amazon', JPM: 'jpmorgan',
  };

  const HOLDINGS = [
    { t: 'AAPL', qty: 12, buy: 185 },
    { t: 'NVDA', qty: 4,  buy: 120 },
    { t: 'TSLA', qty: 8,  buy: 245 },
  ];

  const fmtUsd = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  function fmtPct(v) {
    const sign = v >= 0 ? '+' : '';
    return sign + v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  const state = {};
  let isLive = false;

  async function fetchQuotes() {
    try {
      const query = SYMBOLS.join(',');
      const res = await fetch(`/api/quote?symbols=${encodeURIComponent(query)}`);
      if (!res.ok) return false;
      const data = await res.json();
      const quotes = data?.quoteResponse?.result || [];
      let count = 0;
      for (const q of quotes) {
        const sym = q.symbol;
        if (SYMBOLS.includes(sym)) {
          state[sym] = {
            price: q.regularMarketPrice || 0,
            changePct: q.regularMarketChangePercent || 0,
          };
          count++;
        }
      }
      return count > 0;
    } catch {
      return false;
    }
  }

  function buildTickerRows() {
    const assets = SYMBOLS.map(t => ({ t, n: NAMES[t] }));
    const item = a => {
      const s = state[a.t];
      const price = s ? fmtUsd.format(s.price) : '—';
      const pct = s ? s.changePct : 0;
      const cls = s ? (pct >= 0 ? 'pos' : 'neg') : '';
      const arrow = pct >= 0 ? '▲' : '▼';
      const pctText = s ? `${arrow} ${fmtPct(pct)}` : '—';
      const logoUrl = `https://s3-symbol-logo.tradingview.com/${LOGO_SLUGS[a.t]}.svg`;
      return `<span class="ticker__item"><img class="ticker__logo" src="${logoUrl}" width="18" height="18" alt="${a.t}" loading="lazy"><span class="t">${a.t}</span><span class="n">${a.n}</span>` +
        `<span class="p" data-price="${a.t}">${price}</span>` +
        `<span class="${cls}" data-change="${a.t}">${pctText}</span></span>`;
    };
    document.querySelectorAll('[data-ticker-row]').forEach((row, i) => {
      const list = i === 0 ? assets : assets.slice().reverse();
      const content = list.map(item).join('');
      const dup = content.replace(/data-price=/g, 'data-price-dup=').replace(/data-change=/g, 'data-change-dup=');
      row.innerHTML =
        `<span style="display:inline-flex">${content}</span>` +
        `<span style="display:inline-flex" aria-hidden="true">${dup}</span>`;
    });
  }

  function render() {
    SYMBOLS.forEach(t => {
      const s = state[t];
      if (!s) return;
      const cls = s.changePct >= 0 ? 'pos' : 'neg';
      const arrow = s.changePct >= 0 ? '▲' : '▼';

      document.querySelectorAll(`[data-price="${t}"], [data-price-dup="${t}"]`).forEach(el => {
        el.textContent = fmtUsd.format(s.price);
      });
      document.querySelectorAll(`[data-change="${t}"], [data-change-dup="${t}"]`).forEach(el => {
        const inTicker = el.closest('.ticker');
        el.textContent = (inTicker ? arrow + ' ' : '') + fmtPct(s.changePct);
        el.classList.remove('pos', 'neg');
        el.classList.add(cls);
      });
    });

    const invested = HOLDINGS.reduce((s, h) => s + h.buy * h.qty, 0);
    const current = HOLDINGS.reduce((s, h) => s + (state[h.t]?.price || h.buy) * h.qty, 0);
    const totalPct = (current / invested - 1) * 100;
    document.querySelectorAll('[data-total-ars]').forEach(el => { el.textContent = fmtUsd.format(current); });
    document.querySelectorAll('[data-total-pct]').forEach(el => {
      el.textContent = fmtPct(totalPct);
      el.classList.remove('pos', 'neg');
      el.classList.add(totalPct >= 0 ? 'pos' : 'neg');
    });

    flashMockupRows();
  }

  let lastFlash = 0;
  function flashMockupRows() {
    const now = Date.now();
    if (now - lastFlash < 2800) return;
    lastFlash = now;
    const rows = document.querySelectorAll('.mockup__row');
    if (!rows.length) return;
    const row = rows[Math.floor(Math.random() * rows.length)];
    const up = row.querySelector('[data-change]')?.classList.contains('pos');
    row.style.setProperty('--flash-rgb', up ? '0, 230, 118' : '255, 23, 68');
    row.classList.remove('tick-flash');
    void row.offsetWidth;
    row.classList.add('tick-flash');
  }

  window.FM.ticker = {
    async start() {
      buildTickerRows();
      isLive = await fetchQuotes();
      if (isLive) {
        render();
        buildTickerRows();
      }
      setInterval(async () => {
        const ok = await fetchQuotes();
        if (ok) {
          isLive = true;
          render();
        }
      }, 60_000);
    },
  };
})();
