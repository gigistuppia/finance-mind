/**
 * Mapea una lista de símbolos de TradingView a símbolos de Yahoo, y opcionalmente
 * los valida contra Yahoo antes de devolverlos.
 *
 * Existe como endpoint —y no como módulo del navegador— porque `lib/symbols.js`
 * es la ÚNICA fuente de verdad de las reglas de mapeo. Duplicarlas en un módulo
 * ES para el browser garantizaría que las dos copias se desincronicen, y una
 * regla desactualizada acá significa que el usuario ve el precio de otro activo.
 *
 * La validación (§14.6) es lo que convierte "GGAL.BA probablemente exista" en
 * "GGAL.BA existe y cotiza en ARS". Nunca falla en silencio.
 */

const { mapearLista } = require('../lib/symbols.js');
const { getCandles } = require('../lib/yahoo.js');

const MAX_SIMBOLOS = 300;       // TradingView topea las watchlists en 1000
const MAX_VALIDACIONES = 60;    // techo de subrequests por invocación
const CONCURRENCIA = 6;         // no castigar a Yahoo con 60 pedidos de golpe

/** Valida un símbolo pidiendo 5 días de velas. Devuelve el resultado enriquecido. */
async function validar(item) {
  const candidatos = [item.symbol, ...(item.alternativas || [])];

  for (const symbol of candidatos) {
    try {
      const datos = await getCandles(symbol, { range: '5d', interval: '1d' });
      return {
        ...item,
        symbol,
        // Si funcionó una alternativa, el símbolo propuesto estaba mal.
        ...(symbol !== item.symbol ? { corregidoDesde: item.symbol } : {}),
        validado: true,
        moneda: datos.currency,
        ultimoCierre: datos.candles.at(-1)?.c ?? null,
        confianza: 'alta',
      };
    } catch (e) {
      // `fetch failed` a secas no dice nada. La causa real (TLS, DNS, timeout)
      // vive en e.cause y es lo único accionable cuando esto se rompe.
      const causa = e.cause?.code || e.cause?.message;
      item.errorValidacion = causa ? `${e.message} (${causa})` : e.message;
    }
  }

  return { ...item, validado: false, confianza: 'rechazado',
    motivo: item.errorValidacion || 'Yahoo no reconoce el símbolo.' };
}

/** Corre las validaciones en tandas para no saturar Yahoo. */
async function validarEnTandas(items) {
  const salida = [];
  for (let i = 0; i < items.length; i += CONCURRENCIA) {
    const tanda = items.slice(i, i + CONCURRENCIA);
    salida.push(...await Promise.all(tanda.map(validar)));
  }
  return salida;
}

async function leerCuerpo(req) {
  if (req.body) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const trozos = [];
  for await (const t of req) trozos.push(t);
  return JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Usar POST' }); return; }

  let cuerpo;
  try { cuerpo = await leerCuerpo(req); }
  catch { res.status(400).json({ error: 'El cuerpo no es JSON válido' }); return; }

  const texto = String(cuerpo.texto || '');
  if (!texto.trim()) { res.status(400).json({ error: 'Falta el campo "texto"' }); return; }

  const mapa = mapearLista(texto);

  if (mapa.total > MAX_SIMBOLOS) {
    res.status(413).json({
      error: `Son ${mapa.total} símbolos y el máximo es ${MAX_SIMBOLOS}. Dividí la lista en partes.`,
    });
    return;
  }

  // Sin validar: respuesta instantánea, para previsualizar antes de confirmar.
  if (cuerpo.validar === false) {
    res.status(200).json({ ...mapa, validado: false });
    return;
  }

  // Se validan los que tienen alguna chance. Los rechazados por regla no
  // gastan un pedido a Yahoo: ya sabemos que no existen.
  const aValidar = [...mapa.listos, ...mapa.revisar].slice(0, MAX_VALIDACIONES);
  const sinValidar = [...mapa.listos, ...mapa.revisar].slice(MAX_VALIDACIONES);

  let validados;
  try {
    validados = await validarEnTandas(aValidar);
  } catch (e) {
    res.status(502).json({ error: `Falló la validación contra Yahoo: ${e.message}` });
    return;
  }

  const listos = validados.filter(v => v.validado);
  const fallidos = validados.filter(v => !v.validado);

  res.status(200).json({
    total: mapa.total,
    validado: true,
    listos,
    // Los que no se pudieron validar se juntan con los rechazados por regla:
    // para el usuario son lo mismo, cosas que tiene que revisar a mano.
    rechazados: [...mapa.rechazados, ...fallidos],
    revisar: sinValidar.map(s => ({
      ...s,
      motivo: `Se superó el máximo de ${MAX_VALIDACIONES} validaciones por tanda. Hay que revisarlo a mano.`,
    })),
    resumen: `${listos.length} listos, ${sinValidar.length} sin validar, `
      + `${mapa.rechazados.length + fallidos.length} con problemas`,
    corregidos: listos.filter(l => l.corregidoDesde).length,
  });
};
