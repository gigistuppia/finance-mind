const { computeAll, esMercadoContinuo } = require('../lib/indicators.js');
const { detectAll, ultimoCruce, EVALUADOS } = require('../lib/patterns.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${a} (esperado ${b})`);
  if (!ok) fail++;
};

/** Serie sintética: sube `subeHasta` ruedas y después se derrumba. */
function serie(n, subeHasta, pendienteBaja = 2.2) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const p = k < subeHasta ? 100 + k * 0.5 : (100 + subeHasta * 0.5) - (k - subeHasta) * pendienteBaja;
    out.push({ o: p, h: p * 1.01, l: p * 0.99, c: p, v: 1e6, t: k * 86_400_000 });
  }
  return out;
}

console.log('=== ultimoCruce ===');
eq(ultimoCruce([1, 2, 3, 5, 6], [4, 4, 4, 4, 4]).i, 3, 'índice del cruce');
eq(ultimoCruce([1, 2, 3, 5, 6], [4, 4, 4, 4, 4]).direccion, 'alcista', 'dirección alcista');
eq(ultimoCruce([4, 4, 4, 4, 4], [1, 2, 3, 5, 6]).direccion, 'bajista', 'dirección bajista');
eq(ultimoCruce([1, 1, 1], [2, 2, 2]), null, 'sin cruce → null');
eq(ultimoCruce([null, null, 1], [null, null, 2]), null, 'nulls no rompen');

console.log('\n=== Death cross sobre serie forzada ===');
{
  const s = serie(320, 220);
  const { series } = computeAll(s);
  const p = detectAll(s, series);
  eq(p.detectados.some(d => d.nombre.includes('Death cross')), true, 'detecta el death cross');
  eq(EVALUADOS.length, 8, 'declara 8 patrones evaluados');
  eq(p.evaluados.length, 8, 'los reporta en la salida');
  // §14.5: los patrones nunca se presentan como certeza.
  eq(p.detectados.every(d => ['baja', 'media'].includes(d.confiabilidad)), true,
     'ningún patrón se declara de confiabilidad alta');
}

console.log('\n=== Serie plana: no inventa patrones ===');
{
  const plana = Array.from({ length: 300 }, (_, k) =>
    ({ o: 100, h: 100.5, l: 99.5, c: 100, v: 1e6, t: k * 86_400_000 }));
  const { series } = computeAll(plana);
  const p = detectAll(plana, series);
  eq(p.detectados.filter(d => d.direccion !== 'indefinida').length, 0,
     'sin señales direccionales en una serie sin movimiento');
}

console.log('\n=== Régimen de mercado (§14.10) ===');
{
  const diario = Array.from({ length: 365 }, (_, k) => ({ t: k * 86_400_000, o: 1, h: 1, l: 1, c: 1, v: 1 }));
  eq(esMercadoContinuo(diario), true, '365 velas en 365 días → continuo');

  // 5 de cada 7 días, como una bolsa con fines de semana cerrados
  const habil = [];
  for (let k = 0; k < 365; k++) if (k % 7 < 5) habil.push({ t: k * 86_400_000, o: 1, h: 1, l: 1, c: 1, v: 1 });
  eq(esMercadoContinuo(habil), false, '~252 velas en 365 días → con horario');
}

console.log('\n=== El resumen marca las contradicciones ===');
{
  const s = serie(320, 220);
  const { series } = computeAll(s);
  const p = detectAll(s, series);
  eq(typeof p.resumen.contradictorio, 'boolean', 'expone flag de contradicción');
  eq(p.resumen.contradictorio, p.resumen.alcistas > 0 && p.resumen.bajistas > 0,
     'la contradicción es coherente con los conteos');
}

console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
process.exit(fail ? 1 : 0);
