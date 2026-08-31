/**
 * Informe de UN activo, generado en el momento.
 *
 * Es el endpoint que hace posible ver el producto ANTES de tener base de datos:
 * corre el pipeline completo en vivo en vez de leer un informe precalculado.
 * Cuando exista Neon (fase 1), el cron va a escribir estos mismos informes y la
 * app va a leerlos de `/api/report` — pero el formato de salida es idéntico, así
 * que la UI no cambia.
 *
 * Sin GEMINI_API_KEY devuelve el informe degradado: datos deterministas
 * completos y sin interpretación. Es real, no un mock.
 */

const { analizarSimbolo } = require('../lib/pipeline.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const symbol = String(req.query?.symbol || '').trim();
  const nombre = req.query?.nombre ? String(req.query.nombre) : undefined;
  // `solo-datos` corta antes del LLM: sirve para previsualizar rápido y para
  // no gastar cuota de Gemini mientras se prueba la interfaz.
  const soloDatos = req.query?.['solo-datos'] === '1' || req.query?.soloDatos === '1';

  if (!symbol) {
    res.status(400).json({ error: 'Falta el parámetro symbol' });
    return;
  }

  try {
    const r = await analizarSimbolo(symbol, { nombre, soloDatos });
    if (!r.ok) {
      // Un símbolo que no resuelve no es un error del servidor: es información
      // para el usuario, y la UI la muestra en la tarjeta del activo.
      res.status(200).json(r);
      return;
    }
    // El informe cambia una vez por día: cachear evita repetir el pipeline
    // entero cada vez que alguien recarga la vista.
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
    res.status(200).json(r);
  } catch (e) {
    res.status(502).json({ symbol, ok: false, etapa: 'inesperada', error: e.message });
  }
};
