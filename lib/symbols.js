/**
 * Mapeo de símbolos de TradingView a símbolos de Yahoo Finance.
 *
 * Es el corazón del importador (fase 2) y el riesgo §14.6: si un símbolo mapea
 * mal, el usuario ve el precio de OTRO activo sin enterarse. Por eso acá nada
 * falla en silencio — todo resultado trae `confianza` y, cuando corresponde,
 * `nota` explicando la duda.
 *
 * Las reglas salen de `docs/mapeo-simbolos.md`, verificadas contra ~150
 * símbolos reales. Las trampas están comentadas donde aplican, porque son
 * exactamente las que uno "arregla" por intuición y rompe.
 */

/* ────────────────────── tablas ────────────────────── */

/** Prefijo de exchange → sufijo de Yahoo. Cadena vacía = sin sufijo. */
const SUFIJOS = {
  // Estados Unidos
  NASDAQ: '', NYSE: '', AMEX: '', NYSEAMERICAN: '', ARCA: '', BATS: '', OTC: '', PINK: '',
  // Canadá
  TSX: '.TO', TSXV: '.V', CSE: '.CN', NEO: '.NE',
  // Latinoamérica
  BCBA: '.BA', BYMA: '.BA',
  BMFBOVESPA: '.SA', BOVESPA: '.SA', B3: '.SA',
  BMV: '.MX', BCS: '.SN', BVC: '.CL',
  // Reino Unido
  LSE: '.L', LSIN: '.IL',
  // Alemania — siete plazas, siete precios distintos del mismo papel
  XETR: '.DE', FWB: '.F', SWB: '.SG', MUN: '.MU', DUS: '.DU', HAM: '.HM', HAN: '.HA',
  // Euronext
  EURONEXTPAR: '.PA', EURONEXTAMS: '.AS', EURONEXTBRU: '.BR',
  EURONEXTLIS: '.LS', EURONEXTDUB: '.IR',
  // Resto de Europa
  BME: '.MC', MIL: '.MI', SIX: '.SW', VIE: '.VI', ATHEX: '.AT', BIST: '.IS',
  GPW: '.WA', NEWCONNECT: '.WA',
  OMXSTO: '.ST', OSL: '.OL', OMXCOP: '.CO', OMXHEX: '.HE', OMXICE: '.IC',
  // Asia-Pacífico — ojo: TSE es TOKIO, no Toronto
  TSE: '.T', HKEX: '.HK', SSE: '.SS', SZSE: '.SZ', KRX: '.KS',
  NSE: '.NS', BSE: '.BO', TWSE: '.TW', SGX: '.SI',
  ASX: '.AX', NZX: '.NZ', IDX: '.JK', SET: '.BK', HOSE: '.VN', HNX: '.VN',
};

/** Plazas alemanas sin línea propia en Yahoo: caen a Xetra. */
const FALLBACK_ALEMANIA = { TRADEGATE: '.DE', GETTEX: '.DE', BER: '.DE', LS: '.DE' };

/** Prefijos que NO tienen equivalente utilizable. Se rechazan con explicación. */
const SIN_EQUIVALENTE = {
  PSE: 'La bolsa de Filipinas no tiene cobertura de acciones en Yahoo Finance.',
  BVL: 'La bolsa de Lima está indexada en Yahoo pero no devuelve cotizaciones.',
  MYX: 'En Malasia, Yahoo usa el código numérico de Bursa, no el ticker alfabético (MAYBANK es 1155.KL).',
};

