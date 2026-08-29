/**
 * Detección de patrones gráficos, determinista.
 *
 * ADVERTENCIA DE DISEÑO (CLAUDE.md §14.5): los patrones técnicos tienen valor
 * predictivo pobre y bien documentado. Un death cross acierta poco más que una
 * moneda. Por eso acá:
 *
 *   1. Todo patrón sale con `confiabilidad` explícita, nunca como certeza.
 *   2. La confiabilidad sube solo con CORROBORACIÓN real (volumen, distancia,
 *      cantidad de toques), no con la opinión del detector.
 *   3. `evaluados` lista todo lo que se buscó, para que el informe pueda decir
 *      "se buscaron 8 patrones y no apareció ninguno" — que es información,
 *      no ausencia de información.
 *
 * El modelo interpreta esto. No lo calcula ni lo puede contradecir.
 */

const { pivots, esMercadoContinuo } = require('./indicators.js');

const DIAS_RECIENTE = 10; // un cruce de hace 3 meses no explica el precio de hoy

/* ────────────────────── cruces de medias ────────────────────── */

/** Índice del último cruce entre dos series, o -1. */
function ultimoCruce(a, b, desde = 0) {
  for (let i = a.length - 1; i > desde; i--) {
    if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
    const ahora = a[i] - b[i];
    const antes = a[i - 1] - b[i - 1];
    if (ahora === 0 || antes === 0) continue;
    if (Math.sign(ahora) !== Math.sign(antes)) {
      return { i, direccion: ahora > 0 ? 'alcista' : 'bajista' };
    }
  }
  return null;
}

function crucesDeMedias(candles, series) {
  const out = [];
  const n = candles.length;

  const largo = ultimoCruce(series.sma50, series.sma200);
  if (largo && n - 1 - largo.i <= 60) {
    const dias = n - 1 - largo.i;
    out.push({
      nombre: largo.direccion === 'alcista' ? 'Golden cross (SMA50/SMA200)' : 'Death cross (SMA50/SMA200)',
      direccion: largo.direccion,
      haceDias: dias,
      // Documentadamente flojo como señal aislada. No se sube de "media" nunca.
      confiabilidad: dias <= DIAS_RECIENTE ? 'media' : 'baja',
      detalle: `SMA50 cruzó ${largo.direccion === 'alcista' ? 'por encima de' : 'por debajo de'} SMA200 hace ${dias} ruedas`,
    });
  }

  const corto = ultimoCruce(series.sma20, series.sma50);
  if (corto && n - 1 - corto.i <= DIAS_RECIENTE) {
    out.push({
      nombre: `Cruce SMA20/SMA50 ${corto.direccion}`,
      direccion: corto.direccion,
      haceDias: n - 1 - corto.i,
      confiabilidad: 'baja',
      detalle: `Cruce de medias cortas hace ${n - 1 - corto.i} ruedas. Señal de corto plazo, ruidosa por naturaleza.`,
    });
  }

  const macdX = ultimoCruce(series.macd.line, series.macd.signal);
  if (macdX && n - 1 - macdX.i <= DIAS_RECIENTE) {
    out.push({
      nombre: `Cruce de MACD ${macdX.direccion}`,
      direccion: macdX.direccion,
      haceDias: n - 1 - macdX.i,
      confiabilidad: 'baja',
      detalle: `La línea MACD cruzó su señal hace ${n - 1 - macdX.i} ruedas`,
    });
  }

  return out;
}

/* ────────────────────── divergencias de RSI ────────────────────── */

/**
 * Divergencia: el precio hace un extremo nuevo y el RSI no lo acompaña.
 * De los patrones acá presentes es el que mejor reputación empírica tiene,
 * pero sigue sin ser una garantía.
 */
function divergenciasRSI(candles, series, { ventana = 90, minSeparacion = 8 } = {}) {
  const out = [];
  const slice = candles.slice(-ventana);
  const offset = candles.length - slice.length;
  const { highs, lows } = pivots(slice, 4);

  const rsiEn = (idxLocal) => series.rsi14[offset + idxLocal];

  if (highs.length >= 2) {
    const [p1, p2] = highs.slice(-2);
    const r1 = rsiEn(p1.i), r2 = rsiEn(p2.i);
    if (r1 != null && r2 != null && p2.i - p1.i >= minSeparacion
        && p2.price > p1.price && r2 < r1) {
      out.push({
        nombre: 'Divergencia bajista de RSI',
        direccion: 'bajista',
        haceDias: slice.length - 1 - p2.i,
        confiabilidad: r1 - r2 >= 5 ? 'media' : 'baja',
        detalle: `Precio hizo máximo más alto (${p1.price.toFixed(2)} → ${p2.price.toFixed(2)}) pero el RSI hizo máximo más bajo (${r1.toFixed(1)} → ${r2.toFixed(1)})`,
      });
    }
  }

  if (lows.length >= 2) {
    const [p1, p2] = lows.slice(-2);
    const r1 = rsiEn(p1.i), r2 = rsiEn(p2.i);
    if (r1 != null && r2 != null && p2.i - p1.i >= minSeparacion
        && p2.price < p1.price && r2 > r1) {
      out.push({
        nombre: 'Divergencia alcista de RSI',
        direccion: 'alcista',
        haceDias: slice.length - 1 - p2.i,
        confiabilidad: r2 - r1 >= 5 ? 'media' : 'baja',
        detalle: `Precio hizo mínimo más bajo (${p1.price.toFixed(2)} → ${p2.price.toFixed(2)}) pero el RSI hizo mínimo más alto (${r1.toFixed(1)} → ${r2.toFixed(1)})`,
      });
    }
  }

  return out;
}

