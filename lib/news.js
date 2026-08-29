/**
 * Recolector de noticias por activo.
 *
 * LA DEFENSA CONTRA §14.4 (alucinación de causalidad) EMPIEZA ACÁ.
 * El modelo solo puede citar de lo que este módulo le entrega. Si acá entra
 * basura, el informe explica la caída de NVDA con una noticia de Novo Nordisk
 * y suena perfectamente convincente.
 *
 * Hallazgo que motivó el diseño (verificado el 29/08/2026):
 * `query1.finance.yahoo.com/v1/finance/search?q=NVDA&newsCount=20` devolvió
 * 10 notas, TODAS con NVDA en `relatedTickers`, y ninguna sobre NVDA — eran
 * sobre Novo Nordisk, Mark Cuban, SpaceX y NIO. Yahoo etiqueta cada nota con
 * media docena de tickers tangenciales. Filtrar por `relatedTickers` NO
 * alcanza: hay que exigir relevancia en el titular.
 *
 * ⚠ LICENCIA: el RSS de Google News se publica "solely for... personal,
 * non-commercial use". Es aceptable para un proyecto personal gratuito
 * (coherente con §14.15 y el plan Hobby de Vercel), pero NO para un producto
 * comercial. Si esto se monetiza, hay que reemplazar esta fuente.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const VENTANA_HORAS = 72;

/* ────────────────────── utilidades ────────────────────── */

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&')
    .trim();
}

/** Extrae el contenido de una etiqueta XML simple. */
function tag(block, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : null;
}

/** Normaliza un titular para comparar duplicados entre fuentes distintas. */
function claveTitulo(titulo) {
  return titulo
    .toLowerCase()
    .replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/, '') // saca el " - CNBC" del final
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').slice(0, 12).join(' ');
}

function dentroDeVentana(fechaMs, horas) {
  if (!fechaMs) return false;
  const edad = Date.now() - fechaMs;
  return edad >= 0 && edad <= horas * 3_600_000;
}

/* ────────────────────── ruido ────────────────────── */

/**
 * Notas que mencionan al activo pero NO explican nada de su precio.
 *
 * Detectado mirando salida real: para NVDA, 3 de los 5 primeros resultados
 * eran posts autogenerados de MarketBeat sobre declaraciones 13F ("Position
 * Raised by Shaker Investments LLC"). Un fondo que ajustó su tenencia el
 * trimestre pasado no explica la rueda de hoy, y ocupa lugar que le
 * corresponde a una noticia que sí importa.
 */
const PATRONES_RUIDO = [
  /\b(position|stake|holdings?)\s+(raised|lowered|reduced|decreased|increased|boosted|trimmed|cut|grows?)\s+by\b/i,
  /\b(shares?|stake|position)\s+(sold|bought|purchased|acquired)\s+by\b/i,
  /\b(buys|sells|acquires|purchases)\s+(new\s+)?(shares|stake|position)\b/i,
  /\bhas\s+\$[\d.,]+\s+(million|billion)\s+(stock\s+)?(holdings|position)\b/i,
  /\b13[fd]\b|\bform\s+4\b/i,
  /\b(short interest|institutional (investors?|ownership|holdings))\b/i,
  /\b(gf score|smart score|zacks rank)\b/i,
  /\b(price target|pt) (raised|lowered|set) (to|at)\b/i,
  /\bshares? (crosses?|above|below) (its )?(200|50)[- ]day\b/i,
];

function esRuido(titulo) {
  return PATRONES_RUIDO.some(re => re.test(titulo));
}

/**
 * Vocabulario que solo aplica a acciones. Una cripto no cotiza en bolsa, no
 * tiene acciones preferidas ni hace splits: si aparece esto en una nota sobre
 * BTC, la nota es sobre una empresa que tiene BTC en el balance.
 */
const VOCABULARIO_ACCIONARIO =
  /\b(stock|shares|share price|equity|preferred|reverse split|earnings call|nasdaq|nyse|ipo|treasury|balance sheet|holdings?)\b/i;

/**
 * Recopilatorio: menciona varios instrumentos, así que no explica a ninguno.
 * Google News no da `relatedTickers`, así que se detecta desde el titular —
 * tickers entre paréntesis `(NTIOF)` o con cashtag `$NVDA`.
 */
function contarTickersEnTitulo(titulo) {
  const enParentesis = titulo.match(/\(([A-Z]{2,6}(?:[.\-][A-Z]{1,3})?)\)/g) || [];
  const cashtags = titulo.match(/\$[A-Z]{2,6}\b/g) || [];
  const unicos = new Set([...enParentesis, ...cashtags].map(s => s.replace(/[()$]/g, '')));
  return unicos.size;
}

/* ────────────────────── relevancia ────────────────────── */

/**
 * Puntaje de relevancia de una nota respecto del activo.
 *
 * El umbral (>= 3) es lo que separa "esta nota es sobre NVDA" de "esta nota
 * menciona NVDA de pasada". Los recopilatorios tipo "7 acciones para comprar
 * ahora" mencionan diez tickers y no explican el precio de ninguno.
 */
