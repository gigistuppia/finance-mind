import { getState } from './state.js';

export function computeHoldings() {
  const { portfolio, quotes, ccl } = getState();

  const rows = portfolio.map(p => {
    const q = quotes[p.symbol];
    const price = q?.price ?? p.avgPrice;
    const currency = q?.currency || p.currency || 'USD';

    const valueNative = price * p.quantity;
    const costNative = p.avgPrice * p.quantity;
    const pnlNative = valueNative - costNative;
    const pnlPct = costNative > 0 ? (pnlNative / costNative) * 100 : 0;

    const fxToARS = currency === 'ARS' ? 1 : ccl;
    const valueARS = valueNative * fxToARS;
    const costARS = costNative * fxToARS;
    const valueUSD = currency === 'ARS' ? valueNative / ccl : valueNative;

    return {
      ...p,
      price,
      currency,
      change: q?.change ?? 0,
      changePercent: q?.changePercent ?? 0,
      quoteType: q?.quoteType || p.quoteType,
      valueNative,
      costNative,
      pnlNative,
      pnlPct,
      valueARS,
      costARS,
      valueUSD,
    };
  });

  const totalValueARS = rows.reduce((s, r) => s + r.valueARS, 0);
  const totalCostARS = rows.reduce((s, r) => s + r.costARS, 0);
  const totalValueUSD = rows.reduce((s, r) => s + r.valueUSD, 0);
  const totalPnL = totalValueARS - totalCostARS;
  const totalPnLPct = totalCostARS > 0 ? (totalPnL / totalCostARS) * 100 : 0;

  for (const r of rows) {
    r.weight = totalValueARS > 0 ? (r.valueARS / totalValueARS) * 100 : 0;
  }

  return {
    rows,
    summary: {
      totalValueARS,
      totalValueUSD,
      totalPnL,
      totalPnLPct,
      count: rows.length,
    },
  };
}

export function groupByType(rows) {
  const groups = {};
  for (const r of rows) {
    const key = r.quoteType || 'OTHER';
    if (!groups[key]) groups[key] = { type: key, value: 0, items: [] };
    groups[key].value += r.valueARS;
    groups[key].items.push(r);
  }
  return Object.values(groups);
}