/** Índices: no llevan sufijo sino prefijo `^`, y necesitan tabla propia. */
const INDICES = {
  SPX: '^GSPC', SP500: '^GSPC', US500: '^GSPC',
  IXIC: '^IXIC', NDX: '^NDX', NDQ: '^NDX', US100: '^NDX',
  DJI: '^DJI', US30: '^DJI', RUT: '^RUT', VIX: '^VIX',
  IMV: '^MERV', MERVAL: '^MERV',
  IBOV: '^BVSP', TSX: '^GSPTSE', ME: '^MXX', IPSA: '^IPSA',
  UKX: '^FTSE', DAX: '^GDAXI', DE40: '^GDAXI',
  CAC40: '^FCHI', CAC: '^FCHI', SX5E: '^STOXX50E',
  IBEX35: '^IBEX', IBEX: '^IBEX', AEX: '^AEX', SMI: '^SSMI', OMXS30: '^OMX',
  NI225: '^N225', JP225: '^N225', HSI: '^HSI',
  KOSPI: '^KS11', KOSDAQ: '^KQ11', TAIEX: '^TWII',
  XJO: '^AXJO', NIFTY: '^NSEI', SENSEX: '^BSESN',
  STI: '^STI', KLCI: '^KLSE', NZ50G: '^NZ50',
  US10Y: '^TNX', US05Y: '^FVX', US30Y: '^TYX', US03MY: '^IRX',
  // ⚠ Estos NO llevan `^`. Aplicarles el prefijo genérico los rompe.
  FTSEMIB: 'FTSEMIB.MI', DXY: 'DX-Y.NYB', PSEI: 'PSEI.PS',
};

/** Futuros de commodities y financieros: raíz → símbolo Yahoo. */
const FUTUROS = {
  GC: 'GC=F', MGC: 'MGC=F', SI: 'SI=F', HG: 'HG=F', PL: 'PL=F', PA: 'PA=F',
  CL: 'CL=F', BRN: 'BZ=F', BZ: 'BZ=F', NG: 'NG=F', RB: 'RB=F', HO: 'HO=F',
  ZW: 'ZW=F', ZC: 'ZC=F', ZS: 'ZS=F', ZM: 'ZM=F', ZL: 'ZL=F', ZO: 'ZO=F', ZR: 'ZR=F',
  KC: 'KC=F', CT: 'CT=F', SB: 'SB=F', CC: 'CC=F', LE: 'LE=F', HE: 'HE=F',
  ES: 'ES=F', NQ: 'NQ=F', YM: 'YM=F', RTY: 'RTY=F', ZN: 'ZN=F', ZB: 'ZB=F', '6E': '6E=F',
};

/** Metales spot: Yahoo no los tiene. Se mapean al futuro más cercano. */
const SPOT_A_FUTURO = { XAUUSD: 'GC=F', XAGUSD: 'SI=F', GOLD: 'GC=F', SILVER: 'SI=F' };

const EXCHANGES_CRIPTO = new Set([
  'BINANCE', 'COINBASE', 'KRAKEN', 'BITSTAMP', 'BYBIT', 'OKX', 'BITFINEX',
  'HUOBI', 'KUCOIN', 'MEXC', 'GATEIO', 'UPBIT', 'BITGET', 'CRYPTOCAP', 'CRYPTO',
]);

const EXCHANGES_FOREX = new Set([
  'OANDA', 'FX', 'FX_IDC', 'FOREXCOM', 'SAXO', 'PEPPERSTONE',
  'ICMTRADER', 'EASYMARKETS', 'CURRENCYCOM', 'FXCM',
]);

const EXCHANGES_FUTUROS = new Set([
  'COMEX', 'NYMEX', 'CBOT', 'CME', 'ICE', 'ICEEUR', 'ICEUS', 'NYBOT',
]);

/** Feeds de datos de TradingView, no bolsas. Casi siempre son índices. */
const FEEDS = new Set(['TVC', 'SP', 'DJ', 'INDEX', 'CBOE', 'FRED', 'ECONOMICS', 'CAPITALCOM']);

/**
 * Cotizaciones de cripto ordenadas de MÁS LARGA a más corta. El orden es
 * obligatorio: con la lista al revés, `PAXGUSDT` se parte en `PAXGUS` + `DT`.
 */
const QUOTES_CRIPTO = [
  'FDUSD', 'BUSD', 'USDT', 'USDC', 'TUSD', 'USDD', 'USDP', 'DAI',
  'USD', 'BTC', 'ETH', 'BNB', 'EUR', 'GBP', 'JPY', 'AUD', 'BRL', 'TRY', 'KRW',
];

