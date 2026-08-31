const { calcularPrioridad } = require('../lib/pipeline.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`);
  if (!ok) fail++;
};

/** Snapshot base: un día completamente normal. */
const base = (extra = {}) => ({
  variacionDiaPct: 0.3, atrPct: 2.0, volumenRelativo: 1.0, rsi14: 50,
  soporte: 90, distanciaSoportePct: -10, soporteToques: 3,
  resistencia: 110, distanciaResistenciaPct: 10, resistenciaToques: 2,
  ...extra,
});
const sinPatrones = { detectados: [], evaluados: new Array(8), resumen: { contradictorio: false } };
const p = (snap, pat = sinPatrones, noticias = []) => calcularPrioridad(snap, pat, noticias);

console.log('=== Un día normal no molesta al usuario (§14.11) ===');
{
  const r = p(base());
  eq(r.requiereAtencion, false, 'sin movimiento ni noticias → no requiere atención');
  eq(r.nivel, 'baja', 'nivel bajo');
  eq(r.motivos.length, 0, 'y sin motivos que mostrar');
}

console.log('=== El movimiento se mide contra el ATR, no en absoluto ===');
{
  // 3% en un activo cuyo rango diario habitual es 5%: es un día normal.
  const tranquilo = p(base({ variacionDiaPct: -3, atrPct: 5 }));
  eq(tranquilo.motivos.length, 0, '3% con ATR de 5% no es noticia');

  // El MISMO 3% en un activo cuyo rango habitual es 1%: eso sí es un evento.
  const nervioso = p(base({ variacionDiaPct: -3, atrPct: 1 }));
  eq(nervioso.requiereAtencion, true, 'el mismo 3% con ATR de 1% sí lo es');
  eq(nervioso.motivos.some(m => m.includes('1,5 veces')), true, 'y explica por qué');
}
{
  // Justo por encima del ATR pero sin llegar a 1,5x: cuenta menos.
  const leve = p(base({ variacionDiaPct: 2.5, atrPct: 2 }));
  eq(leve.motivos.some(m => m.includes('por encima de su rango')), true, 'movimiento leve se marca');
  eq(leve.puntos, 2, 'pero suma menos que uno fuerte');
}

console.log('=== Señales que suman ===');
eq(p(base({ volumenRelativo: 2.4 })).motivos.some(m => m.includes('2.4x')), true, 'volumen anómalo');
eq(p(base({ rsi14: 74 })).motivos.some(m => m.includes('sobrecompra')), true, 'RSI en sobrecompra');
eq(p(base({ rsi14: 22 })).motivos.some(m => m.includes('sobreventa')), true, 'RSI en sobreventa');
eq(p(base({ rsi14: 55 })).motivos.length, 0, 'RSI neutral no suma');

console.log('=== Noticias ===');
eq(p(base(), sinPatrones, [1, 2, 3]).motivos.some(m => m.includes('3 noticias')), true, '3+ noticias pesan');
eq(p(base(), sinPatrones, [1]).motivos.some(m => m.includes('1 noticia')), true, 'una sola también, en singular');
eq(p(base(), sinPatrones, [1, 2, 3]).puntos, 2, '3 noticias suman más que 1');
eq(p(base(), sinPatrones, [1]).puntos, 1, 'una noticia suma 1');

console.log('=== Patrones: solo los de confiabilidad media pesan ===');
{
  const soloBajos = { detectados: [{ nombre: 'Cruce MACD', confiabilidad: 'baja', direccion: 'alcista' }],
                      evaluados: new Array(8), resumen: { contradictorio: false } };
  eq(p(base(), soloBajos).puntos, 0, 'un patrón de confiabilidad baja no mueve la aguja');

  const conMedio = { detectados: [{ nombre: 'Squeeze', confiabilidad: 'media', direccion: 'indefinida' }],
                     evaluados: new Array(8), resumen: { contradictorio: false } };
  eq(conMedio.detectados.length, 1, 'sanity');
  eq(p(base(), conMedio).motivos.some(m => m.includes('Squeeze')), true, 'uno de confiabilidad media sí');
}

console.log('=== Las contradicciones se señalan (§12.4) ===');
{
  const contra = { detectados: [], evaluados: new Array(8), resumen: { contradictorio: true } };
  eq(p(base(), contra).motivos.some(m => m.includes('contradictorias')), true,
     'señales opuestas son un motivo de atención, no un error');
}

console.log('=== Cercanía a un nivel con varios toques ===');
{
  const cerca = p(base({ distanciaResistenciaPct: 1.2, resistenciaToques: 3 }));
  eq(cerca.motivos.some(m => m.includes('resistencia')), true, 'a 1,2% de una resistencia de 3 toques');

  const debil = p(base({ distanciaResistenciaPct: 1.2, resistenciaToques: 1 }));
  eq(debil.motivos.some(m => m.includes('resistencia')), false, 'un nivel de 1 solo toque no cuenta');
}

console.log('=== Umbrales de nivel ===');
eq(p(base({ variacionDiaPct: 5, atrPct: 1, volumenRelativo: 3 })).nivel, 'alta', 'movimiento + volumen → alta');
eq(p(base(), sinPatrones, [1]).nivel, 'baja', 'una noticia sola → baja');

// DECISIÓN DE PRODUCTO: tener noticias, por sí solo, NO reclama atención.
// Un mega-cap tiene cobertura todos los días; si eso disparara la alerta, el
// feed gritaría siempre y §14.11 quedaría en nada. Lo que amerita atención es
// la CONJUNCIÓN: noticias + un movimiento fuera de lo normal.
eq(p(base(), sinPatrones, [1, 2, 3]).nivel, 'baja',
   'tres noticias sin movimiento NO reclaman atención por sí solas');
eq(p(base({ variacionDiaPct: -3, atrPct: 1 }), sinPatrones, [1, 2, 3]).nivel, 'alta',
   'pero noticias + movimiento anómalo sí');
eq(p(base({ variacionDiaPct: 2.5, atrPct: 2 }), sinPatrones, [1]).requiereAtencion, true,
   'movimiento leve + una noticia ya alcanza el umbral');

console.log('=== Tolera datos faltantes ===');
{
  const r = p({ variacionDiaPct: null, atrPct: null, volumenRelativo: null, rsi14: null,
                soporte: null, resistencia: null, distanciaSoportePct: null,
                distanciaResistenciaPct: null, soporteToques: null, resistenciaToques: null });
  eq(r.puntos, 0, 'todo null no rompe');
  eq(r.nivel, 'baja', 'y cae en prioridad baja');
}

console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
process.exit(fail ? 1 : 0);