/* ────────────────────── rupturas ────────────────────── */

/**
 * Ruptura de máximo/mínimo de N ruedas. El volumen es lo que separa una
 * ruptura real de una falsa, así que la confiabilidad depende de él.
 */
function rupturas(candles, series, { periodo = 20 } = {}) {
  const n = candles.length;
  if (n < periodo + 2) return [];

  const hoy = candles[n - 1];
  const previas = candles.slice(n - 1 - periodo, n - 1);
  const maxPrev = Math.max(...previas.map(c => c.h));
  const minPrev = Math.min(...previas.map(c => c.l));
  const vol = series.relVolume[n - 1];
  const out = [];

  const confiar = (v) => v == null ? 'baja' : v >= 1.5 ? 'media' : 'baja';

  if (hoy.c > maxPrev) {
    out.push({
      nombre: `Ruptura de máximo de ${periodo} ruedas`,
      direccion: 'alcista',
      haceDias: 0,
      confiabilidad: confiar(vol),
      detalle: `Cierre en ${hoy.c.toFixed(2)} supera el máximo previo de ${maxPrev.toFixed(2)}`
        + (vol != null ? `, con volumen ${vol.toFixed(2)}x el habitual${vol < 1.5 ? ' (sin confirmación de volumen)' : ''}` : ''),
    });
  }

  if (hoy.c < minPrev) {
    out.push({
      nombre: `Ruptura de mínimo de ${periodo} ruedas`,
      direccion: 'bajista',
      haceDias: 0,
      confiabilidad: confiar(vol),
      detalle: `Cierre en ${hoy.c.toFixed(2)} perfora el mínimo previo de ${minPrev.toFixed(2)}`
        + (vol != null ? `, con volumen ${vol.toFixed(2)}x el habitual${vol < 1.5 ? ' (sin confirmación de volumen)' : ''}` : ''),
    });
  }

  return out;
}

/* ────────────────────── dobles techos y pisos ────────────────────── */

function doblesExtremos(candles, { ventana = 120, tolerancePct = 2.5, minSeparacion = 10 } = {}) {
  const slice = candles.slice(-ventana);
  const { highs, lows } = pivots(slice, 5);
  const out = [];

  const cerca = (a, b) => Math.abs(a - b) / ((a + b) / 2) * 100 <= tolerancePct;

  if (highs.length >= 2) {
    const [p1, p2] = highs.slice(-2);
    if (p2.i - p1.i >= minSeparacion && cerca(p1.price, p2.price)) {
      const valle = Math.min(...slice.slice(p1.i, p2.i).map(c => c.l));
      out.push({
        nombre: 'Doble techo',
        direccion: 'bajista',
        haceDias: slice.length - 1 - p2.i,
        confiabilidad: 'baja',
        detalle: `Dos máximos similares en ${p1.price.toFixed(2)} y ${p2.price.toFixed(2)}. `
          + `Solo se confirma si el precio pierde el cuello en ${valle.toFixed(2)}.`,
      });
    }
  }

  if (lows.length >= 2) {
    const [p1, p2] = lows.slice(-2);
    if (p2.i - p1.i >= minSeparacion && cerca(p1.price, p2.price)) {
      const pico = Math.max(...slice.slice(p1.i, p2.i).map(c => c.h));
      out.push({
        nombre: 'Doble piso',
        direccion: 'alcista',
        haceDias: slice.length - 1 - p2.i,
        confiabilidad: 'baja',
        detalle: `Dos mínimos similares en ${p1.price.toFixed(2)} y ${p2.price.toFixed(2)}. `
          + `Solo se confirma si el precio supera el cuello en ${pico.toFixed(2)}.`,
      });
    }
  }

  return out;
}

/* ────────────────────── huecos y compresión ────────────────────── */

