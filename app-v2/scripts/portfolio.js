import { getState } from './state.js';

/**
 * Convierte un monto en `currency` a USD usando las tasas del estado.
 * Retorna null si no hay tasa disponible (evita conversiones inventadas).
 * Caso especial: GBp (peniques de Londres) = GBP / 100.
 */
function toUSD(amount, currency, fxRates, ccl) {
  if (amount == null) return null;
  if (currency === 'USD') return amount;
  if (currency === 'ARS') return ccl != null && ccl > 0 ? amount / ccl : null;
  if (currency === 'GBp') {
    const gbpRate = fxRates['GBP'] ?? null;
    return gbpRate != null ? (amount / 100) * gbpRate : null;
  }
  const rate = fxRates[currency] ?? null;
  return rate != null ? amount * rate : null;
}

export function computeHoldings() {
  const { portfolio, quotes, ccl, fxRates } = getState();

  const rows = portfolio.map(p => {
    const q = quotes[p.symbol];
    const currency = q?.currency || p.currency || 'USD';

    // null = sin cotización real; nunca 0 (evita P&L −100% falso)
    const rawPrice = q?.price ?? null;
    const hasQuote = rawPrice != null && rawPrice > 0;
    const price = hasQuote ? rawPrice : null;

    const valueNative = price != null ? price * p.quantity : null;
    const costNative = p.avgPrice * p.quantity;
    const pnlNative = valueNative != null ? valueNative - costNative : null;
    const pnlPct = pnlNative != null && costNative > 0 ? (pnlNative / costNative) * 100 : null;

    // Precio para visualización: usa pre/post market cuando el mercado está en esa sesión
    let displayPrice = price;
    if (q?.marketState === 'PRE' && q?.preMarketPrice > 0) displayPrice = q.preMarketPrice;
    else if ((q?.marketState === 'POST' || q?.marketState === 'POSTPOST') && q?.postMarketPrice > 0) displayPrice = q.postMarketPrice;

    let valueARS, costARS, valueUSD;

    if (currency === 'ARS') {
      // Activo local: valor nativo ya está en ARS
      valueARS = valueNative;
      costARS = costNative;
      valueUSD = valueNative != null && ccl != null && ccl > 0 ? valueNative / ccl : null;
    } else {
      // Activo externo: convertir a USD primero, después a ARS
      const priceUSD = toUSD(price, currency, fxRates, ccl);
      const costUSD = toUSD(p.avgPrice, currency, fxRates, ccl);
      valueUSD = priceUSD != null ? priceUSD * p.quantity : null;
      const costUSDTotal = costUSD != null ? costUSD * p.quantity : null;
      valueARS = valueUSD != null && ccl != null ? valueUSD * ccl : null;
      costARS = costUSDTotal != null && ccl != null ? costUSDTotal * ccl : null;
    }

    return {
      ...p,
      price,
      displayPrice,
      currency,
      hasQuote,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
      quoteType: q?.quoteType || p.quoteType,
      marketState: q?.marketState ?? null,
      quoteAge: q?.updatedAt ? Date.now() - q.updatedAt : null,
      valueNative,
      costNative,
      pnlNative,
      pnlPct,
      valueARS,
      costARS,
      valueUSD,
    };
  });

  // Las filas sin cotización aportan 0 al total (no NaN)
  const totalValueARS = rows.reduce((s, r) => s + (r.valueARS ?? 0), 0);
  const totalCostARS = rows.reduce((s, r) => s + (r.costARS ?? 0), 0);
  const totalValueUSD = rows.reduce((s, r) => s + (r.valueUSD ?? 0), 0);
  const totalPnL = totalValueARS - totalCostARS;
  const totalPnLPct = totalCostARS > 0 ? (totalPnL / totalCostARS) * 100 : 0;

  for (const r of rows) {
    r.weight = totalValueARS > 0 && r.valueARS != null ? (r.valueARS / totalValueARS) * 100 : 0;
  }

  return {
    rows,
    summary: {
      totalValueARS,
      totalValueUSD,
      totalPnL,
      totalPnLPct,
      count: rows.length,
      hasCCL: ccl != null,
      hasAllQuotes: rows.length > 0 && rows.every(r => r.hasQuote),
    },
  };
}

export function groupByType(rows) {
  const groups = {};
  for (const r of rows) {
    const key = r.quoteType || 'OTHER';
    if (!groups[key]) groups[key] = { type: key, value: 0, items: [] };
    groups[key].value += r.valueARS ?? 0;
    groups[key].items.push(r);
  }
  return Object.values(groups);
}
