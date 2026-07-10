const TV_BASE = 'https://s3-symbol-logo.tradingview.com';

const STOCK_SLUGS = {
  AAPL: 'apple', MSFT: 'microsoft', NVDA: 'nvidia', GOOGL: 'alphabet', GOOG: 'alphabet',
  META: 'meta-platforms', AMZN: 'amazon', TSLA: 'tesla', AMD: 'advanced-micro-devices',
  NFLX: 'netflix', INTC: 'intel', JPM: 'jpmorgan', BAC: 'bank-of-america', WFC: 'wells-fargo',
  GS: 'goldman-sachs', MS: 'morgan-stanley', V: 'visa', MA: 'mastercard', 'BRK-B': 'berkshire-hathaway',
  CAT: 'caterpillar', CVX: 'chevron', XOM: 'exxon-mobil', SPGI: 'sp-global', ABNB: 'airbnb',
  BKNG: 'booking-holdings', PG: 'procter-gamble', BA: 'boeing', KO: 'coca-cola', PEP: 'pepsico',
  WMT: 'walmart', DIS: 'disney', NKE: 'nike', MCD: 'mcdonalds', SBUX: 'starbucks',
  ORCL: 'oracle', CRM: 'salesforce', ADBE: 'adobe', PYPL: 'paypal', UBER: 'uber',
  LYFT: 'lyft', SHOP: 'shopify', SQ: 'block', SNAP: 'snap', PINS: 'pinterest',
  ROKU: 'roku', ZM: 'zoom-video', NOW: 'servicenow', PLTR: 'palantir', NIO: 'nio',
  F: 'ford-motor', GM: 'general-motors', T: 'att', VZ: 'verizon', CSCO: 'cisco',
  IBM: 'ibm', QCOM: 'qualcomm', TXN: 'texas-instruments', AVGO: 'broadcom', MU: 'micron',
  PFE: 'pfizer', JNJ: 'johnson-johnson', UNH: 'unitedhealth', LLY: 'eli-lilly', MRNA: 'moderna',
  ABBV: 'abbvie', MRK: 'merck-co', GE: 'general-electric', HON: 'honeywell', RTX: 'raytheon',
  COST: 'costco', HD: 'home-depot', LOW: 'lowes', TGT: 'target', AMC: 'amc-entertainment',
  GME: 'gamestop', BB: 'blackberry', HOOD: 'robinhood', COIN: 'coinbase', SOFI: 'sofi-technologies',
  SAP: 'sap', ASML: 'asml-holding', NVO: 'novo-nordisk',
  TM: 'toyota', BABA: 'alibaba', TSM: 'taiwan-semiconductor',
  SHEL: 'shell-plc', HSBC: 'hsbc',
  MC: 'lvmh', NESN: 'nestle', ROG: 'roche',
  AZN: 'astrazeneca', TTE: 'totalenergies',
  RELIANCE: 'reliance-industries', BHP: 'bhp', RIO: 'rio-tinto',
};

const ETF_SLUGS = {
  SPY: 'spdr-sp-500-etf-trust', QQQ: 'invesco-qqq-trust', VTI: 'vanguard-total-stock-market-etf',
  VOO: 'vanguard-sp-500-etf', IWM: 'ishares-russell-2000-etf', EEM: 'ishares-msci-emerging-markets',
  ARKK: 'ark-innovation-etf', SCHD: 'schwab-us-dividend-equity-etf',
  GLD: 'spdr-gold-shares', SLV: 'ishares-silver-trust', USO: 'united-states-oil-fund',
};

const CRYPTO_SLUGS = {
  BTC: 'XTVCBTC', ETH: 'XTVCETH', SOL: 'XTVCSOL', BNB: 'XTVCBNB', XRP: 'XTVCXRP',
  ADA: 'XTVCADA', DOGE: 'XTVCDOGE', AVAX: 'XTVCAVAX', DOT: 'XTVCDOT', MATIC: 'XTVCMATIC',
  LINK: 'XTVCLINK', LTC: 'XTVCLTC', UNI: 'XTVCUNI', ATOM: 'XTVCATOM', SHIB: 'XTVCSHIB',
  TRX: 'XTVCTRX', NEAR: 'XTVCNEAR', XLM: 'XTVCXLM', BCH: 'XTVCBCH', FIL: 'XTVCFIL',
  ALGO: 'XTVCALGO', VET: 'XTVCVET', ICP: 'XTVCICP', APE: 'XTVCAPE', SAND: 'XTVCSAND',
  MANA: 'XTVCMANA', AAVE: 'XTVCAAVE', GRT: 'XTVCGRT', CRV: 'XTVCCRV', USDT: 'XTVCUSDT',
  USDC: 'XTVCUSDC', DAI: 'XTVCDAI',
};

const FOREX_FLAGS = {
  EUR: 'eu', GBP: 'gb', JPY: 'jp', USD: 'us', ARS: 'ar', BRL: 'br', MXN: 'mx',
  CAD: 'ca', AUD: 'au', NZD: 'nz', CHF: 'ch', CNY: 'cn', HKD: 'hk', SGD: 'sg', KRW: 'kr',
};

const COMMODITY_SLUGS = {
  'GC=F':  'metal/gold',
  'SI=F':  'metal/silver',
  'CL=F':  'crude-oil',
  'BZ=F':  'crude-oil',
  'NG=F':  'natural-gas',
  'HG=F':  'metal/copper',
  'PL=F':  'metal/platinum',
  'PA=F':  'metal/palladium',
  'ZW=F':  'commodity/wheat',
  'ZS=F':  'soybean',
  'ZC=F':  'commodity/corn',
  'KC=F':  'commodity/coffee',
  'CC=F':  'cocoa',
  'SB=F':  'commodity/sugar',
  'CT=F':  'commodity/cotton',
  'RB=F':  'crude-oil',
};

