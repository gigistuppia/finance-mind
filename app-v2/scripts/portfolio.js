import { getState } from './state.js';

/**
 * Convierte un monto en `currency` a USD.
 * Caso especial: GBp (peniques de Londres) = GBP / 100.
 * Retorna null si no hay tasa disponible — nunca inventa un valor.
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

/**
 * Calcula posiciones usando Precio Promedio Ponderado (PPP).
 * Método estándar de brokers argentinos.
 * Entrada: array de transacciones ordenadas por date+createdAt.
 * Salida: Map<symbol, position>
 */
export function computePositions(transactions) {
  const sorted = [...transactions].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.createdAt - b.createdAt;
  });

  const positions = new Map();

  for (const tx of sorted) {
    if (!positions.has(tx.symbol)) {
      positions.set(tx.symbol, {
        symbol: tx.symbol,
        name: tx.name,
        quoteType: tx.quoteType,
        exchange: tx.exchange,
        currency: tx.currency,
        quantity: 0,
        totalCostBasis: 0,   // Σ qty*price + fee de compras no vendidas
        avgPrice: 0,
        realizedPnL: 0,      // ganancia/pérdida de ventas cerradas
        totalFees: 0,
        firstBuyDate: tx.date,
        // Para doble P&L (ARS real): costo histórico en ARS
        costARShistorico: 0,
        fxApproximate: false,  // true si alguna tx migrada sin fxRateUsed
      });
    }

    const pos = positions.get(tx.symbol);

    if (tx.type === 'buy') {
      const txCost = tx.quantity * tx.price + (tx.fee ?? 0);
      pos.totalCostBasis += txCost;
      pos.quantity += tx.quantity;
      pos.avgPrice = pos.quantity > 0 ? pos.totalCostBasis / pos.quantity : 0;
      pos.totalFees += tx.fee ?? 0;
      // Acumular costo ARS histórico usando el CCL del momento de la compra
      const fxUsed = tx.fxRateUsed;
      if (fxUsed != null) {
        pos.costARShistorico += txCost * fxUsed;
      } else {
        pos.fxApproximate = true; // se completará en computeHoldings con el CCL actual
        // Guardamos el txCost sin FX para completar después
        pos._pendingCostUSD = (pos._pendingCostUSD ?? 0) + txCost;
      }
    } else if (tx.type === 'sell') {
      const sellPnL = tx.quantity * (tx.price - pos.avgPrice) - (tx.fee ?? 0);
      pos.realizedPnL += sellPnL;
      pos.totalCostBasis -= tx.quantity * pos.avgPrice;
      pos.quantity -= tx.quantity;
      pos.totalFees += tx.fee ?? 0;
      if (pos.quantity <= 0) {
        pos.quantity = 0;
        pos.totalCostBasis = 0;
        pos.avgPrice = 0;
        pos.costARShistorico = 0;
        pos._pendingCostUSD = 0;
      }
    }
  }

  return positions;
}

