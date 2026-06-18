window.FM = window.FM || {};

(function () {
  const ASSETS = [
    { t: 'AAPL',  n: 'Apple',     base: 24350, init: 1.24 },
    { t: 'NVDA',  n: 'NVIDIA',    base: 31820, init: 2.67 },
    { t: 'TSLA',  n: 'Tesla',     base: 18940, init: -0.83 },
    { t: 'MSFT',  n: 'Microsoft', base: 28115, init: 0.45 },
    { t: 'GOOGL', n: 'Alphabet',  base: 9870,  init: -0.21 },
    { t: 'META',  n: 'Meta',      base: 22480, init: 1.02 },
    { t: 'AMZN',  n: 'Amazon',    base: 15230, init: 0.67 },
    { t: 'JPM',   n: 'JPMorgan',  base: 12940, init: 0.12 },
  ];

  const HOLDINGS = [
    { t: 'AAPL', qty: 12, buy: 21500 },
    { t: 'NVDA', qty: 4,  buy: 26800 },
    { t: 'TSLA', qty: 8,  buy: 19600 },
  ];

  const fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  });

  function fmtPct(v) {
    const sign = v >= 0 ? '+' : '';
    return sign + v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  const state = {};
  ASSETS.forEach(a => { state[a.t] = a.base * (1 + a.init / 100); });

  function buildTickerRows() {
    const item = a => {
      const pct = (state[a.t] / a.base - 1) * 100;
      const cls = pct >= 0 ? 'pos' : 'neg';
      const arrow = pct >= 0 ? '▲' : '▼';
      return `<span class="ticker__item"><span class="t">${a.t}</span><span class="n">${a.n}</span>` +
        `<span class="p" data-price="${a.t}">${fmtArs.format(state[a.t])}</span>` +
        `<span class="${cls}" data-change="${a.t}">${arrow} ${fmtPct(pct)}</span></span>`;
    };
    document.querySelectorAll('[data-ticker-row]').forEach((row, i) => {
      const list = i === 0 ? ASSETS : ASSETS.slice().reverse();
      const content = list.map(item).join('');
      const dup = content.replace(/data-price=/g, 'data-price-dup=').replace(/data-change=/g, 'data-change-dup=');
      row.innerHTML =
        `<span style="display:inline-flex">${content}</span>` +
        `<span style="display:inline-flex" aria-hidden="true">${dup}</span>`;
    });
  }

  function tick() {
    ASSETS.forEach(a => {
      state[a.t] *= 1 + (Math.random() - 0.5) * 0.001;
    });
    render();
  }

  function render() {
    ASSETS.forEach(a => {
      const price = state[a.t];
      const pct = (price / a.base - 1) * 100;
      const cls = pct >= 0 ? 'pos' : 'neg';
      const arrow = pct >= 0 ? '▲' : '▼';

      document.querySelectorAll(`[data-price="${a.t}"], [data-price-dup="${a.t}"]`).forEach(el => {
        el.textContent = fmtArs.format(price);
      });
      document.querySelectorAll(`[data-change="${a.t}"], [data-change-dup="${a.t}"]`).forEach(el => {
        const inTicker = el.closest('.ticker');
        el.textContent = (inTicker ? arrow + ' ' : '') + fmtPct(pct);
        el.classList.remove('pos', 'neg');
        el.classList.add(cls);
      });
    });

    const invested = HOLDINGS.reduce((s, h) => s + h.buy * h.qty, 0);
    const current = HOLDINGS.reduce((s, h) => s + state[h.t] * h.qty, 0);
    const totalPct = (current / invested - 1) * 100;
    document.querySelectorAll('[data-total-ars]').forEach(el => { el.textContent = fmtArs.format(current); });
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
    start() {
      buildTickerRows();
      render();
      setInterval(tick, 1000);
    },
  };
})();
