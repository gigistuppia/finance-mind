const I = require('../lib/indicators.js');
let fail = 0;
const near = (a,b,tol,label) => { const ok = a!=null && Math.abs(a-b)<=tol;
  console.log(`${ok?'  OK  ':'  FALLA '} ${label}: ${a} (esperado ~${b})`); if(!ok) fail++; };
const eq = (a,b,label) => { const ok = a===b;
  console.log(`${ok?'  OK  ':'  FALLA '} ${label}: ${a} (esperado ${b})`); if(!ok) fail++; };

console.log('\n=== 1. SMA / EMA verificables a mano ===');
const s = I.sma([1,2,3,4,5,6],3);
eq(s[1],null,'warmup null'); near(s[2],2,1e-9,'(1+2+3)/3'); near(s[5],5,1e-9,'(4+5+6)/3'); eq(s.length,6,'longitud');
const e = I.ema([1,2,3,4,5],3);
near(e[2],2,1e-9,'semilla=sma3'); near(e[3],3,1e-9,'4*.5+2*.5'); near(e[4],4,1e-9,'5*.5+3*.5');

console.log('\n=== 2. RSI(14) contra aritmetica de Wilder hecha a mano ===');
const closes = [44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,
                46.28,46.00,46.03,46.41,46.22,45.64,46.21,46.25,45.71,46.45,45.78,45.35,44.03,44.18,
                44.22,44.57,43.42,42.66,43.13];
const r = I.rsi(closes,14);
eq(r[13],null,'sin RSI antes del indice 14');
// gains=3.34 losses=1.40 -> avgG=.2385714 avgL=.1 -> RS=2.385714 -> 100-100/3.385714
near(r[14], 100-100/(1+(3.34/14)/(1.40/14)), 1e-6, 'r[14] = aritmetica exacta');
// paso 15: cambio -0.28 -> avgG=(.2385714*13)/14 avgL=(.1*13+.28)/14
{ const aG=(3.34/14*13)/14, aL=(1.40/14*13+0.28)/14;
  near(r[15], 100-100/(1+aG/aL), 1e-6, 'r[15] = suavizado de Wilder'); }
eq(r.every(v=>v===null||(v>=0&&v<=100)), true, 'RSI siempre en [0,100]');
eq(r.length, closes.length, 'longitud preservada');

console.log('\n=== 3. MACD con serie suficientemente larga ===');
const long = Array.from({length:80},(_,k)=>100+10*Math.sin(k/7)+k*0.3);
const m = I.macd(long);
const e12=I.ema(long,12), e26=I.ema(long,26);
near(m.line[30], e12[30]-e26[30], 1e-9, 'linea = ema12-ema26');
eq(m.line[24], null, 'linea null antes de ema26');
eq(m.signal[32], null, 'signal null antes de 9 valores de MACD');
eq(m.signal[33]!=null, true, 'signal arranca en 25+9-1=33');
const i=long.length-1;
near(m.histogram[i], m.line[i]-m.signal[i], 1e-9, 'histograma = linea - signal');
eq(m.signal.length, long.length, 'signal alineada a la entrada');

console.log('\n=== 4. MACD se niega a inventar si faltan datos ===');
const corta = I.macd(closes); // 33 cierres: no alcanzan para signal de 9
eq(corta.signal.every(v=>v===null), true, 'signal toda null con 33 cierres');
eq(corta.histogram.every(v=>v===null), true, 'histograma null en vez de numero falso');

console.log('\n=== 5. ATR (rango verdadero a mano) ===');
const cndl=[{h:10,l:8,c:9},{h:12,l:9,c:11},{h:13,l:10,c:12},{h:12,l:9,c:10}];
near(I.atr(cndl,3)[3], 3, 1e-9, 'TR=3,3,3 -> atr3=3');

console.log('\n=== 6. Bollinger ===');
const flat=Array(25).fill(100); flat[24]=110;
const b=I.bollinger(flat,20,2);
near(b.middle[24], 100.5, 1e-9, 'media = (19*100+110)/20');
eq(b.percentB[24]>100, true, 'precio sobre la banda -> %B>100');
eq(b.upper.length,25,'longitud');

console.log('\n=== 7. Drawdown ===');
const dd=I.drawdown([10,12,9,15,7]);
near(dd[2],-25,1e-9,'12 -> 9 = -25%'); near(dd[4],-53.3333,1e-3,'15 -> 7');
eq(dd.filter(v=>v>0).length,0,'nunca positivo');

console.log('\n=== 8. computeAll rechaza series cortas ===');
try { I.computeAll(Array(10).fill({o:1,h:1,l:1,c:1,v:1,t:0})); console.log('  FALLA no lanzo'); fail++; }
catch(err){ console.log('  OK   lanza:', err.message); }

console.log(fail===0 ? '\n*** TODOS LOS TESTS PASARON ***' : `\n*** ${fail} FALLAS ***`);
process.exit(fail?1:0);
