/**
 * Pipeline completo de un activo: datos → hechos → informe.
 *
 * Es lo que el cron va a invocar por cada símbolo (CLAUDE.md §12.3), y también
 * lo que corre `npm run informe` para probar un activo suelto.
 *
 * Diseño: cada etapa falla de forma independiente y explícita. Si Yahoo no
 * responde no hay informe posible y se dice por qué; si las noticias fallan,
 * el informe sale igual con la parte técnica. Nunca se rellena un hueco con
 * una suposición.
 */

const { getCandles, search } = require('./yahoo.js');
const { computeAll } = require('./indicators.js');
const { detectAll } = require('./patterns.js');
const { collect } = require('./news.js');
const { redactar } = require('./analyst.js');

/** Busca el nombre real del activo. Mejora mucho el filtro de relevancia. */
async function resolverNombre(symbol) {
  try {
    const data = await search(symbol, { quotesCount: 5, newsCount: 0 });
    const q = (data.quotes || []).find(x => x.symbol === symbol) || (data.quotes || [])[0];
    return q?.longname || q?.shortname || null;
  } catch {
    return null;
  }
}

/**
 * Analiza un símbolo de punta a punta.
 *
 * @param {string} symbol  Símbolo en formato Yahoo (AAPL, GGAL.BA, BTC-USD)
 * @param {object} op
 * @param {string} [op.nombre]     Nombre del activo. Si no viene, se busca.
 * @param {boolean} [op.soloDatos] Corta antes del LLM. Útil para probar sin key.
 */
async function analizarSimbolo(symbol, op = {}) {
  const t0 = Date.now();
  const tiempos = {};
  const marcar = (etapa, desde) => { tiempos[etapa] = Date.now() - desde; };

  // ── 1. Velas. Sin esto no hay nada que analizar. ──
  let t = Date.now();
  let datos;
  try {
    datos = await getCandles(symbol, { range: '1y', interval: '1d' });
  } catch (e) {
    return {
      symbol, ok: false, etapa: 'velas', error: e.message,
      fecha: new Date().toISOString().slice(0, 10),
    };
  }
  marcar('velas', t);

  // ── 2. Indicadores y patrones. Deterministas: si fallan, es un bug nuestro. ──
  t = Date.now();
  let snapshot, series, patrones;
  try {
    ({ snapshot, series } = computeAll(datos.candles));
    patrones = detectAll(datos.candles, series);
  } catch (e) {
    return {
      symbol, ok: false, etapa: 'indicadores', error: e.message,
      fecha: new Date().toISOString().slice(0, 10),
    };
  }
  marcar('indicadores', t);

  const nombre = op.nombre || await resolverNombre(symbol);

  // ── 3. Noticias. Si fallan, seguimos: el informe sale sin la parte de causas. ──
  t = Date.now();
  let noticias = [], diagnosticoNoticias;
  try {
    const r = await collect(symbol, nombre);
    noticias = r.noticias;
    diagnosticoNoticias = r.diagnostico;
  } catch (e) {
    diagnosticoNoticias = {
      fuentesConsultadas: [], totalCrudas: 0, ventanaHoras: 72,
      descartadas: { fueraDeVentana: 0, pocoRelevantes: 0, duplicadas: 0 },
      errores: [{ fuente: 'todas', error: e.message }], sinNoticias: true,
    };
  }
  marcar('noticias', t);

  const paquete = { symbol, nombre, snapshot, patrones, noticias, diagnosticoNoticias };

  if (op.soloDatos) {
    return {
      symbol, nombre, ok: true, soloDatos: true,
      fecha: new Date().toISOString().slice(0, 10),
      moneda: datos.currency, snapshot, patrones, noticias, diagnosticoNoticias,
      tiempos: { ...tiempos, total: Date.now() - t0 },
    };
  }

  // ── 4. Redacción. redactar() nunca lanza: peor caso, informe degradado. ──
  t = Date.now();
  const informe = await redactar(paquete, op.llm || {});
  marcar('redaccion', t);

  return {
    symbol, nombre, ok: true,
    fecha: new Date().toISOString().slice(0, 10),
    moneda: datos.currency,
    snapshot, patrones, noticias, diagnosticoNoticias, informe,
    tiempos: { ...tiempos, total: Date.now() - t0 },
  };
}

module.exports = { analizarSimbolo, resolverNombre };
