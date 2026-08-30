const A = require('../lib/analyst.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`);
  if (!ok) fail++;
};

/** Informe válido mínimo, para mutarlo en cada caso. */
const base = () => ({
  que_paso: 'NVDA cayó 4,57% con volumen por encima de lo habitual.',
  por_que: [{ causa: 'Toma de ganancias tras el balance', peso: 'medio', fuentes: [0] }],
  lectura_tecnica: 'RSI neutral, precio bajo la SMA20.',
  horizonte: {
    corto_plazo: { sesgo: 'bajista', confianza: 'media', razon: 'Perdió la media de 20 ruedas.' },
    largo_plazo: { sesgo: 'alcista', confianza: 'media', razon: 'Sigue sobre la SMA200.' },
  },
  senales_contradictorias: ['El técnico es bajista pero las noticias son positivas'],
  que_invalidaria_esto: ['Cierre sobre 227,92 con volumen'],
  confianza_global: 'media',
  datos_faltantes: [],
  dia_sin_novedades: false,
});

const v = (obj, n = 3) => A.validarInforme(obj, { cantidadNoticias: n });

console.log('=== El informe válido pasa ===');
eq(v(base()).ok, true, 'informe bien formado');

console.log('\n=== Sin fuente no hay causa (regla dura) ===');
{
  const o = base(); o.por_que[0].fuentes = [];
  eq(v(o).ok, false, 'causa sin ninguna fuente → rechazada');
  eq(v(o).errores.some(e => e.includes('no cita')), true, 'el error lo explica');
}

console.log('\n=== No se puede citar una fuente que no existe ===');
{
  const o = base(); o.por_que[0].fuentes = [7];
  eq(v(o, 3).ok, false, 'índice fuera de rango → rechazado');
  eq(v(o, 3).errores.some(e => e.includes('[7]')), true, 'el error nombra el índice inventado');
}
{
  const o = base(); o.por_que[0].fuentes = [-1];
  eq(v(o, 3).ok, false, 'índice negativo → rechazado');
}

console.log('\n=== Sin noticias no puede haber causas (§14.4) ===');
{
  const o = base();
  eq(v(o, 0).ok, false, 'inventó una causa con 0 noticias disponibles');
  eq(v(o, 0).errores.some(e => e.includes('inventó')), true, 'el error lo dice');
}
{
  const o = base(); o.por_que = []; o.dia_sin_novedades = true;
  eq(v(o, 0).ok, true, 'con 0 noticias y 0 causas, el informe es válido');
}

console.log('\n=== Lenguaje de recomendación prohibido (§14.14) ===');
for (const frase of ['Es momento de comprá el papel', 'Recomendamos mantener la posición',
                     'Buena oportunidad de compra']) {
  const o = base(); o.que_paso = frase;
  eq(v(o).ok, false, `rechaza: "${frase.slice(0, 32)}…"`);
}
{
  const o = base(); o.que_paso = 'El RSI está en zona de sobreventa y el volumen fue alto.';
  eq(v(o).ok, true, 'acepta lenguaje descriptivo');
}

console.log('\n=== Toda tesis tiene que ser falsable ===');
{
  const o = base(); o.que_invalidaria_esto = [];
  eq(v(o).ok, false, 'sin "qué lo invalidaría" → rechazado');
}

console.log('\n=== Los enums se respetan ===');
{
  const o = base(); o.horizonte.corto_plazo.sesgo = 'muy alcista';
  eq(v(o).ok, false, 'sesgo fuera del enum → rechazado');
}
{
  const o = base(); o.horizonte.largo_plazo.confianza = 'altísima';
  eq(v(o).ok, false, 'confianza fuera del enum → rechazada');
}
{
  const o = base(); delete o.horizonte.largo_plazo;
  eq(v(o).ok, false, 'falta un horizonte → rechazado');
}

console.log('\n=== Los índices se resuelven a noticias reales ===');
{
  const noticias = [
    { titulo: 'T0', medio: 'CNBC', url: 'https://a', fecha: '2026-08-29', horasAtras: 3 },
    { titulo: 'T1', medio: 'WSJ', url: 'https://b', fecha: '2026-08-29', horasAtras: 9 },
  ];
  const o = base(); o.por_que[0].fuentes = [1, 0];
  const r = A.resolverFuentes(o, noticias);
  eq(r.por_que[0].fuentes.length, 2, 'resuelve las dos fuentes');
  eq(r.por_que[0].fuentes[0].url, 'https://b', 'respeta el orden citado');
  eq(r.por_que[0].fuentes[1].medio, 'CNBC', 'trae el medio real');
  // El modelo nunca escribe URLs: si el índice no existe, no hay fuente.
  const o2 = base(); o2.por_que[0].fuentes = [0, 99];
  eq(A.resolverFuentes(o2, noticias).por_que[0].fuentes.length, 1, 'descarta índices inexistentes');
}