/** Todas estas cotizan ~1 USD y Yahoo las unifica bajo `-USD`. */
const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'USDD', 'USDP', 'DAI', 'USD']);

/**
 * Monedas que NUNCA son la base de un par cripto en estos exchanges.
 *
 * Desambigua casos como `USDTUSD` (= USDT contra USD): termina legítimamente
 * en `TUSD`, así que la búsqueda por sufijo más largo lo partiría en
 * `USD` + `TUSD`. Como `USD` no es una cripto, ese corte se descarta y se
 * sigue probando hasta llegar al correcto: `USDT` + `USD`.
 */
const FIAT_NUNCA_BASE = new Set(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'BRL', 'TRY', 'KRW', 'CHF', 'CAD']);

const MONEDAS_FIAT = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD', 'SGD',
  'ARS', 'BRL', 'MXN', 'CLP', 'COP', 'PEN', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY',
  'ZAR', 'INR', 'KRW', 'TWD', 'THB', 'IDR', 'MYR', 'PHP', 'CZK', 'HUF', 'ILS',
]);

/* ────────────────────── helpers ────────────────────── */

/**
 * Todos los sufijos de exchange que usa Yahoo, sin el punto.
 * Se deriva de las tablas para que no puedan desincronizarse.
 */
const SUFIJOS_YAHOO = new Set(
  [...Object.values(SUFIJOS), ...Object.values(FALLBACK_ALEMANIA)]
    .filter(Boolean)
    .map(s => s.slice(1))
);

/**
 * ¿El símbolo YA viene en formato Yahoo?
 *
 * Importa porque el punto es ambiguo: en `BRK.B` separa la clase de acción y
 * hay que convertirlo en guion; en `GGAL.BA` es el sufijo del exchange y hay
 * que dejarlo intacto. Sin esta distinción, un usuario que escribe `GGAL.BA`
 * en el campo de corrección manual recibe `GGAL-BA`, que no existe.
 *
 * La regla: si lo que sigue al último punto es un sufijo conocido de Yahoo,
 * el símbolo ya está en formato Yahoo. `.BA` sí, `.B` no.
 */
function yaEsFormatoYahoo(s) {
  if (/[=^]/.test(s)) return true;                    // GC=F, EURUSD=X, ^GSPC
  if (/-(USD|EUR|BTC|USDT)$/i.test(s)) return true;   // BTC-USD
  const punto = s.lastIndexOf('.');
  if (punto === -1) return false;
  return SUFIJOS_YAHOO.has(s.slice(punto + 1).toUpperCase());
}

/**
 * Normaliza el separador de clase de acción.
 * Yahoo usa guion; TradingView usa punto, guion bajo o espacio.
 * `BRK.B` → `BRK-B` · `ERIC_B` → `ERIC-B` · `CTC.A` → `CTC-A`
 */
function normalizarClase(ticker) {
  return ticker.replace(/[._\s]+/g, '-').replace(/-+$/, '');
}

/** Quita sufijos de contrato de TradingView: `1!`, `2!`, `!`, `.P`, `PERP`. */
function limpiarContrato(t) {
  return t.replace(/\d*!$/, '').replace(/\.P$/i, '').replace(/PERP$/i, '');
}

function resultado(symbol, confianza, extra = {}) {
  return { symbol, confianza, ...extra };
}

function rechazo(motivo, extra = {}) {
  return { symbol: null, confianza: 'rechazado', motivo, ...extra };
}

/* ────────────────────── cripto ────────────────────── */

/**
 * `BINANCE:BTCUSDT` → `BTC-USD`. El exchange es ruido: Yahoo publica un precio
 * compuesto, no el de una plaza puntual.
 */
