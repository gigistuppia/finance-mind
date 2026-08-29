const { metaEsValida } = require('../lib/yahoo.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`);
  if (!ok) fail++;
};

console.log('=== Símbolos fantasma de Yahoo ===');
console.log('  Yahoo devuelve HTTP 200 con basura en vez de 404. Estos son objetos');
console.log('  meta REALES capturados el 29/08/2026.\n');

// SM.PS (SM Investments, Filipinas) — no tiene cobertura en Yahoo
eq(metaEsValida({
  symbol: 'SM.PS',
  fullExchangeName: 'YHD',
  currency: null,
  regularMarketTime: 1561759658, // 2019-06-28
}).ok, false, 'SM.PS rechazado (exchange YHD)');

// PBBANK.KL (Public Bank, Malasia) — el caso peligroso: TRAE un precio
eq(metaEsValida({
  symbol: 'PBBANK.KL',
  fullExchangeName: 'YHD',
  currency: null,
  regularMarketPrice: 10653584400, // diez mil millones: basura con forma de número
}).ok, false, 'PBBANK.KL rechazado pese a traer precio');

eq(metaEsValida({ fullExchangeName: 'NasdaqGS', currency: null, regularMarketPrice: 100 }).ok,
   false, 'sin moneda → rechazado');
eq(metaEsValida({ fullExchangeName: 'NasdaqGS', currency: 'USD' }).ok,
   false, 'sin precio → rechazado');
eq(metaEsValida(null).ok, false, 'meta ausente → rechazado');
eq(metaEsValida(undefined).ok, false, 'meta undefined → rechazado');

console.log('\n=== Símbolos legítimos ===');
eq(metaEsValida({ fullExchangeName: 'NasdaqGS', currency: 'USD', regularMarketPrice: 319.7 }).ok,
   true, 'AAPL aceptado');
eq(metaEsValida({ fullExchangeName: 'Buenos Aires', currency: 'ARS', regularMarketPrice: 6810 }).ok,
   true, 'GGAL.BA aceptado (moneda no USD)');
eq(metaEsValida({ fullExchangeName: 'CCC', currency: 'USD', regularMarketPrice: 78260 }).ok,
   true, 'BTC-USD aceptado (exchange CCC es legítimo)');
// LSE cotiza en peniques: GBp con p minúscula es válido, no un error de tipeo.
eq(metaEsValida({ fullExchangeName: 'LSE', currency: 'GBp', regularMarketPrice: 3344.5 }).ok,
   true, 'SHEL.L aceptado (GBp = peniques)');

console.log('\n=== Un precio de cero es un precio ===');
// 0 es raro pero no es "sin dato": lo que se rechaza es null/undefined.
eq(metaEsValida({ fullExchangeName: 'NYSE', currency: 'USD', regularMarketPrice: 0 }).ok,
   true, 'precio 0 no se confunde con ausencia de precio');

console.log('\n=== El motivo del rechazo es accionable ===');
eq(metaEsValida({ fullExchangeName: 'YHD', currency: null }).motivo.includes('YHD'),
   true, 'el motivo nombra el exchange fantasma');

console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
process.exit(fail ? 1 : 0);
