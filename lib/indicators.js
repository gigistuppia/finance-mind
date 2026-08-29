/**
 * Indicadores técnicos deterministas.
 *
 * REGLA DE ORO (CLAUDE.md §12.1): el LLM no calcula nada. Todo lo que sale de
 * acá son hechos verificables que se le entregan cerrados al modelo.
 *
 * Convención de alineación: toda serie devuelta tiene la MISMA longitud que la
 * entrada, con `null` en el período de calentamiento. Devolver arrays cortos y
 * alinearlos a mano después es la fuente número uno de bugs off-by-one en
 * análisis técnico, y un RSI corrido un día miente sin avisar.
 */

/* ────────────────────────── helpers ────────────────────────── */

function last(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] != null) return series[i];
  }
  return null;
}

function round(v, d = 4) {
  if (v == null || !isFinite(v)) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/* ────────────────────────── medias ────────────────────────── */

/** Media móvil simple. */
function sma(values, period) {
  const out = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Media móvil exponencial, sembrada con la SMA del primer período. */
function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;

  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/** Desvío estándar poblacional móvil. */
function stddev(values, period) {
  const out = new Array(values.length).fill(null);
  const means = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    const m = means[i];
    if (m == null) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - m) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

/* ────────────────────────── osciladores ────────────────────────── */

/**
 * RSI con suavizado de Wilder (el estándar, no la media simple).
 * Primer valor en el índice `period`.
 */
function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** MACD(12,26,9). La señal es EMA9 de la línea MACD, no de los precios. */
function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const line = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );

  // La EMA de la señal solo puede empezar donde la línea MACD ya existe.
  const firstIdx = line.findIndex(v => v != null);
  const signal = new Array(closes.length).fill(null);

  if (firstIdx !== -1) {
    const compact = line.slice(firstIdx);
    const sig = ema(compact, signalPeriod);
    for (let i = 0; i < sig.length; i++) signal[firstIdx + i] = sig[i];
  }

  const histogram = closes.map((_, i) =>
    line[i] != null && signal[i] != null ? line[i] - signal[i] : null
  );

  return { line, signal, histogram };
}

/* ────────────────────────── volatilidad ────────────────────────── */

