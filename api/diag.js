/**
 * Diagnóstico de la FASE 00 (CLAUDE.md §14.1 / §15).
 *
 * Única pregunta que responde: ¿Yahoo Finance le contesta a las IPs de Vercel,
 * y funciona el flujo cookie+crumb fuera de Netlify?
 *
 * Prueba los tres caminos por separado para que un fallo sea diagnosticable y
 * no un "no anda" genérico.
 */

const { fetchQuotesV7, fetchChart, getCandles } = require('../lib/yahoo.js');

async function timed(fn) {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - t0, value };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e.message };
  }
}

module.exports = async function handler(req, res) {
  const symbol = String(req.query?.symbol || 'AAPL');

  const [v7, chart, candles] = await Promise.all([
    timed(async () => {
      const r = await fetchQuotesV7([symbol]);
      if (!r) throw new Error('cookie+crumb falló o Yahoo rechazó v7');
      return { price: r[0].regularMarketPrice, marketState: r[0].marketState, marketCap: r[0].marketCap };
    }),
    timed(async () => {
      const r = await fetchChart(symbol);
      if (!r) throw new Error('chart no devolvió precio');
      return { price: r.regularMarketPrice };
    }),
    timed(async () => {
      const r = await getCandles(symbol, { range: '1y', interval: '1d' });
      if (r.candles.length < 200) throw new Error(`solo ${r.candles.length} velas, se esperaban ~250`);
      return { velas: r.candles.length, primera: new Date(r.candles[0].t).toISOString().slice(0, 10), ultima: new Date(r.candles.at(-1).t).toISOString().slice(0, 10) };
    }),
  ]);

  // El bot solo necesita velas. La app quiere v7 pero sobrevive con chart.
  const veredicto = candles.ok
    ? (v7.ok ? 'OK_COMPLETO' : 'OK_PARA_EL_BOT')
    : 'BLOQUEADO';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(candles.ok ? 200 : 502).json({
    veredicto,
    symbol,
    region: process.env.VERCEL_REGION || null,
    entorno: process.env.VERCEL_ENV || 'local',
    caminos: {
      v7_quote_con_crumb: v7,   // lo que hoy funciona en Netlify
      v8_chart_precio: chart,   // fallback sin auth
      v8_chart_velas_1y: candles, // ← lo que necesita el bot
    },
  });
};