const COMMODITY_FALLBACK = {
  'GC=F':  { label: 'XAU', color: '#F5C518', bg: 'rgba(245,197,24,0.18)' },
  'SI=F':  { label: 'XAG', color: '#C0C0C0', bg: 'rgba(192,192,192,0.18)' },
  'CL=F':  { label: 'OIL', color: '#FF8A4C', bg: 'rgba(255,138,76,0.18)' },
  'BZ=F':  { label: 'BRN', color: '#FF6B35', bg: 'rgba(255,107,53,0.18)' },
  'NG=F':  { label: 'GAS', color: '#5BC9FF', bg: 'rgba(91,201,255,0.18)' },
  'HG=F':  { label: 'Cu',  color: '#CD7F32', bg: 'rgba(205,127,50,0.18)' },
  'ZC=F':  { label: 'ZC',  color: '#22D67A', bg: 'rgba(34,214,122,0.18)' },
  'ZS=F':  { label: 'ZS',  color: '#86EFAC', bg: 'rgba(134,239,172,0.18)' },
  'ZW=F':  { label: 'ZW',  color: '#FCD34D', bg: 'rgba(252,211,77,0.18)' },
  'PL=F':  { label: 'XPT', color: '#E2E8F0', bg: 'rgba(226,232,240,0.18)' },
  'PA=F':  { label: 'XPD', color: '#93C5FD', bg: 'rgba(147,197,253,0.18)' },
  'RB=F':  { label: 'RB',  color: '#FB923C', bg: 'rgba(251,146,60,0.18)' },
  'KC=F':  { label: 'KFE', color: '#A16207', bg: 'rgba(161,98,7,0.25)' },
  'SB=F':  { label: 'SU',  color: '#F472B6', bg: 'rgba(244,114,182,0.18)' },
  'CC=F':  { label: 'CC',  color: '#92400E', bg: 'rgba(146,64,14,0.25)' },
  'CT=F':  { label: 'CT',  color: '#F9FAFB', bg: 'rgba(249,250,251,0.12)' },
};

export const COMMODITY_NAMES = {
  'GC=F':  'Oro',
  'SI=F':  'Plata',
  'CL=F':  'Petróleo WTI',
  'BZ=F':  'Petróleo Brent',
  'NG=F':  'Gas Natural',
  'HG=F':  'Cobre',
  'PL=F':  'Platino',
  'PA=F':  'Paladio',
  'ZW=F':  'Trigo',
  'ZS=F':  'Soja',
  'ZC=F':  'Maíz',
  'KC=F':  'Café',
  'CC=F':  'Cacao',
  'SB=F':  'Azúcar',
  'CT=F':  'Algodón',
  'RB=F':  'Gasolina',
};

const INDEX_SLUGS = {
  '^GSPC': 'sp-500', '^IXIC': 'nasdaq-composite', '^DJI': 'dow-jones',
  '^RUT': 'russell-2000', '^VIX': 'cboe-volatility-index', '^MERV': 'merval',
  '^FTSE': 'ftse-100', '^N225': 'nikkei-225', '^GDAXI': 'dax',
};

function commoditySvg(symbol) {
  const cfg = COMMODITY_FALLBACK[symbol] || {
    label: symbol.replace('=F', '').slice(0, 3),
    color: '#FF8A4C',
    bg: 'rgba(255,138,76,0.18)',
  };
  const fs = cfg.label.length > 2 ? '10' : '13';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${cfg.bg}"/><text x="20" y="25" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-size="${fs}" font-weight="700" fill="${cfg.color}">${cfg.label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function stripSuffix(symbol) {
  return symbol.replace(/\.\w+$/, '').replace(/-USD$/, '').replace(/=X$/, '').replace(/=F$/, '');
}

export function logoFor(symbol, quoteType) {
  if (!symbol) return placeholderDataUri(symbol);
  const sym = symbol.toUpperCase();
  const type = (quoteType || '').toUpperCase();

  if (type === 'CRYPTOCURRENCY' || sym.endsWith('-USD')) {
    const base = stripSuffix(sym);
    const slug = CRYPTO_SLUGS[base];
    if (slug) return `${TV_BASE}/crypto/${slug}.svg`;
  }

  if (type === 'CURRENCY' || sym.endsWith('=X')) {
    const base = sym.replace('=X', '');
    const from = base.slice(0, 3);
    const flag = FOREX_FLAGS[from];
    if (flag) return `${TV_BASE}/country/${flag}.svg`;
  }

  if (sym.endsWith('=F')) {
    const commoditySlug = COMMODITY_SLUGS[sym];
    if (commoditySlug) return `${TV_BASE}/${commoditySlug}.svg`;
    return commoditySvg(sym);
  }

  if (sym.startsWith('^')) {
    const slug = INDEX_SLUGS[sym];
    if (slug) return `${TV_BASE}/indices/${slug}.svg`;
  }

  const base = stripSuffix(sym);
  const stockSlug = STOCK_SLUGS[base] || ETF_SLUGS[base];
  if (stockSlug) return `${TV_BASE}/${stockSlug}.svg`;

  return placeholderDataUri(symbol);
}

export function placeholderDataUri(symbol) {
  const letter = (symbol || '?').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#1f2128"/><text x="20" y="25" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="14" font-weight="700" fill="#9ca3af">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function logoImg(symbol, quoteType, size = 40) {
  const url = logoFor(symbol, quoteType);
  const fallback = placeholderDataUri(symbol).replace(/"/g, '&quot;');
  return `<img class="asset-logo" src="${url}" width="${size}" height="${size}" alt="${symbol}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" />`;
}
