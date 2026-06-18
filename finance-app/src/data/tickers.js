// Formato Yahoo Finance: TICKER.BA para CEDEARs y acciones argentinas en BYMA
export const TICKERS = {
  // CEDEARs US Tech
  AAPL: 'Apple', MSFT: 'Microsoft', GOOGL: 'Alphabet',
  AMZN: 'Amazon', TSLA: 'Tesla', META: 'Meta',
  NVDA: 'NVIDIA', JPM: 'JPMorgan', BAC: 'Bank of America',
  WMT: 'Walmart', V: 'Visa', MA: 'Mastercard',
  NFLX: 'Netflix', DIS: 'Disney', PYPL: 'PayPal',
  INTC: 'Intel', AMD: 'AMD', CRM: 'Salesforce',
  ORCL: 'Oracle', COIN: 'Coinbase', UBER: 'Uber',
  SPOT: 'Spotify', SHOP: 'Shopify', SQ: 'Block',
  // CEDEARs Finance
  BRK: 'Berkshire', GS: 'Goldman Sachs', MS: 'Morgan Stanley',
  // Acciones argentinas
  GGAL: 'Grupo Galicia', YPFD: 'YPF', BMA: 'Banco Macro',
  PAMP: 'Pampa Energía', ALUA: 'Aluar', TXAR: 'Ternium',
  COME: 'Sociedad Comercial', LOMA: 'Loma Negra', CEPU: 'Central Puerto',
  TECO2: 'Telecom', SUPV: 'Grupo Supervielle',
  MELI: 'MercadoLibre', GLOB: 'Globant',
};

// Mapeo especial de tickers a símbolos Yahoo Finance cuando difieren de TICKER.BA
export const YAHOO_SYMBOL_MAP = {
  BRK: 'BRK-B.BA',    // Berkshire B en BYMA
  GOOGL: 'GOOGL.BA',  // o GOOG.BA
};

export function toYahooSymbol(ticker) {
  return YAHOO_SYMBOL_MAP[ticker] || `${ticker}.BA`;
}

export const GEMINI_COLORS = [
  '#4285F4', '#34A853', '#FBBC05', '#EA4335',
  '#1C8AFF', '#00BCD4', '#FF5722', '#FF9800',
  '#0097A7', '#43A047', '#F57C00', '#C62828',
];