/** ATR con suavizado de Wilder. Mide volatilidad real, no dirección. */
function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  const tr = new Array(candles.length).fill(null);
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].c;
    tr[i] = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - prevClose),
      Math.abs(candles[i].l - prevClose)
    );
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;

  for (let i = period + 1; i < candles.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

/** Bandas de Bollinger + ancho de banda y %B. */
function bollinger(closes, period = 20, mult = 2) {
  const middle = sma(closes, period);
  const sd = stddev(closes, period);

  const upper = [], lower = [], bandwidth = [], percentB = [];
  for (let i = 0; i < closes.length; i++) {
    if (middle[i] == null || sd[i] == null) {
      upper.push(null); lower.push(null); bandwidth.push(null); percentB.push(null);
      continue;
    }
    const u = middle[i] + mult * sd[i];
    const l = middle[i] - mult * sd[i];
    upper.push(u);
    lower.push(l);
    bandwidth.push(middle[i] !== 0 ? ((u - l) / middle[i]) * 100 : null);
    percentB.push(u !== l ? ((closes[i] - l) / (u - l)) * 100 : null);
  }
  return { upper, middle, lower, bandwidth, percentB };
}

/* ────────────────────────── volumen y riesgo ────────────────────────── */

/** Volumen de hoy contra su media de `period` días. 2.0 = el doble de lo normal. */
function relativeVolume(candles, period = 20) {
  const vols = candles.map(c => c.v || 0);
  const avg = sma(vols, period);
  return candles.map((c, i) =>
    avg[i] != null && avg[i] > 0 ? (c.v || 0) / avg[i] : null
  );
}

/** Caída desde el máximo histórico de la serie, en %. Siempre <= 0. */
function drawdown(closes) {
  let peak = -Infinity;
  return closes.map(c => {
    if (c > peak) peak = c;
    return peak > 0 ? ((c - peak) / peak) * 100 : null;
  });
}

/* ────────────────────────── soportes y resistencias ────────────────────────── */

/**
 * Pivotes locales: máximos/mínimos con `strength` velas a cada lado más bajas
 * (o más altas). Base de soportes, resistencias y detección de patrones.
 */
function pivots(candles, strength = 5) {
  const highs = [], lows = [];
  for (let i = strength; i < candles.length - strength; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - strength; j <= i + strength; j++) {
      if (j === i) continue;
      if (candles[j].h >= candles[i].h) isHigh = false;
      if (candles[j].l <= candles[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ i, price: candles[i].h, t: candles[i].t });
    if (isLow) lows.push({ i, price: candles[i].l, t: candles[i].t });
  }
  return { highs, lows };
}

/**
 * Agrupa pivotes cercanos en niveles. Un pivote suelto no es un nivel: un nivel
 * es un precio TOCADO VARIAS VECES. El conteo de toques es la medida de
 * confianza, y es lo que después justifica o descarta la mención en el informe.
 *
 * Se agrupan máximos y mínimos juntos a propósito: una resistencia rota se
 * convierte en soporte, y el mercado recuerda el precio, no el rol.
 */
function clusterLevels(pivotList, tolerancePct = 1.5) {
  if (pivotList.length === 0) return [];

  const sorted = [...pivotList].sort((a, b) => a.price - b.price);
  const clusters = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const base = current[0].price;
    if (base > 0 && ((sorted[i].price - base) / base) * 100 <= tolerancePct) {
      current.push(sorted[i]);
    } else {
      clusters.push(current);
      current = [sorted[i]];
    }
  }
  clusters.push(current);

  return clusters.map(group => ({
    price: group.reduce((s, p) => s + p.price, 0) / group.length,
    toques: group.length,
    ultimoToque: Math.max(...group.map(p => p.t)),
  }));
}

/**
 * Soporte y resistencia más cercanos, exigiendo que sean niveles de verdad:
 *   - agrupados por toques (no un pivote suelto)
 *   - a más de 0.5 ATR del precio actual — un "nivel" pegado al precio no
 *     informa nada, solo describe dónde estamos parados
 *
 * Devuelve null cuando no hay nivel que cumpla. Decir "no hay" es correcto;
 * inventar un número es lo que hace que un informe parezca preciso y mienta.
 */
function nearestLevels(candles, { strength = 5, lookback = 180, tolerancePct = 1.5, atrValue = null } = {}) {
  const slice = candles.slice(-lookback);
  const { highs, lows } = pivots(slice, strength);
  const price = candles[candles.length - 1].c;

  const all = clusterLevels([...highs, ...lows], tolerancePct);

  // Un nivel más cerca que medio ATR es indistinguible del precio actual.
  const minDist = atrValue != null ? atrValue * 0.5 : price * 0.005;

  const pick = (candidatos) => {
    // Preferimos niveles con 2+ toques; si no hay, aceptamos 1 y lo marcamos.
    const confirmados = candidatos.filter(c => c.toques >= 2);
    return confirmados.length ? confirmados[0] : (candidatos[0] || null);
  };

  const arriba = all.filter(c => c.price - price >= minDist).sort((a, b) => a.price - b.price);
  const abajo  = all.filter(c => price - c.price >= minDist).sort((a, b) => b.price - a.price);

  const res = pick(arriba);
  const sop = pick(abajo);

  return {
    resistencia: res ? round(res.price, 2) : null,
    resistenciaToques: res ? res.toques : null,
    distanciaResistenciaPct: res ? round(((res.price - price) / price) * 100, 2) : null,
    soporte: sop ? round(sop.price, 2) : null,
    soporteToques: sop ? sop.toques : null,
    distanciaSoportePct: sop ? round(((sop.price - price) / price) * 100, 2) : null,
  };
}

/* ────────────────────────── snapshot ────────────────────────── */