console.log('\n=== El prompt numera las noticias ===');
{
  const paquete = {
    symbol: 'NVDA', nombre: 'NVIDIA Corporation',
    snapshot: {
      precio: 217.55, variacionDiaPct: -4.57, variacion5dPct: 1.32, variacion20dPct: 8.37,
      rsi14: 52.34, macd: 2.34, macdSignal: 2.83, macdHistograma: -0.48,
      sma20: 218.05, sma50: 208.42, sma200: 195.83, atr14: 7.66, atrPct: 3.52,
      bollingerPercentB: 47.9, bollingerAncho: 10.8, volumenRelativo: 1.52,
      drawdownDesdeMaximoPct: -7.72, soporte: 198.31, soporteToques: 3,
      distanciaSoportePct: -8.84, resistencia: 227.92, resistenciaToques: 1,
      distanciaResistenciaPct: 4.77, velasUsadas: 251, desde: '2025-08-29',
      hasta: '2026-08-28', mercado: 'con horario de sesión',
      lecturas: { rsi: 'neutral', posicionVsMedias: 'bajo SMA20', volumen: 'alto' },
    },
    patrones: { detectados: [], evaluados: ['a', 'b'], resumen: { contradictorio: false } },
    noticias: [{ titulo: 'Primera', medio: 'CNBC', horasAtras: 3 },
               { titulo: 'Segunda', medio: 'WSJ', horasAtras: 9 }],
    diagnosticoNoticias: { ventanaHoras: 72, fuentesConsultadas: ['google-news'], totalCrudas: 20 },
  };
  const p = A.construirPrompt(paquete);
  eq(p.includes('[0] Primera'), true, 'numera la primera noticia');
  eq(p.includes('[1] Segunda'), true, 'numera la segunda');
  eq(p.includes('NINGUNO detectado'), true, 'dice que se evaluaron y no hay patrones');
  eq(p.includes('3.52%'), true, 'incluye el ATR como referencia de normalidad');
  // El modelo no debe ver URLs: no puede copiar lo que no recibe.
  eq(p.includes('http'), false, 'el prompt NO contiene ninguna URL');

  paquete.noticias = [];
  const p2 = A.construirPrompt(paquete);
  eq(p2.includes('"por_que" va VACÍO'), true, 'sin noticias, prohíbe explícitamente inventar causas');
}

console.log('\n=== Informe degradado: publicable y honesto ===');
{
  const paquete = {
    symbol: 'NVDA',
    snapshot: {
      precio: 217.55, variacionDiaPct: -4.57, rsi14: 52.34, volumenRelativo: 1.52,
      lecturas: { rsi: 'neutral', posicionVsMedias: 'bajo SMA20' },
    },
    patrones: { detectados: [], evaluados: ['a', 'b', 'c'] },
    noticias: [{ titulo: 'x' }],
  };
  const d = A.informeDegradado(paquete, 'Gemini HTTP 429');
  eq(d.degradado, true, 'queda marcado como degradado');
  eq(d.motivoDegradacion, 'Gemini HTTP 429', 'conserva el motivo');
  eq(d.por_que.length, 0, 'no inventa causas');
  eq(d.confianza_global, 'baja', 'confianza baja');
  eq(d.que_paso.includes('217.55'), true, 'igual muestra los datos reales');
  eq(d.datos_faltantes.length > 0, true, 'avisa que falta el análisis');
  eq(d.noticiasSinAnalizar.length, 1, 'conserva las noticias sin analizar');
}

console.log('\n=== redactar() nunca lanza ===');
(async () => {
  const paquete = {
    symbol: 'NVDA',
    snapshot: { precio: 1, variacionDiaPct: 0, rsi14: 50, volumenRelativo: 1,
                lecturas: { rsi: 'neutral', posicionVsMedias: 'sobre SMA20' } },
    patrones: { detectados: [], evaluados: ['a'] },
    noticias: [],
    diagnosticoNoticias: { ventanaHoras: 72, fuentesConsultadas: [], totalCrudas: 0 },
  };

  const sinKey = await A.redactar(paquete, { apiKey: null, proveedor: 'gemini' });
  eq(sinKey.degradado, true, 'sin API key → informe degradado, no excepción');
  eq(sinKey.motivoDegradacion.includes('GEMINI_API_KEY'), true, 'dice qué variable falta');

  const raro = await A.redactar(paquete, { proveedor: 'proveedor-inexistente' });
  eq(raro.degradado, true, 'proveedor desconocido → degradado');
  eq(raro.motivoDegradacion.includes('Proveedor desconocido'), true, 'no revienta leyendo su config');

  console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
  process.exit(fail ? 1 : 0);
})();
