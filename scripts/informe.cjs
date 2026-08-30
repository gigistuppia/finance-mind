#!/usr/bin/env node
/**
 * Prototipo de la FASE 0: informe completo de un activo, por consola.
 *
 *   npm run informe -- NVDA
 *   npm run informe -- GGAL.BA --solo-datos     ← no necesita ninguna API key
 *   npm run informe -- BTC-USD --json
 *
 * Sin GEMINI_API_KEY sale el informe degradado, que igual muestra todos los
 * datos deterministas. Con la key sale el informe completo.
 */

const { analizarSimbolo } = require('../lib/pipeline.js');

const args = process.argv.slice(2);
const symbol = args.find(a => !a.startsWith('--'));
const soloDatos = args.includes('--solo-datos');
const comoJson = args.includes('--json');

if (!symbol) {
  console.error('Uso: npm run informe -- SIMBOLO [--solo-datos] [--json]');
  console.error('Ejemplos: NVDA · GGAL.BA · BTC-USD · ^MERV · GC=F');
  process.exit(1);
}

const C = {
  gris: s => `\x1b[90m${s}\x1b[0m`,
  verde: s => `\x1b[32m${s}\x1b[0m`,
  rojo: s => `\x1b[31m${s}\x1b[0m`,
  amarillo: s => `\x1b[33m${s}\x1b[0m`,
  negrita: s => `\x1b[1m${s}\x1b[0m`,
};

const signo = v => (v == null ? C.gris('n/d') : (v >= 0 ? C.verde(`+${v}%`) : C.rojo(`${v}%`)));
const sesgo = s => s === 'alcista' ? C.verde(s) : s === 'bajista' ? C.rojo(s) : C.amarillo(s);
const linea = (t = '') => console.log(t ? C.gris(`── ${t} ${'─'.repeat(Math.max(0, 66 - t.length))}`) : '');