function puntuarRelevancia({ titulo, tickers = [] }, { symbol, nombre }) {
  const t = titulo.toLowerCase();
  const base = symbol.replace(/[-.].*$/, '').toLowerCase(); // NVDA de NVDA, BTC de BTC-USD
  let score = 0;
  const motivos = [];

  const enTitulo = new RegExp('\\b' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  if (enTitulo.test(t)) { score += 3; motivos.push('ticker en el titular'); }

  if (nombre) {
    // "NVIDIA Corporation" → "nvidia": la primera palabra significativa.
    const corto = nombre.toLowerCase()
      .replace(/\b(inc|corp|corporation|company|co|ltd|plc|sa|s\.a\.|nv|ag|holdings?|group|the)\b\.?/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/)[0];
    if (corto && corto.length >= 3 && t.includes(corto)) {
      score += 3; motivos.push('nombre de la empresa en el titular');
    }
  }

  if (tickers.length) {
    if (tickers.length <= 3) { score += 1; motivos.push('nota enfocada'); }
    if (tickers.length >= 6) { score -= 2; motivos.push('recopilatorio de muchos tickers'); }
  }

  // Recopilatorio detectado desde el titular (funciona también para Google News,
  // que no entrega relatedTickers).
  //
  // La penalización es -4 a propósito: tiene que poder anular un match perfecto
  // de ticker + nombre (6 puntos). Si no, "Top Picks: NBC (NTIOF), Galicia
  // (GGAL), BBVA (BBAR)" entra como si explicara el precio de GGAL.
  // Preferimos perder algún repaso sectorial legítimo antes que dejar pasar una
  // nota que no explica nada: un falso positivo se convierte en causalidad
  // inventada (§14.4), un falso negativo solo es una noticia menos.
  if (contarTickersEnTitulo(titulo) >= 3) {
    score -= 4; motivos.push('recopilatorio: 3+ tickers en el titular');
  }

  // Ruido institucional: menciona el activo pero no dice nada de su precio.
  if (esRuido(titulo)) {
    score -= 5; motivos.push('ruido institucional (13F, price target, short interest)');
  }

  // Cripto: una cripto NO tiene acciones. Si el titular habla de stock, shares
  // o reverse split, es sobre una empresa tesorera que la tiene en balance
  // ("American Bitcoin Adds 500 BTC", "Strategy Stock Rises 12%"), y el precio
  // de esa empresa no explica el precio de la cripto.
  if (/-(USD|EUR|BTC)$/.test(symbol) && VOCABULARIO_ACCIONARIO.test(titulo)) {
    score -= 4; motivos.push('habla de una empresa tenedora, no de la cripto');
  }

  return { score, motivos };
}

/* ────────────────────── fuentes ────────────────────── */

/**
 * Google News RSS. Fuente primaria: es la que de verdad devuelve notas del
 * activo. Sin key. El <link> es un redirect de news.google.com que resuelve
 * al medio original; <source url> da el dominio del medio.
 */
async function googleNews(symbol, nombre, { max = 25, locale = 'en' } = {}) {
  const base = symbol.replace(/[-.=^].*$/, '');
  const es = locale === 'es';
  const palabra = es ? 'acción' : 'stock';
  const consulta = nombre ? `"${nombre}" OR "${base}" ${palabra}` : `"${base}" ${palabra}`;
  const region = es
    ? '&hl=es-419&gl=AR&ceid=AR:es-419'
    : '&hl=en-US&gl=US&ceid=US:en';
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(consulta) + region;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, max);
  return items.map(([, blk]) => {
    const crudo = tag(blk, 'title') || '';
    // Google formatea el titular como "Titular - Medio".
    const corte = crudo.lastIndexOf(' - ');
    const titulo = corte > 20 ? crudo.slice(0, corte) : crudo;
    const medio = tag(blk, 'source')
      || (corte > 20 ? crudo.slice(corte + 3) : null)
      || 'desconocido';
    const fecha = tag(blk, 'pubDate');

    return {
      titulo,
      medio,
      url: tag(blk, 'link'),
      dominio: (blk.match(/<source[^>]*url="([^"]+)"/) || [])[1] || null,
      fechaMs: fecha ? Date.parse(fecha) : null,
      fuente: 'google-news',
      tickers: [],
    };
  }).filter(n => n.titulo && n.url);
}

/**
 * Yahoo Finance search. Fuente secundaria. Sin key, pero su relación
 * nota↔ticker es floja, así que depende por completo del filtro de relevancia.
 */