function mapearCripto(par) {
  let p = limpiarContrato(par.toUpperCase()).replace(/[-_/]/g, '');

  // Binance lista memecoins multiplicadas para que el tick sea manejable.
  // Yahoo publica el activo sin multiplicar, así que el precio NO es comparable.
  let multiplicador = null;
  const mult = p.match(/^(1000|1M)(.+)$/);
  if (mult) { multiplicador = mult[1]; p = mult[2]; }

  for (const q of QUOTES_CRIPTO) {
    if (!p.endsWith(q)) continue;
    const base = p.slice(0, -q.length);
    if (base.length < 2) continue;              // evita partir mal un ticker corto
    if (FIAT_NUNCA_BASE.has(base)) continue;    // ver FIAT_NUNCA_BASE: desambigua USDTUSD

    // Toda stablecoin como cotización se normaliza a USD: Yahoo unifica el par.
    // Funciona también cuando la base es stablecoin (USDTUSD → USDT-USD,
    // DAIUSDT → DAI-USD). Las cotizaciones no-stable se preservan (ETH-BTC).
    const quote = STABLECOINS.has(q) ? 'USD' : q;
    const symbol = `${base}-${quote}`;

    if (multiplicador) {
      return resultado(symbol, 'baja', {
        nota: `TradingView lo lista multiplicado por ${multiplicador}. Yahoo publica el activo sin multiplicar: el precio NO es comparable con el de tu gráfico.`,
      });
    }
    return resultado(symbol, 'alta');
  }

  return rechazo(`No se pudo separar base y cotización en "${par}".`);
}

/* ────────────────────── forex ────────────────────── */

/** `OANDA:EURUSD` → `EURUSD=X`. Siempre 6 letras: la forma corta es ambigua. */
function mapearForex(par) {
  const p = par.toUpperCase().replace(/[-_/]/g, '');

  if (SPOT_A_FUTURO[p]) {
    return resultado(SPOT_A_FUTURO[p], 'media', {
      nota: 'Yahoo no publica el spot de metales. Se usa el futuro, que cotiza parecido pero no igual.',
    });
  }

  if (!/^[A-Z]{6}$/.test(p)) {
    // ⚠ `EUR=X` NO es la inversa esperable: es USDEUR (0,863), no EURUSD (1,159).
    // Aceptar 3 letras devolvería el par dado vuelta sin que nadie lo note.
    return rechazo(
      `"${par}" no es un par de 6 letras. La forma corta de Yahoo es ambigua: EUR=X significa USDEUR, la inversa de EURUSD=X.`
    );
  }

  const base = p.slice(0, 3), quote = p.slice(3);
  const confianza = MONEDAS_FIAT.has(base) && MONEDAS_FIAT.has(quote) ? 'alta' : 'media';
  return resultado(`${p}=X`, confianza);
}

/* ────────────────────── futuros ────────────────────── */

function mapearFuturo(ticker) {
  const raiz = limpiarContrato(ticker.toUpperCase())
    .replace(/[FGHJKMNQUVXZ]\d{1,4}$/, ''); // código de vencimiento: GCZ2026

  if (FUTUROS[raiz]) return resultado(FUTUROS[raiz], 'alta');
  if (SPOT_A_FUTURO[raiz]) return resultado(SPOT_A_FUTURO[raiz], 'media');
  return resultado(`${raiz}=F`, 'baja', {
    nota: 'Raíz de futuro desconocida. Se construyó por regla general; hay que validarla.',
  });
}

/* ────────────────────── acciones ────────────────────── */

