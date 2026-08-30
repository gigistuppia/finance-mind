const S = require('../lib/symbols.js');

let fail = 0;
const eq = (a, b, l) => {
  const ok = a === b;
  console.log(`${ok ? '  OK  ' : '  FALLA '} ${l}: ${JSON.stringify(a)} (esperado ${JSON.stringify(b)})`);
  if (!ok) fail++;
};
/** Atajo: mapea y devuelve solo el símbolo. */
const m = tv => S.mapear(tv).symbol;

console.log('=== Estados Unidos: sin sufijo ===');
eq(m('NASDAQ:AAPL'), 'AAPL', 'NASDAQ');
eq(m('NYSE:IBM'), 'IBM', 'NYSE');
eq(m('AMEX:SPY'), 'SPY', 'AMEX');
eq(m('OTC:BAYRY'), 'BAYRY', 'OTC');

console.log('\n=== Clases de acción: punto y guion bajo → guion ===');
eq(m('NYSE:BRK.B'), 'BRK-B', 'BRK.B → BRK-B');
eq(m('NYSE:BF.B'), 'BF-B', 'BF.B → BF-B');
eq(m('TSX:CTC.A'), 'CTC-A.TO', 'clase + sufijo canadiense');
eq(m('OMXSTO:ERIC_B'), 'ERIC-B.ST', 'guion bajo sueco');
eq(m('OMXCOP:NOVO_B'), 'NOVO-B.CO', 'guion bajo danés');

console.log('\n=== Brasil: el dígito ES parte del ticker ===');
eq(m('BMFBOVESPA:PETR4'), 'PETR4.SA', 'preferida no se toca');
eq(m('BMFBOVESPA:PETR3'), 'PETR3.SA', 'ordinaria no se toca');
eq(m('BOVESPA:SANB11'), 'SANB11.SA', 'unit de dos dígitos');

console.log('\n=== Latinoamérica: .CL es Colombia, no Chile ===');
eq(m('BCBA:GGAL'), 'GGAL.BA', 'Argentina');
eq(m('BYMA:YPFD'), 'YPFD.BA', 'BYMA es igual a BCBA');
eq(m('BCS:SQM-B'), 'SQM-B.SN', 'Chile es .SN');
eq(m('BVC:ECOPETROL'), 'ECOPETROL.CL', 'Colombia es .CL');

console.log('\n=== Europa ===');
eq(m('LSE:SHEL'), 'SHEL.L', 'Londres');
eq(m('XETR:SAP'), 'SAP.DE', 'Xetra');
eq(m('SIX:NESN'), 'NESN.SW', 'Suiza');
eq(m('EURONEXTAMS:ASML'), 'ASML.AS', 'Ámsterdam');
eq(m('BME:SAN'), 'SAN.MC', 'España');

console.log('\n=== Plazas alemanas sin línea propia caen a Xetra ===');
eq(m('TRADEGATE:SAP'), 'SAP.DE', 'Tradegate → .DE');
eq(m('GETTEX:SAP'), 'SAP.DE', 'gettex → .DE');
eq(m('BER:SAP'), 'SAP.DE', 'Berlín (.BE dado de baja) → .DE');
eq(S.mapear('TRADEGATE:SAP').confianza, 'media', 'el fallback baja la confianza');
eq(S.mapear('TRADEGATE:SAP').nota.includes('Xetra'), true, 'y lo explica');

console.log('\n=== EURONEXT genérico es ambiguo ===');
{
  const r = S.mapear('EURONEXT:MC');
  eq(r.symbol, 'MC.PA', 'propone París');
  eq(r.confianza, 'baja', 'confianza baja porque es una apuesta');
  eq(r.alternativas.length, 3, 'ofrece las otras tres plazas');
}

console.log('\n=== TSE es TOKIO, no Toronto ===');
eq(m('TSE:7203'), '7203.T', 'Toyota en Tokio');
eq(m('TSX:SHOP'), 'SHOP.TO', 'Shopify en Toronto');