/**
 * Calcula todo y devuelve el paquete de hechos que consume el analista.
 * `series` queda aparte porque patterns.js la necesita, pero NO va al prompt:
 * el modelo recibe solo `snapshot`, que son números finales y legibles.
 */
function computeAll(candles) {
  if (!Array.isArray(candles) || candles.length < 30) {
    throw new Error(`Serie demasiado corta: ${candles?.length ?? 0} velas (mínimo 30)`);
  }

  const closes = candles.map(c => c.c);
  const n = candles.length;

  const series = {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    atr14: atr(candles, 14),
    bollinger: bollinger(closes, 20, 2),
    relVolume: relativeVolume(candles, 20),
    drawdown: drawdown(closes),
  };

  const price = closes[n - 1];
  const prevClose = n > 1 ? closes[n - 2] : null;
  const atrNow = last(series.atr14);

  const snapshot = {
    precio: round(price, 4),
    variacionDiaPct: prevClose ? round(((price - prevClose) / prevClose) * 100, 2) : null,
    variacion5dPct: n > 5 ? round(((price - closes[n - 6]) / closes[n - 6]) * 100, 2) : null,
    variacion20dPct: n > 20 ? round(((price - closes[n - 21]) / closes[n - 21]) * 100, 2) : null,

    rsi14: round(last(series.rsi14), 2),
    macd: round(last(series.macd.line), 4),
    macdSignal: round(last(series.macd.signal), 4),
    macdHistograma: round(last(series.macd.histogram), 4),

    sma20: round(last(series.sma20), 2),
    sma50: round(last(series.sma50), 2),
    sma200: round(last(series.sma200), 2),

    atr14: round(atrNow, 4),
    // ATR en % del precio: comparable entre BTC y una acción de $10.
    atrPct: atrNow && price ? round((atrNow / price) * 100, 2) : null,

    bollingerPercentB: round(last(series.bollinger.percentB), 1),
    bollingerAncho: round(last(series.bollinger.bandwidth), 2),

    volumenRelativo: round(last(series.relVolume), 2),
    drawdownDesdeMaximoPct: round(last(series.drawdown), 2),

    velasUsadas: n,
    desde: new Date(candles[0].t).toISOString().slice(0, 10),
    hasta: new Date(candles[n - 1].t).toISOString().slice(0, 10),

    // El ATR define qué distancia es "significativa" para este activo:
    // 1% es mucho en un bono y nada en una cripto.
    ...nearestLevels(candles, { atrValue: atrNow }),
  };

  // Lecturas cualitativas: describen, nunca recomiendan (CLAUDE.md §14.14).
  snapshot.lecturas = {
    rsi: snapshot.rsi14 == null ? 'sin dato'
      : snapshot.rsi14 >= 70 ? 'sobrecompra'
      : snapshot.rsi14 <= 30 ? 'sobreventa'
      : 'neutral',
    posicionVsMedias: describirMedias(price, snapshot.sma20, snapshot.sma50, snapshot.sma200),
    volumen: snapshot.volumenRelativo == null ? 'sin dato'
      : snapshot.volumenRelativo >= 2 ? 'muy por encima de lo habitual'
      : snapshot.volumenRelativo >= 1.3 ? 'por encima de lo habitual'
      : snapshot.volumenRelativo <= 0.6 ? 'por debajo de lo habitual'
      : 'normal',
  };

  return { snapshot, series, candles };
}

function describirMedias(price, sma20, sma50, sma200) {
  const partes = [];
  if (sma20 != null) partes.push(`${price > sma20 ? 'sobre' : 'bajo'} SMA20`);
  if (sma50 != null) partes.push(`${price > sma50 ? 'sobre' : 'bajo'} SMA50`);
  if (sma200 != null) partes.push(`${price > sma200 ? 'sobre' : 'bajo'} SMA200`);
  return partes.length ? partes.join(', ') : 'sin medias disponibles';
}

module.exports = {
  sma, ema, stddev, rsi, macd, atr, bollinger,
  relativeVolume, drawdown, pivots, clusterLevels, nearestLevels,
  computeAll, last, round,
};