function mapearAccion(prefijo, ticker) {
  const sufijo = SUFIJOS[prefijo] ?? FALLBACK_ALEMANIA[prefijo];
  const t = ticker.toUpperCase();

  // Brasil: el dígito ES parte del ticker (PETR4 preferida, PETR3 ordinaria,
  // SANB11 unit). Normalizar el separador acá rompería el símbolo.
  if (sufijo === '.SA') return resultado(`${t}${sufijo}`, 'alta');

  // Hong Kong: exactamente 4 dígitos. `700` falla, `0700` anda;
  // `9988` anda, `09988` falla. Nada de padear a 5.
  if (sufijo === '.HK') {
    const n = t.replace(/\D/g, '');
    if (!n) return rechazo(`"${ticker}" no parece un código de Hong Kong.`);
    return resultado(`${n.padStart(4, '0')}.HK`, 'alta');
  }

  const limpio = normalizarClase(t);

  if (FALLBACK_ALEMANIA[prefijo]) {
    return resultado(`${limpio}${sufijo}`, 'media', {
      nota: `${prefijo} no tiene línea propia en Yahoo. Se usa Xetra (.DE): mismo papel, centavos de diferencia.`,
    });
  }

  // Corea: TradingView no distingue KOSPI de KOSDAQ, Yahoo sí.
  if (sufijo === '.KS') {
    return resultado(`${limpio}.KS`, 'media', {
      nota: 'Si no valida, reintentar con .KQ (KOSDAQ). TradingView no distingue los dos mercados.',
      alternativas: [`${limpio}.KQ`],
    });
  }

  return resultado(`${limpio}${sufijo}`, sufijo === '' ? 'alta' : 'alta');
}

/* ────────────────────── dispatcher ────────────────────── */

/**
 * Convierte un símbolo de TradingView a símbolo de Yahoo.
 *
 * Devuelve siempre un objeto con `confianza`:
 *   alta      → mapeo verificado, se puede usar directo
 *   media     → regla razonable, conviene validar contra Yahoo
 *   baja      → construido por regla general, hay que validar sí o sí
 *   rechazado → no hay equivalente; `motivo` explica por qué
 *
 * @param {string} entrada  `NASDAQ:AAPL`, `BINANCE:BTCUSDT`, o `AAPL` pelado
 */
function mapear(entrada) {
  const bruto = String(entrada || '').trim();
  if (!bruto) return rechazo('Símbolo vacío.');

  const partes = bruto.split(':');
  const tienePrefijo = partes.length >= 2;
  const prefijo = tienePrefijo ? partes[0].toUpperCase().trim() : null;
  const ticker = (tienePrefijo ? partes.slice(1).join(':') : partes[0]).trim();

  if (!ticker) return rechazo(`"${bruto}" no tiene ticker después del prefijo.`);

  const base = { entrada: bruto };

  // Sin prefijo: puede ser un símbolo de Yahoo ya listo, o un ticker US pelado.
  if (!tienePrefijo) {
    const t = ticker.toUpperCase();

    // Ya viene en formato Yahoo (GGAL.BA, 7203.T, BTC-USD, ^GSPC, GC=F):
    // se respeta tal cual. Normalizarlo lo rompería.
    if (yaEsFormatoYahoo(t)) {
      return { ...resultado(t, 'alta'), ...base };
    }

    return {
      ...resultado(normalizarClase(t), 'media', {
        nota: 'Sin prefijo de exchange. Se asume mercado estadounidense; hay que validar.',
      }), ...base,
    };
  }

  if (SIN_EQUIVALENTE[prefijo]) {
    return { ...rechazo(SIN_EQUIVALENTE[prefijo]), ...base };
  }

  const tickerLimpio = limpiarContrato(ticker.toUpperCase());

  // Índices primero: `SP:SPX`, `TVC:DAX`, y también `BCBA:IMV` o `ASX:XJO`,
  // que comparten prefijo con acciones.
  if (INDICES[tickerLimpio] && (FEEDS.has(prefijo) || !SUFIJOS[prefijo] || esProbableIndice(prefijo, tickerLimpio))) {
    return { ...resultado(INDICES[tickerLimpio], 'alta'), ...base };
  }

  if (EXCHANGES_CRIPTO.has(prefijo)) return { ...mapearCripto(ticker), ...base };
  if (EXCHANGES_FOREX.has(prefijo)) return { ...mapearForex(ticker), ...base };
  if (EXCHANGES_FUTUROS.has(prefijo)) return { ...mapearFuturo(ticker), ...base };

  if (FEEDS.has(prefijo)) {
    if (SPOT_A_FUTURO[tickerLimpio]) {
      return { ...resultado(SPOT_A_FUTURO[tickerLimpio], 'media',
        { nota: 'Yahoo no publica el spot. Se usa el futuro.' }), ...base };
    }
    return {
      ...rechazo(`"${prefijo}" es un feed de datos de TradingView, no una bolsa, y "${tickerLimpio}" no está en la tabla de índices.`),
      ...base,
    };
  }

  // Euronext genérico: ambiguo entre cuatro plazas. Se propone París y se
  // ofrecen las otras tres como alternativas para la cascada de validación.
  if (prefijo === 'EURONEXT') {
    const t = normalizarClase(ticker.toUpperCase());
    return {
      ...resultado(`${t}.PA`, 'baja', {
        nota: 'EURONEXT no dice qué plaza es. Se prueba París y se cae a Ámsterdam, Bruselas o Lisboa.',
        alternativas: [`${t}.AS`, `${t}.BR`, `${t}.LS`],
      }), ...base,
    };
  }

  if (SUFIJOS[prefijo] !== undefined || FALLBACK_ALEMANIA[prefijo]) {
    return { ...mapearAccion(prefijo, ticker), ...base };
  }

  // Prefijo desconocido: no se falla duro. Se propone el ticker pelado para
  // que el validador lo pruebe y, si no anda, lo resuelva por búsqueda (§14.6).
  return {
    ...resultado(normalizarClase(ticker.toUpperCase()), 'baja', {
      nota: `Prefijo "${prefijo}" desconocido. Se prueba el ticker pelado; si falla hay que resolverlo por búsqueda.`,
    }), ...base,
  };
}