console.log('\n=== Hong Kong: exactamente 4 dígitos ===');
eq(m('HKEX:700'), '0700.HK', '700 → 0700');
eq(m('HKEX:1'), '0001.HK', '1 → 0001');
eq(m('HKEX:9988'), '9988.HK', '9988 NO se padea a 5');

console.log('\n=== Resto de Asia ===');
eq(m('SSE:600519'), '600519.SS', 'Shanghái');
eq(m('SZSE:300750'), '300750.SZ', 'Shenzhen');
eq(m('NSE:RELIANCE'), 'RELIANCE.NS', 'India NSE');
eq(m('BSE:RELIANCE'), 'RELIANCE.BO', 'India BSE');
eq(m('ASX:BHP'), 'BHP.AX', 'Australia');
{
  const k = S.mapear('KRX:005930');
  eq(k.symbol, '005930.KS', 'Corea prueba KOSPI primero');
  eq(k.alternativas[0], '005930.KQ', 'y ofrece KOSDAQ como alternativa');
}

console.log('\n=== Cripto ===');
eq(m('BINANCE:BTCUSDT'), 'BTC-USD', 'USDT → USD');
eq(m('BINANCE:ETHUSDC'), 'ETH-USD', 'USDC → USD');
eq(m('COINBASE:ETHUSD'), 'ETH-USD', 'USD directo');
eq(m('BYBIT:AVAXUSDT.P'), 'AVAX-USD', 'perpetuo: se quita el .P');
eq(m('BINANCE:ETHBTC'), 'ETH-BTC', 'cross cripto-cripto se preserva');
eq(m('BITSTAMP:BTCEUR'), 'BTC-EUR', 'fiat no-USD se preserva');
eq(m('BINANCE:USDTUSD'), 'USDT-USD', 'stablecoin como BASE se mantiene');
eq(m('BINANCE:DAIUSDT'), 'DAI-USD', 'stablecoin contra stablecoin colapsa a USD');
eq(m('BINANCE:USDCUSD'), 'USDC-USD', 'USDC como base');
eq(m('OKX:BTC-USDT'), 'BTC-USD', 'separador de OKX');

console.log('\n=== Cripto: las bases que rompen un endsWith ingenuo ===');
eq(m('BINANCE:PAXGUSDT'), 'PAXG-USD', 'PAXG no se parte en PAXGUS + DT');
eq(m('BINANCE:BTCDOMUSDT'), 'BTCDOM-USD', 'BTCDOM no se parte por el BTC');
{
  const p = S.mapear('BINANCE:1000PEPEUSDT');
  eq(p.symbol, 'PEPE-USD', 'quita el multiplicador 1000');
  eq(p.confianza, 'baja', 'pero avisa que el precio no es comparable');
  eq(p.nota.includes('NO es comparable'), true, 'y lo dice explícitamente');
}

console.log('\n=== Forex: siempre 6 letras ===');
eq(m('OANDA:EURUSD'), 'EURUSD=X', 'par estándar');
eq(m('FX:GBPJPY'), 'GBPJPY=X', 'cruce sin dólar');
eq(m('FX_IDC:USDARS'), 'USDARS=X', 'peso argentino');
eq(m('OANDA:EUR_USD'), 'EURUSD=X', 'quita el guion bajo');
{
  // EUR=X es USDEUR (0,863), la INVERSA de EURUSD=X (1,159).
  const r = S.mapear('OANDA:EUR');
  eq(r.confianza, 'rechazado', 'rechaza la forma corta de 3 letras');
  eq(r.motivo.includes('inversa'), true, 'explica que devolvería el par dado vuelta');
}

console.log('\n=== Metales spot: Yahoo no los tiene ===');
eq(m('OANDA:XAUUSD'), 'GC=F', 'oro spot → futuro');
eq(m('TVC:GOLD'), 'GC=F', 'GOLD → futuro');
eq(S.mapear('OANDA:XAUUSD').confianza, 'media', 'confianza media: no es el mismo precio');

console.log('\n=== Commodities ===');
eq(m('COMEX:GC1!'), 'GC=F', 'oro, quita el 1!');
eq(m('NYMEX:CL1!'), 'CL=F', 'crudo WTI');
eq(m('ICEEUR:BRN1!'), 'BZ=F', 'Brent tiene raíz distinta');
eq(m('CBOT:ZW1!'), 'ZW=F', 'trigo');
eq(m('CBOT:ZS2!'), 'ZS=F', 'soja, segundo contrato');