async function yahooNews(symbol, { max = 20 } = {}) {
  const url = 'https://query1.finance.yahoo.com/v1/finance/search'
    + `?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=${max}`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Yahoo news HTTP ${res.status}`);
  const data = await res.json();

  return (data.news || []).map(n => ({
    titulo: n.title || '',
    medio: n.publisher || 'desconocido',
    url: n.link || null,
    dominio: null,
    fechaMs: n.providerPublishTime ? n.providerPublishTime * 1000 : null,
    fuente: 'yahoo',
    tickers: n.relatedTickers || [],
  })).filter(n => n.titulo && n.url);
}

/**
 * Finnhub. Opcional: requiere key gratuita en FINNHUB_API_KEY.
 * Sin key devuelve `{"error":"Please use an API key."}` — verificado.
 * Es la fuente con mejor relación nota↔empresa de las tres.
 */
async function finnhubNews(symbol, { apiKey, dias = 4 } = {}) {
  if (!apiKey) return [];
  // Solo tiene sentido para acciones: los sufijos de exchange no los entiende.
  if (/[-=^]/.test(symbol) || symbol.includes('.')) return [];

  const hoy = new Date();
  const desde = new Date(hoy.getTime() - dias * 86_400_000);
  const f = d => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}`
    + `&from=${f(desde)}&to=${f(hoy)}&token=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(data?.error || 'Finnhub devolvió algo inesperado');

  return data.map(n => ({
    titulo: n.headline || '',
    medio: n.source || 'desconocido',
    url: n.url || null,
    dominio: null,
    fechaMs: n.datetime ? n.datetime * 1000 : null,
    fuente: 'finnhub',
    tickers: [symbol],
    resumen: n.summary || null,
  })).filter(n => n.titulo && n.url);
}

/* ────────────────────── orquestador ────────────────────── */

/**
 * Junta las tres fuentes, filtra por ventana temporal y relevancia, deduplica
 * y ordena por relevancia y luego por fecha.
 *
 * Devuelve SIEMPRE el diagnóstico completo (`descartadas`, `errores`,
 * `fuentesConsultadas`) para que el informe pueda decir "se consultaron 3
 * fuentes y no hubo noticias en 72h" — que es un dato, no un vacío.
 */
async function collect(symbol, nombre, opciones = {}) {
  const {
    ventanaHoras = VENTANA_HORAS,
    minRelevancia = 3,
    maxResultados = 12,
    finnhubKey = process.env.FINNHUB_API_KEY || null,
  } = opciones;

  const errores = [];
  const consultadas = [];

  // Los papeles argentinos casi no tienen cobertura en inglés: GGAL.BA devolvió
  // una sola nota utilizable en la prueba real. Se agrega una consulta en
  // castellano para los símbolos de BYMA.
  const esArgentino = symbol.endsWith('.BA');

  const tareas = [
    googleNews(symbol, nombre),
    yahooNews(symbol),
    finnhubNews(symbol, { apiKey: finnhubKey }),
  ];
  const nombres = ['google-news', 'yahoo', 'finnhub'];

  if (esArgentino) {
    tareas.push(googleNews(symbol, nombre, { locale: 'es' }));
    nombres.push('google-news-es');
  }

  const resultados = await Promise.allSettled(tareas);
  let crudas = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      // Finnhub sin key devuelve [] sin ser error: no cuenta como consultada.
      if (nombres[i] !== 'finnhub' || finnhubKey) consultadas.push(nombres[i]);
      crudas = crudas.concat(r.value);
    } else {
      errores.push({ fuente: nombres[i], error: r.reason?.message || String(r.reason) });
    }
  });

  let fueraDeVentana = 0, pocoRelevantes = 0, duplicadas = 0;
  const vistas = new Map();

  for (const n of crudas) {
    if (!dentroDeVentana(n.fechaMs, ventanaHoras)) { fueraDeVentana++; continue; }

    const { score, motivos } = puntuarRelevancia(n, { symbol, nombre });
    if (score < minRelevancia) { pocoRelevantes++; continue; }

    const clave = claveTitulo(n.titulo);
    const previa = vistas.get(clave);
    if (previa) {
      duplicadas++;
      // Nos quedamos con la de mayor relevancia; a igualdad, la más reciente.
      if (score > previa.relevancia || (score === previa.relevancia && n.fechaMs > previa.fechaMs)) {
        vistas.set(clave, { ...n, relevancia: score, motivos });
      }
      continue;
    }
    vistas.set(clave, { ...n, relevancia: score, motivos });
  }

  const noticias = [...vistas.values()]
    .sort((a, b) => b.relevancia - a.relevancia || b.fechaMs - a.fechaMs)
    .slice(0, maxResultados)
    .map(n => ({
      titulo: n.titulo,
      medio: n.medio,
      url: n.url,
      fecha: new Date(n.fechaMs).toISOString(),
      horasAtras: Math.round((Date.now() - n.fechaMs) / 3_600_000),
      fuente: n.fuente,
      relevancia: n.relevancia,
      porQueEsRelevante: n.motivos,
    }));

  return {
    symbol,
    noticias,
    diagnostico: {
      fuentesConsultadas: consultadas,
      totalCrudas: crudas.length,
      descartadas: { fueraDeVentana, pocoRelevantes, duplicadas },
      ventanaHoras,
      errores,
      // Lo que el informe necesita para poder decir "no hay noticias" con
      // fundamento, en vez de inventar una causa.
      sinNoticias: noticias.length === 0,
    },
  };
}

module.exports = {
  collect, googleNews, yahooNews, finnhubNews,
  puntuarRelevancia, claveTitulo, dentroDeVentana, tag, decodeEntities,
  esRuido, contarTickersEnTitulo, PATRONES_RUIDO,
};