(async () => {
  console.log(C.gris(`\nAnalizando ${symbol}…`));
  const r = await analizarSimbolo(symbol, { soloDatos });

  if (comoJson) { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }

  if (!r.ok) {
    console.error(C.rojo(`\n✗ Falló en la etapa "${r.etapa}": ${r.error}\n`));
    process.exit(1);
  }

  const s = r.snapshot;

  console.log(`\n${C.negrita(r.symbol)}${r.nombre ? C.gris(` · ${r.nombre}`) : ''}  ${C.gris(r.fecha)}`);
  console.log(`${C.negrita(String(s.precio))} ${r.moneda}   día ${signo(s.variacionDiaPct)}   5d ${signo(s.variacion5dPct)}   20d ${signo(s.variacion20dPct)}`);
  console.log(C.gris(`${s.mercado} · ${s.velasUsadas} velas · ${s.desde} → ${s.hasta}`));

  linea('TÉCNICO');
  console.log(`  RSI(14)   ${s.rsi14}  ${C.gris(`(${s.lecturas.rsi})`)}`);
  console.log(`  MACD      ${s.macd}  señal ${s.macdSignal}  hist ${s.macdHistograma}`);
  console.log(`  Medias    20:${s.sma20}  50:${s.sma50}  200:${s.sma200}`);
  console.log(`            ${C.gris(s.lecturas.posicionVsMedias)}`);
  console.log(`  ATR(14)   ${s.atr14} ${C.gris(`(${s.atrPct}% del precio — un día normal se mueve menos que esto)`)}`);
  console.log(`  Volumen   ${s.volumenRelativo}x  ${C.gris(`(${s.lecturas.volumen})`)}`);
  console.log(`  Drawdown  ${s.drawdownDesdeMaximoPct}% ${C.gris('desde el máximo')}`);
  console.log(`  Soporte   ${s.soporte ?? C.gris('ninguno significativo')}${s.soporte ? C.gris(`  (${s.distanciaSoportePct}%, ${s.soporteToques} toques)`) : ''}`);
  console.log(`  Resist.   ${s.resistencia ?? C.gris('ninguna significativa')}${s.resistencia ? C.gris(`  (${s.distanciaResistenciaPct}%, ${s.resistenciaToques} toques)`) : ''}`);

  linea(`PATRONES (${r.patrones.detectados.length} de ${r.patrones.evaluados.length} evaluados)`);
  if (!r.patrones.detectados.length) {
    console.log(C.gris('  Ninguno. Se evaluaron los 8 y no apareció ninguno — eso es información.'));
  } else {
    for (const p of r.patrones.detectados) {
      console.log(`  • ${p.nombre} ${C.gris(`[${p.confiabilidad}]`)} — ${sesgo(p.direccion)}, hace ${p.haceDias}d`);
      console.log(C.gris(`    ${p.detalle}`));
    }
    if (r.patrones.resumen.contradictorio) {
      console.log(C.amarillo(`  ⚠ ${r.patrones.resumen.alcistas} alcistas vs ${r.patrones.resumen.bajistas} bajistas`));
    }
  }

  const d = r.diagnosticoNoticias;
  linea(`NOTICIAS (${r.noticias.length} en ${d.ventanaHoras}h)`);
  console.log(C.gris(`  fuentes: ${d.fuentesConsultadas.join(', ') || 'ninguna'} · ${d.totalCrudas} crudas · descartadas: ${d.descartadas.fueraDeVentana} viejas, ${d.descartadas.pocoRelevantes} irrelevantes, ${d.descartadas.duplicadas} duplicadas`));
  if (d.errores?.length) console.log(C.rojo(`  errores: ${d.errores.map(e => `${e.fuente}: ${e.error}`).join(' | ')}`));
  r.noticias.forEach((n, i) => {
    console.log(`  [${i}] ${n.titulo}`);
    console.log(C.gris(`      ${n.medio} · hace ${n.horasAtras}h · relevancia ${n.relevancia}`));
  });

  if (soloDatos) {
    console.log(C.gris(`\n(--solo-datos: no se llamó al modelo)  ${r.tiempos.total}ms\n`));
    return;
  }

  const inf = r.informe;
  linea('INFORME');
  if (inf.degradado) {
    console.log(C.amarillo(`  ⚠ INFORME DEGRADADO: ${inf.motivoDegradacion}`));
    console.log(C.gris('  Los datos de arriba son correctos. Falta la interpretación.\n'));
  }

  console.log(`\n  ${C.negrita('Qué pasó')}`);
  console.log(`  ${inf.que_paso}`);
  if (inf.dia_sin_novedades) console.log(C.gris('  (el modelo marcó el día como sin novedades)'));

  if (inf.por_que?.length) {
    console.log(`\n  ${C.negrita('Por qué')}`);
    for (const c of inf.por_que) {
      console.log(`  • ${c.causa} ${C.gris(`[peso ${c.peso}]`)}`);
      for (const f of c.fuentes) console.log(C.gris(`      ↳ ${f.medio}: ${f.titulo}\n        ${f.url}`));
    }
  } else if (!inf.degradado) {
    console.log(`\n  ${C.negrita('Por qué')}`);
    console.log(C.gris('  Sin causas citables: no hubo noticias que respaldaran una explicación.'));
  }

  console.log(`\n  ${C.negrita('Lectura técnica')}`);
  console.log(`  ${inf.lectura_tecnica}`);

  console.log(`\n  ${C.negrita('Horizonte')}`);
  for (const [k, etiqueta] of [['corto_plazo', 'Corto  (1-4 semanas)'], ['largo_plazo', 'Largo  (6-12 meses)']]) {
    const h = inf.horizonte[k];
    console.log(`  ${etiqueta}  ${sesgo(h.sesgo)} ${C.gris(`· confianza ${h.confianza}`)}`);
    console.log(C.gris(`         ${h.razon}`));
  }

  if (inf.senales_contradictorias?.length) {
    console.log(`\n  ${C.amarillo(C.negrita('Señales contradictorias'))}`);
    for (const x of inf.senales_contradictorias) console.log(`  • ${x}`);
  }

  if (inf.que_invalidaria_esto?.length) {
    console.log(`\n  ${C.negrita('Qué invalidaría esta lectura')}`);
    for (const x of inf.que_invalidaria_esto) console.log(`  • ${x}`);
  }

  if (inf.datos_faltantes?.length) {
    console.log(`\n  ${C.gris('Datos faltantes')}`);
    for (const x of inf.datos_faltantes) console.log(C.gris(`  • ${x}`));
  }

  console.log(`\n  Confianza global: ${inf.confianza_global}`);
  console.log(C.gris(`\n  ⚠ Esto es información, no asesoramiento financiero.`));
  console.log(C.gris(`  ${JSON.stringify(r.tiempos)}\n`));
})();