console.log('\n=== Índices: prefijo ^ y las cinco excepciones ===');
eq(m('SP:SPX'), '^GSPC', 'S&P 500');
eq(m('NASDAQ:IXIC'), '^IXIC', 'Nasdaq Composite');
eq(m('DJ:DJI'), '^DJI', 'Dow Jones');
eq(m('TVC:VIX'), '^VIX', 'VIX');
eq(m('BCBA:IMV'), '^MERV', 'Merval bajo prefijo de bolsa');
eq(m('TVC:NI225'), '^N225', 'Nikkei');
eq(m('ASX:XJO'), '^AXJO', 'ASX 200 bajo prefijo de bolsa');
// Estas cinco NO llevan ^. Aplicarles el prefijo genérico las rompe.
eq(m('TVC:FTSEMIB'), 'FTSEMIB.MI', 'FTSE MIB sin ^');
eq(m('TVC:DXY'), 'DX-Y.NYB', 'índice dólar sin ^');

console.log('\n=== Sin equivalente: se rechaza con explicación ===');
for (const [tv, palabra] of [['PSE:SM', 'Filipinas'], ['BVL:ALICORC1', 'Lima'], ['MYX:MAYBANK', 'Malasia']]) {
  const r = S.mapear(tv);
  eq(r.confianza, 'rechazado', `${tv} rechazado`);
  eq(r.motivo.includes(palabra), true, `y explica el motivo (${palabra})`);
}

console.log('\n=== Nunca falla en silencio (§14.6) ===');
{
  const r = S.mapear('EXCHANGE_RARO:FOO');
  eq(r.symbol, 'FOO', 'propone el ticker pelado');
  eq(r.confianza, 'baja', 'con confianza baja');
  eq(r.nota.includes('desconocido'), true, 'y avisa que hay que validarlo');
}
eq(S.mapear('').confianza, 'rechazado', 'entrada vacía → rechazado');
eq(S.mapear('NASDAQ:').confianza, 'rechazado', 'prefijo sin ticker → rechazado');

console.log('\n=== Símbolos sin prefijo ===');
eq(m('AAPL'), 'AAPL', 'ticker pelado');
eq(m('BTC-USD'), 'BTC-USD', 'símbolo de Yahoo ya listo pasa igual');
eq(m('^GSPC'), '^GSPC', 'índice ya formateado');
eq(m('GC=F'), 'GC=F', 'futuro ya formateado');
eq(S.mapear('AAPL').confianza, 'media', 'sin prefijo, la confianza baja a media');

console.log('\n=== Parseo del .txt de TradingView ===');
{
  const txt = 'NASDAQ:AAPL,NYSE:IBM,BCBA:GGAL';
  eq(S.parsearLista(txt).length, 3, 'separa por comas');
  eq(S.parsearLista('A\nB\r\nC').length, 3, 'tolera saltos de línea');
  eq(S.parsearLista('###Tecnología,NASDAQ:AAPL').length, 1, 'ignora encabezados de sección');
  eq(S.parsearLista('NASDAQ:AAPL,NASDAQ:AAPL').length, 1, 'deduplica');
  eq(S.parsearLista('  ,, ,  ').length, 0, 'entrada vacía da lista vacía');
}

console.log('\n=== mapearLista separa en tres grupos ===');
{
  const r = S.mapearLista('NASDAQ:AAPL,BINANCE:BTCUSDT,PSE:SM,EURONEXT:MC');
  eq(r.total, 4, 'cuenta las cuatro entradas');
  eq(r.listos.length, 2, 'AAPL y BTC-USD quedan listos');
  eq(r.rechazados.length, 1, 'PSE queda rechazado');
  eq(r.revisar.length, 1, 'EURONEXT queda a validar');
  eq(r.listos.length + r.revisar.length + r.rechazados.length, r.total, 'no se pierde ninguno');
}

console.log(fail === 0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
process.exit(fail ? 1 : 0);
