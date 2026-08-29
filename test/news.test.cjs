const N = require('../lib/news.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`);
  if (!ok) fail++;
};

console.log('=== Parseo de XML ===');
eq(N.tag('<title>Hola $400 mundo</title>', 'title'), 'Hola $400 mundo', 'título con signo peso');
eq(N.tag('<source url="https://x.com">CNBC</source>', 'source'), 'CNBC', 'tag con atributos');
eq(N.tag('<title><![CDATA[Con CDATA]]></title>', 'title'), 'Con CDATA', 'desenvuelve CDATA');
eq(N.tag('<pubDate>Sat, 29 Aug 2026 12:00:00 GMT</pubDate>', 'pubDate'),
   'Sat, 29 Aug 2026 12:00:00 GMT', 'fecha RFC822');
eq(N.tag('<a>x</a>', 'b'), null, 'tag ausente → null');
eq(N.decodeEntities('AT&amp;T &quot;sube&quot; 5&#37;'), 'AT&T "sube" 5%', 'entidades HTML');

console.log('\n=== Clave de deduplicación ===');
eq(N.claveTitulo('Nvidia adds $400 billion in value - CNBC'),
   N.claveTitulo('Nvidia adds $400 billion in value - Reuters'),
   'mismo titular, distinto medio → misma clave');
eq(N.claveTitulo('Nvidia sube') === N.claveTitulo('Tesla baja'), false,
   'titulares distintos → claves distintas');

console.log('\n=== Ventana temporal ===');
const h = n => Date.now() - n * 3_600_000;
eq(N.dentroDeVentana(h(1), 72), true, 'hace 1 hora entra');
eq(N.dentroDeVentana(h(71), 72), true, 'hace 71 horas entra');
eq(N.dentroDeVentana(h(73), 72), false, 'hace 73 horas queda afuera');
eq(N.dentroDeVentana(null, 72), false, 'sin fecha queda afuera');
eq(N.dentroDeVentana(Date.now() + 86_400_000, 72), false, 'fecha futura queda afuera');

console.log('\n=== Relevancia: el filtro contra §14.4 ===');
const p = (titulo, tickers) => N.puntuarRelevancia({ titulo, tickers },
  { symbol: 'NVDA', nombre: 'NVIDIA Corporation' }).score;

// Casos REALES devueltos por Yahoo para q=NVDA (todos con NVDA en relatedTickers)
eq(p('Has Novo Nordisk Finally Found the Catalyst That Could Flip the Script',
     ['NVO', 'LLY', 'NVDA', 'VANI']) >= 3, false,
   'nota sobre Novo Nordisk NO pasa el filtro');
eq(p("Billionaire Mark Cuban Is Not Impressed by Bitcoin's Recent Rally",
     ['BTC-USD', 'NVDA']) >= 3, false,
   'nota sobre Bitcoin NO pasa el filtro');
eq(p('Chevron vs. Occidental: Which Oil Major Dividend Is Better',
     ['CVX', 'OXY', '^GSPC', 'CL=F', 'NVDA', 'NG=F']) >= 3, false,
   'recopilatorio de 6 tickers NO pasa');

// Casos que SÍ deben pasar
eq(p('Nvidia adds more than $400 billion in value after blowout earnings',
     []) >= 3, true,
   'nota sobre Nvidia por nombre SÍ pasa');
eq(p('NVDA stock jumps on Q3 guidance', ['NVDA']) >= 3, true,
   'nota con el ticker en el titular SÍ pasa');

console.log('\n=== El ticker se normaliza según el instrumento ===');
const pc = (titulo) => N.puntuarRelevancia({ titulo, tickers: [] },
  { symbol: 'BTC-USD', nombre: 'Bitcoin USD' }).score;
eq(pc('BTC breaks above resistance') >= 3, true, 'BTC-USD reconoce "BTC"');
eq(pc('Bitcoin selloff accelerates') >= 3, true, 'BTC-USD reconoce "Bitcoin"');
eq(pc('Ethereum hits new high') >= 3, false, 'no confunde con otra cripto');

console.log('\n=== Ruido institucional (casos reales de MarketBeat) ===');
eq(N.esRuido('NVIDIA Corporation $NVDA Stock Holdings Reduced by Spire Wealth Management'), true, '13F holdings reduced');
eq(N.esRuido('NVIDIA Corporation $NVDA Stock Position Raised by Shaker Investments LLC'), true, '13F position raised');
eq(N.esRuido('Apple Inc (AAPL) Shares Surge 1.1% -- What GF Score of 96 Tells Investors'), true, 'GF Score');
eq(N.esRuido('Nvidia adds more than $400 billion in value after blowout earnings'), false, 'noticia real no es ruido');
eq(p('NVIDIA Corporation $NVDA Stock Position Raised by Shaker Investments LLC') >= 3, false,
   'el spam 13F no llega al umbral');

console.log('\n=== Recopilatorios ===');
eq(N.contarTickersEnTitulo('Top Picks: NBC (NTIOF), Galicia (GGAL), BBVA (BBAR)'), 3, 'cuenta 3 tickers');
eq(N.contarTickersEnTitulo('Nvidia (NVDA) beats earnings'), 1, 'cuenta 1 ticker');
{
  const g = t => N.puntuarRelevancia({ titulo: t, tickers: [] },
    { symbol: 'GGAL.BA', nombre: 'Grupo Financiero Galicia' }).score;
  // La penalización debe poder anular un match perfecto de ticker + nombre.
  eq(g('Top Picks: NBC (NTIOF), Grupo Financiero Galicia (GGAL), BBVA (BBAR)') >= 3, false,
     'recopilatorio no llega al umbral pese a coincidir ticker y nombre');
  eq(g('Grupo Financiero Galicia sube tras presentar balance') >= 3, true,
     'nota legítima de GGAL sí entra');
}

console.log('\n=== Cripto: empresa tenedora ≠ el activo ===');
{
  const b = t => N.puntuarRelevancia({ titulo: t, tickers: [] },
    { symbol: 'BTC-USD', nombre: 'Bitcoin USD' }).score;
  eq(b('Strive May Have Raised Equivalent of 1,192 BTC via Preferred Stock') >= 3, false,
     'empresa que emite preferidas para comprar BTC');
  eq(b('American Bitcoin Adds 500 BTC as Reverse Split Takes Effect') >= 3, false,
     'empresa tesorera con reverse split');
  eq(b('ASST Jumps Toward Best Month As BTC Holdings Grow') >= 3, false,
     'acción que sube por sus tenencias de BTC');
  eq(b('Bitcoin falls 5% as ETF outflows accelerate') >= 3, true,
     'noticia sobre el precio de Bitcoin sí entra');
  eq(b('BTC breaks below support amid liquidations') >= 3, true,
     'noticia técnica sobre BTC sí entra');
}

console.log('\n=== Finnhub sin key no rompe ===');
(async () => {
  const r = await N.finnhubNews('NVDA', { apiKey: null });
  eq(Array.isArray(r) && r.length === 0, true, 'devuelve [] sin key, no lanza');

  const r2 = await N.finnhubNews('GGAL.BA', { apiKey: 'x' });
  eq(r2.length, 0, 'saltea símbolos con sufijo de exchange');

  console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
  process.exit(fail ? 1 : 0);
})();