/**
 * Hueco de apertura. Depende del régimen de mercado (CLAUDE.md §14.10):
 *
 *   - Con horario de sesión, un hueco es una discontinuidad real: el precio
 *     saltó sin que se pudiera operar. Casi siempre hay una noticia detrás.
 *   - En un mercado continuo 24/7 no existe tal cosa. La "apertura" es un corte
 *     arbitrario a medianoche UTC, y decirle a alguien que su cripto saltó
 *     "fuera de horario" es directamente falso.
 */
function huecos(candles, series, { minPct = 2, continuo = false } = {}) {
  const n = candles.length;
  if (n < 2) return [];
  const prev = candles[n - 2].c;
  const open = candles[n - 1].o;
  if (!prev || !open) return [];

  const pct = ((open - prev) / prev) * 100;
  // En 24/7 el corte diario es arbitrario: exigimos el doble para que sea noticia.
  if (Math.abs(pct) < (continuo ? minPct * 2 : minPct)) return [];

  const atrPct = series.atr14[n - 1] != null ? (series.atr14[n - 1] / prev) * 100 : null;
  const enAtr = atrPct ? ` (${(Math.abs(pct) / atrPct).toFixed(1)}x el ATR diario)` : '';

  return [{
    nombre: continuo
      ? `Salto ${pct > 0 ? 'alcista' : 'bajista'} en el corte diario`
      : `Hueco ${pct > 0 ? 'alcista' : 'bajista'} de apertura`,
    direccion: pct > 0 ? 'alcista' : 'bajista',
    haceDias: 0,
    confiabilidad: continuo ? 'baja' : 'media',
    detalle: continuo
      ? `El precio se movió ${pct.toFixed(2)}% respecto del cierre diario previo${enAtr}. `
        + `Mercado 24/7: no es un hueco real, la vela diaria corta a medianoche UTC.`
      : `Abrió ${pct.toFixed(2)}% respecto del cierre previo${enAtr}. `
        + `Sin operar en el medio: casi siempre responde a una noticia fuera de horario.`,
  }];
}

/** Compresión de volatilidad: bandas de Bollinger en mínimos de varios meses. */
function compresion(candles, series, { ventana = 120 } = {}) {
  const n = candles.length;
  const bw = series.bollinger.bandwidth;
  const hoy = bw[n - 1];
  if (hoy == null) return [];

  const previos = bw.slice(Math.max(0, n - ventana), n - 1).filter(v => v != null);
  if (previos.length < 30) return [];

  const percentil = previos.filter(v => v < hoy).length / previos.length * 100;
  if (percentil > 10) return [];

  return [{
    nombre: 'Compresión de volatilidad (squeeze)',
    direccion: 'indefinida',
    haceDias: 0,
    confiabilidad: 'media',
    detalle: `El ancho de Bollinger está en el percentil ${percentil.toFixed(0)} de los últimos ${previos.length} días. `
      + `Anticipa un movimiento fuerte pero NO su dirección.`,
  }];
}

/* ────────────────────── orquestador ────────────────────── */

const EVALUADOS = [
  'Golden/Death cross (SMA50/SMA200)',
  'Cruce SMA20/SMA50',
  'Cruce de MACD',
  'Divergencia de RSI (alcista y bajista)',
  'Ruptura de máximo/mínimo de 20 ruedas',
  'Doble techo / doble piso',
  'Hueco de apertura',
  'Compresión de volatilidad',
];

/**
 * Corre todos los detectores. Devuelve lo encontrado y, explícitamente, todo
 * lo que se buscó — para que el informe pueda afirmar la ausencia y no
 * confundirla con "no miramos".
 */
function detectAll(candles, series) {
  const continuo = esMercadoContinuo(candles);

  const detectados = [
    ...crucesDeMedias(candles, series),
    ...divergenciasRSI(candles, series),
    ...rupturas(candles, series),
    ...doblesExtremos(candles),
    ...huecos(candles, series, { continuo }),
    ...compresion(candles, series),
  ];

  const orden = { media: 0, baja: 1 };
  detectados.sort((a, b) =>
    (orden[a.confiabilidad] ?? 2) - (orden[b.confiabilidad] ?? 2) || a.haceDias - b.haceDias
  );

  const cuenta = (d) => detectados.filter(p => p.direccion === d).length;

  return {
    detectados,
    evaluados: EVALUADOS,
    resumen: {
      mercado: continuo ? 'continuo 24/7' : 'con horario de sesión',
      total: detectados.length,
      alcistas: cuenta('alcista'),
      bajistas: cuenta('bajista'),
      // Que el detector encuentre señales opuestas NO es un error: es
      // exactamente lo que alimenta `señales_contradictorias` del informe.
      contradictorio: cuenta('alcista') > 0 && cuenta('bajista') > 0,
    },
  };
}

module.exports = {
  detectAll, ultimoCruce, crucesDeMedias, divergenciasRSI,
  rupturas, doblesExtremos, huecos, compresion, EVALUADOS,
};