/** Un ticker de índice bajo un prefijo de bolsa: `BCBA:IMV`, `ASX:XJO`. */
function esProbableIndice(prefijo, ticker) {
  const combinaciones = {
    BCBA: ['IMV', 'MERVAL'], BYMA: ['IMV', 'MERVAL'],
    ASX: ['XJO'], NSE: ['NIFTY'], BSE: ['SENSEX'],
    XETR: ['DAX'], LSE: ['UKX'], BME: ['IBEX35', 'IBEX'],
    BMV: ['ME'], BMFBOVESPA: ['IBOV'], TSX: ['TSX'],
    SET: ['SET'], NZX: ['NZ50G'], IDX: ['COMPOSITE'], KRX: ['KOSPI', 'KOSDAQ'],
  };
  return (combinaciones[prefijo] || []).includes(ticker);
}

/* ────────────────────── lista completa ────────────────────── */

/**
 * Parsea el `.txt` que exporta TradingView.
 * Formato: `NASDAQ:AAPL,NYSE:IBM,BCBA:GGAL`, coma como separador, aunque en la
 * práctica aparecen saltos de línea, punto y coma y encabezados de sección
 * (`###Tecnología`) que TradingView usa para agrupar.
 */
function parsearLista(texto) {
  return String(texto || '')
    .split(/[,\n\r;]+/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

/**
 * Mapea una lista entera y la separa en tres grupos, para que la UI pueda
 * mostrarle al usuario exactamente qué entró, qué hay que revisar y qué no
 * se pudo — nunca fallar en silencio (§14.6).
 */
function mapearLista(texto) {
  const entradas = parsearLista(texto);
  const listos = [], revisar = [], rechazados = [];

  for (const e of entradas) {
    const r = mapear(e);
    if (r.confianza === 'rechazado') rechazados.push(r);
    else if (r.confianza === 'alta') listos.push(r);
    else revisar.push(r);
  }

  return {
    total: entradas.length,
    listos, revisar, rechazados,
    resumen: `${listos.length} listos, ${revisar.length} a validar, ${rechazados.length} sin equivalente`,
  };
}

module.exports = {
  mapear, mapearLista, parsearLista,
  mapearCripto, mapearForex, mapearFuturo, mapearAccion,
  normalizarClase, limpiarContrato,
  SUFIJOS, INDICES, FUTUROS, SIN_EQUIVALENTE, QUOTES_CRIPTO, STABLECOINS,
};