export function computeHoldings() {
  const { transactions, quotes, ccl, fxRates } = getState();

  const positions = computePositions(transactions);

  const rows = [];
  for (const [, pos] of positions) {
    if (pos.quantity <= 0) continue; // posición cerrada — no aparece en el dashboard

    const q = quotes[pos.symbol];
    const currency = q?.currency || pos.currency || 'USD';

    const rawPrice = q?.price ?? null;
    const hasQuote = rawPrice != null && rawPrice > 0;
    const price = hasQuote ? rawPrice : null;

    const valueNative = price != null ? price * pos.quantity : null;
    const pnlNative = valueNative != null ? valueNative - pos.totalCostBasis : null;
    const pnlPct = pnlNative != null && pos.totalCostBasis > 0
      ? (pnlNative / pos.totalCostBasis) * 100
      : null;

    // Precio extendido para display (pre/post market)
    let displayPrice = price;
    if (q?.marketState === 'PRE' && q?.preMarketPrice > 0) displayPrice = q.preMarketPrice;
    else if ((q?.marketState === 'POST' || q?.marketState === 'POSTPOST') && q?.postMarketPrice > 0) displayPrice = q.postMarketPrice;

    let valueARS, costARS, valueUSD, costARShistoricoFinal;

    // Completar costo ARS histórico de txs migradas (fxRateUsed = null) con CCL actual
    if (pos.fxApproximate && pos._pendingCostUSD > 0 && ccl != null) {
      costARShistoricoFinal = (pos.costARShistorico ?? 0) + pos._pendingCostUSD * ccl;
    } else {
      costARShistoricoFinal = pos.costARShistorico ?? 0;
    }

    if (currency === 'ARS') {
      valueARS = valueNative;
      costARS = pos.totalCostBasis;
      valueUSD = valueNative != null && ccl != null && ccl > 0 ? valueNative / ccl : null;
      // Para ARS, costARShistorico = costo nativo (sin conversión)
      costARShistoricoFinal = pos.totalCostBasis;
    } else {
      const priceUSD = toUSD(price, currency, fxRates, ccl);
      const avgPriceUSD = toUSD(pos.avgPrice, currency, fxRates, ccl);
      valueUSD = priceUSD != null ? priceUSD * pos.quantity : null;
      const costUSDTotal = avgPriceUSD != null ? avgPriceUSD * pos.quantity : null;
      valueARS = valueUSD != null && ccl != null ? valueUSD * ccl : null;
      costARS = costUSDTotal != null && ccl != null ? costUSDTotal * ccl : null;
    }

    // P&L en ARS reales (captura devaluación entre compra y hoy)
    const pnlARSReal = valueARS != null && costARShistoricoFinal > 0
      ? valueARS - costARShistoricoFinal
      : null;
    const pnlARSRealPct = pnlARSReal != null && costARShistoricoFinal > 0
      ? (pnlARSReal / costARShistoricoFinal) * 100
      : null;

    rows.push({
      id: pos.symbol,  // id estable para el botón de eliminar
      symbol: pos.symbol,
      name: pos.name,
      quoteType: pos.quoteType,
      exchange: pos.exchange,
      currency,
      quantity: pos.quantity,
      avgPrice: pos.avgPrice,
      price,
      displayPrice,
      hasQuote,
      change: q?.change ?? null,
      changePercent: q?.changePercent ?? null,
      marketState: q?.marketState ?? null,
      quoteAge: q?.updatedAt ? Date.now() - q.updatedAt : null,
      valueNative,
      costNative: pos.totalCostBasis,
      pnlNative,
      pnlPct,
      valueARS,
      costARS,
      valueUSD,
      // Doble P&L
      pnlARSReal,
      pnlARSRealPct,
      costARShistorico: costARShistoricoFinal,
      fxApproximate: pos.fxApproximate,
      // Ganancia realizada (ventas previas de este símbolo)
      realizedPnL: pos.realizedPnL,
      totalFees: pos.totalFees,
    });
  }

  const totalValueARS = rows.reduce((s, r) => s + (r.valueARS ?? 0), 0);
  const totalCostARS = rows.reduce((s, r) => s + (r.costARS ?? 0), 0);
  const totalValueUSD = rows.reduce((s, r) => s + (r.valueUSD ?? 0), 0);
  const totalPnL = totalValueARS - totalCostARS;
  const totalPnLPct = totalCostARS > 0 ? (totalPnL / totalCostARS) * 100 : 0;
  const totalRealizedPnL = rows.reduce((s, r) => s + (r.realizedPnL ?? 0), 0);
  const totalCostARSHistorico = rows.reduce((s, r) => s + (r.costARShistorico ?? 0), 0);
  const totalPnLARSReal = totalValueARS > 0 && totalCostARSHistorico > 0
    ? totalValueARS - totalCostARSHistorico
    : null;
  const totalPnLARSRealPct = totalPnLARSReal != null && totalCostARSHistorico > 0
    ? (totalPnLARSReal / totalCostARSHistorico) * 100
    : null;

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
      totalRealizedPnL,
      totalPnLARSReal,
      totalPnLARSRealPct,
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
