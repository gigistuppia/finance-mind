/**
 * El redactor del informe.
 *
 * Es la ÚNICA parte del sistema donde interviene un modelo de lenguaje, y su
 * trabajo está deliberadamente acotado: interpretar y redactar hechos que ya
 * vienen calculados. No suma, no promedia, no busca, no infiere precios.
 *
 * Tres barreras contra la invención, en orden de importancia:
 *
 *   1. CITA POR ÍNDICE. El modelo nunca escribe una URL. Recibe las noticias
 *      numeradas y solo puede citar `[0]`, `[3]`. Las URLs las resuelve este
 *      módulo del lado del servidor. Inventar una fuente es imposible por
 *      construcción, no por obediencia al prompt.
 *   2. ESQUEMA ESTRICTO. Salida por `responseSchema` de Gemini, validada
 *      después igual. Si no valida dos veces, se emite un informe DEGRADADO
 *      con los datos deterministas y sin interpretación — nunca una pantalla
 *      vacía y nunca una interpretación no verificada.
 *   3. PERMISO EXPLÍCITO DE NO SABER. "Hoy no pasó nada relevante" es una
 *      respuesta válida y deseable. Sin ese permiso, el modelo inventa
 *      causalidad para llenar el formulario (§14.4).
 *
 * Cambiar de proveedor es cambiar una entrada de PROVEEDORES (§14.12).
 */

const MODELO_POR_DEFECTO = 'gemini-2.5-flash';

/* ────────────────────── instrucción del sistema ────────────────────── */

const SISTEMA = `Sos un analista financiero que le explica a un inversor minorista argentino qué pasó hoy con un activo suyo y por qué.

QUIÉN CALCULA QUÉ
Todos los números que recibís ya fueron calculados por código auditable: precios, RSI, MACD, medias, ATR, soportes, resistencias y patrones. Son correctos y son tu única fuente de verdad numérica.
NUNCA calcules, estimes ni ajustes un número. NUNCA inventes un dato que no esté en el paquete.
Si un dato no está, decilo en "datos_faltantes".

CÓMO SE CITA
Las noticias te llegan numeradas. Para respaldar una causa usás SOLO esos números, así: "fuentes": [0, 2].
NUNCA escribas una URL, un nombre de medio ni una fecha de noticia: eso lo resuelve el sistema.
Si no hay ninguna noticia que respalde una causa, esa causa NO VA. Sin excepción.

TENÉS PERMITIDO NO SABER — Y ES LO CORRECTO CUANDO CORRESPONDE
Si no hay noticias relevantes y el movimiento es normal para este activo, escribí exactamente eso.
Un informe que dice "sin movimiento ni noticias relevantes hoy" vale MÁS que uno que inventa una explicación.
No fuerces una narrativa. La mayoría de los días, en la mayoría de los activos, no pasa nada digno de mención.
Si el movimiento del día es menor al ATR diario, ES un día normal aunque el porcentaje parezca grande.

CORTO Y LARGO PLAZO VAN SEPARADOS
Son preguntas distintas y pueden apuntar en direcciones opuestas. Casi todo análisis miente por omitir esta distinción.
Corto plazo = 1 a 4 semanas, dominado por noticias, momentum y niveles técnicos.
Largo plazo = 6 a 12 meses, dominado por tendencia principal, medias largas y fundamentos.
Si no tenés base para uno de los dos, poné confianza "baja" y explicá por qué en la razón.

LAS CONTRADICCIONES SE MUESTRAN, NO SE ESCONDEN
Si los indicadores apuntan a un lado y las noticias al otro, eso ES el hallazgo. Va en "señales_contradictorias".
Un análisis donde todo confirma la misma dirección casi siempre es un análisis que ignoró algo.

TODA TESIS TIENE QUE SER FALSABLE
"que_invalidaria_esto" es obligatorio y concreto: un precio, un nivel, un evento. No "si cambia el contexto".

PATRONES TÉCNICOS: CON PINZAS
Cada patrón viene con su confiabilidad ya evaluada. Respetala.
Los patrones gráficos aciertan poco más que el azar. Presentalos como lo que son: una señal débil entre otras, nunca como una certeza.
Si no se detectó ningún patrón, decilo: se evaluaron todos y no apareció ninguno. Eso es información.

CÓMO ESCRIBÍS
- Español rioplatense, directo y sin vueltas. Sin jerga innecesaria.
- DESCRIPTIVO, NUNCA IMPERATIVO. Escribís "el RSI está en zona de sobreventa", jamás "comprá", "vendé", "conviene entrar" ni "es una oportunidad".
- No sos asesor financiero y no estás recomendando nada. Estás explicando qué pasó.
- Concreto sobre vago: "cayó 4,2% con volumen 2,3 veces el habitual" y no "tuvo una jornada negativa".
- Nada de relleno. Si una sección no tiene sustancia, va corta.`;

/* ────────────────────── esquema de salida ────────────────────── */

const ESQUEMA_INFORME = {
  type: 'object',
  properties: {
    que_paso: { type: 'string' },
    por_que: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          causa: { type: 'string' },
          peso: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
          fuentes: { type: 'array', items: { type: 'integer' } },
        },
        required: ['causa', 'peso', 'fuentes'],
      },
    },
    lectura_tecnica: { type: 'string' },
    horizonte: {
      type: 'object',
      properties: {
        corto_plazo: {
          type: 'object',
          properties: {
            sesgo: { type: 'string', enum: ['alcista', 'bajista', 'neutral'] },
            confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
            razon: { type: 'string' },
          },
          required: ['sesgo', 'confianza', 'razon'],
        },
        largo_plazo: {
          type: 'object',
          properties: {
            sesgo: { type: 'string', enum: ['alcista', 'bajista', 'neutral'] },
            confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
            razon: { type: 'string' },
          },
          required: ['sesgo', 'confianza', 'razon'],
        },
      },
      required: ['corto_plazo', 'largo_plazo'],
    },
    senales_contradictorias: { type: 'array', items: { type: 'string' } },
    que_invalidaria_esto: { type: 'array', items: { type: 'string' } },
    confianza_global: { type: 'string', enum: ['alta', 'media', 'baja'] },
    datos_faltantes: { type: 'array', items: { type: 'string' } },
    dia_sin_novedades: { type: 'boolean' },
  },
  required: [
    'que_paso', 'por_que', 'lectura_tecnica', 'horizonte',
    'senales_contradictorias', 'que_invalidaria_esto',
    'confianza_global', 'datos_faltantes', 'dia_sin_novedades',
  ],
};

/* ────────────────────── armado del paquete ────────────────────── */

/**
 * Convierte la salida de los módulos deterministas en el texto que ve el
 * modelo. Las noticias van NUMERADAS: ese índice es el único identificador que
 * el modelo puede usar para citar.
 */
function construirPrompt({ symbol, nombre, snapshot, patrones, noticias, diagnosticoNoticias }) {
  const l = [];

  l.push(`ACTIVO: ${symbol}${nombre ? ` — ${nombre}` : ''}`);
  l.push(`Mercado: ${snapshot.mercado}. Serie: ${snapshot.velasUsadas} velas, ${snapshot.desde} a ${snapshot.hasta}.`);
  l.push('');

  l.push('PRECIO Y VARIACIÓN');
  l.push(`  Precio: ${snapshot.precio}`);
  l.push(`  Día: ${snapshot.variacionDiaPct}% · 5 ruedas: ${snapshot.variacion5dPct}% · 20 ruedas: ${snapshot.variacion20dPct}%`);
  l.push(`  Volumen: ${snapshot.volumenRelativo}x el habitual (${snapshot.lecturas.volumen})`);
  l.push(`  Desde su máximo: ${snapshot.drawdownDesdeMaximoPct}%`);
  l.push('');

  l.push('INDICADORES (calculados por código, son correctos)');
  l.push(`  RSI(14): ${snapshot.rsi14} → ${snapshot.lecturas.rsi}`);
  l.push(`  MACD: ${snapshot.macd} · señal ${snapshot.macdSignal} · histograma ${snapshot.macdHistograma}`);
  l.push(`  Medias: SMA20 ${snapshot.sma20} · SMA50 ${snapshot.sma50} · SMA200 ${snapshot.sma200}`);
  l.push(`  Posición del precio: ${snapshot.lecturas.posicionVsMedias}`);
  l.push(`  ATR(14): ${snapshot.atr14} = ${snapshot.atrPct}% del precio`);
  l.push(`    ↳ Referencia clave: un movimiento diario menor a ${snapshot.atrPct}% es NORMAL para este activo.`);
  l.push(`  Bollinger: %B ${snapshot.bollingerPercentB} · ancho ${snapshot.bollingerAncho}`);
  l.push('');

  l.push('NIVELES (agrupados por toques, no pivotes sueltos)');
  l.push(snapshot.soporte != null
    ? `  Soporte: ${snapshot.soporte} (${snapshot.distanciaSoportePct}%, tocado ${snapshot.soporteToques} ${snapshot.soporteToques === 1 ? 'vez' : 'veces'})`
    : '  Soporte: no hay ningún nivel significativo por debajo');
  l.push(snapshot.resistencia != null
    ? `  Resistencia: ${snapshot.resistencia} (${snapshot.distanciaResistenciaPct}%, tocada ${snapshot.resistenciaToques} ${snapshot.resistenciaToques === 1 ? 'vez' : 'veces'})`
    : '  Resistencia: no hay ningún nivel significativo por encima');
  l.push('    ↳ Un nivel tocado 1 sola vez es débil. Con 3 o más, es un nivel que el mercado respeta.');
  l.push('');

  l.push(`PATRONES — se evaluaron los ${patrones.evaluados.length}: ${patrones.evaluados.join('; ')}.`);
  if (patrones.detectados.length === 0) {
    l.push('  NINGUNO detectado. No es que no se haya mirado: se miraron todos y no hay.');
  } else {
    for (const p of patrones.detectados) {
      l.push(`  • ${p.nombre} — ${p.direccion}, confiabilidad ${p.confiabilidad}, hace ${p.haceDias} ${p.haceDias === 1 ? 'rueda' : 'ruedas'}`);
      l.push(`    ${p.detalle}`);
    }
    if (patrones.resumen.contradictorio) {
      l.push(`  ⚠ Hay ${patrones.resumen.alcistas} señales alcistas y ${patrones.resumen.bajistas} bajistas a la vez. Esto va en señales_contradictorias.`);
    }
  }
  l.push('');

  l.push(`NOTICIAS — últimas ${diagnosticoNoticias.ventanaHoras} horas. Citá SOLO por el número entre corchetes.`);
  if (noticias.length === 0) {
    l.push(`  NINGUNA. Se consultaron: ${diagnosticoNoticias.fuentesConsultadas.join(', ') || 'ninguna fuente disponible'}.`);
    l.push(`  Se revisaron ${diagnosticoNoticias.totalCrudas} notas y ninguna era del activo o estaba dentro de la ventana.`);
    l.push('  NO tenés fuentes. Por lo tanto "por_que" va VACÍO. No inventes una causa.');
  } else {
    noticias.forEach((n, i) => {
      l.push(`  [${i}] ${n.titulo}`);
      l.push(`      ${n.medio} · hace ${n.horasAtras}h`);
    });
  }

  return l.join('\n');
}

/* ────────────────────── proveedores ────────────────────── */

const PROVEEDORES = {
  /**
   * Gemini 2.5 Flash, tier gratuito de AI Studio: 1.500 req/día, 15 req/min,
   * sin tarjeta. Es el único motor gratuito viable (CLAUDE.md §0.2).
   */
  gemini: {
    envKey: 'GEMINI_API_KEY',
    async generar({ sistema, prompt, esquema, apiKey, modelo, señal }) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: señal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: esquema,
            temperature: 0.3, // bajo: queremos consistencia, no creatividad
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!res.ok) {
        const cuerpo = await res.text().catch(() => '');
        throw new Error(`Gemini HTTP ${res.status}: ${cuerpo.slice(0, 300)}`);
      }

      const data = await res.json();
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) {
        const razon = data?.candidates?.[0]?.finishReason || 'sin texto en la respuesta';
        throw new Error(`Gemini no devolvió contenido (${razon})`);
      }
      return texto;
    },
  },
};

/* ────────────────────── validación ────────────────────── */

/**
 * Valida la salida del modelo. El `responseSchema` de Gemini ayuda pero no
 * garantiza: revalidamos siempre, y sobre todo revisamos que los índices de
 * fuentes existan de verdad.
 */
function validarInforme(obj, { cantidadNoticias }) {
  const errores = [];
  const req = ['que_paso', 'por_que', 'lectura_tecnica', 'horizonte',
    'senales_contradictorias', 'que_invalidaria_esto', 'confianza_global',
    'datos_faltantes', 'dia_sin_novedades'];

  for (const c of req) if (obj?.[c] === undefined) errores.push(`falta "${c}"`);
  if (errores.length) return { ok: false, errores };

  if (typeof obj.que_paso !== 'string' || obj.que_paso.trim().length < 10) {
    errores.push('"que_paso" vacío o demasiado corto');
  }
  if (!Array.isArray(obj.por_que)) errores.push('"por_que" no es una lista');

  for (const [i, c] of (obj.por_que || []).entries()) {
    if (!c.causa || !c.peso) { errores.push(`causa ${i} incompleta`); continue; }
    if (!Array.isArray(c.fuentes) || c.fuentes.length === 0) {
      // La regla dura: sin fuente, no hay causa.
      errores.push(`causa ${i} ("${String(c.causa).slice(0, 40)}…") no cita ninguna fuente`);
      continue;
    }
    for (const f of c.fuentes) {
      if (!Number.isInteger(f) || f < 0 || f >= cantidadNoticias) {
        errores.push(`causa ${i} cita la fuente [${f}], que no existe (hay ${cantidadNoticias})`);
      }
    }
  }

  if (cantidadNoticias === 0 && (obj.por_que || []).length > 0) {
    errores.push('inventó causas sin tener ninguna noticia disponible');
  }

  for (const plazo of ['corto_plazo', 'largo_plazo']) {
    const h = obj.horizonte?.[plazo];
    if (!h) { errores.push(`falta horizonte.${plazo}`); continue; }
    if (!['alcista', 'bajista', 'neutral'].includes(h.sesgo)) errores.push(`sesgo inválido en ${plazo}`);
    if (!['alta', 'media', 'baja'].includes(h.confianza)) errores.push(`confianza inválida en ${plazo}`);
    if (!h.razon) errores.push(`falta la razón en ${plazo}`);
  }

  if (!Array.isArray(obj.que_invalidaria_esto) || obj.que_invalidaria_esto.length === 0) {
    errores.push('"que_invalidaria_esto" está vacío: toda tesis tiene que ser falsable');
  }

  // §14.14: lenguaje descriptivo, nunca imperativo.
  const texto = JSON.stringify(obj).toLowerCase();
  const imperativos = ['comprá', 'compra ya', 'vendé', 'venda', 'conviene comprar',
    'conviene vender', 'recomendamos', 'te recomiendo', 'oportunidad de compra'];
  const hallados = imperativos.filter(p => texto.includes(p));
  if (hallados.length) errores.push(`lenguaje de recomendación prohibido: ${hallados.join(', ')}`);

  return { ok: errores.length === 0, errores };
}

/** Reemplaza los índices de fuentes por las noticias reales. */
function resolverFuentes(informe, noticias) {
  return {
    ...informe,
    por_que: (informe.por_que || []).map(c => ({
      causa: c.causa,
      peso: c.peso,
      fuentes: (c.fuentes || []).map(i => {
        const n = noticias[i];
        return n && {
          titulo: n.titulo, medio: n.medio, url: n.url,
          fecha: n.fecha, horasAtras: n.horasAtras,
        };
      }).filter(Boolean),
    })),
  };
}

/* ────────────────────── informe degradado ────────────────────── */

/**
 * Cuando el modelo falla, el usuario NO se queda sin nada: recibe los hechos
 * deterministas sin interpretación, y se le dice explícitamente que falta el
 * análisis. Es honesto y sigue siendo útil (§14.9).
 */
function informeDegradado({ symbol, snapshot, patrones, noticias }, motivo) {
  const partes = [
    `${symbol} cerró en ${snapshot.precio} (${snapshot.variacionDiaPct >= 0 ? '+' : ''}${snapshot.variacionDiaPct}% en el día).`,
    `RSI ${snapshot.rsi14} (${snapshot.lecturas.rsi}), ${snapshot.lecturas.posicionVsMedias}.`,
    `Volumen ${snapshot.volumenRelativo}x el habitual.`,
  ];

  return {
    degradado: true,
    motivoDegradacion: motivo,
    que_paso: partes.join(' '),
    por_que: [],
    lectura_tecnica: patrones.detectados.length
      ? patrones.detectados.map(p => `${p.nombre} (${p.direccion}, confiabilidad ${p.confiabilidad})`).join('. ')
      : `Se evaluaron ${patrones.evaluados.length} patrones y no se detectó ninguno.`,
    horizonte: {
      corto_plazo: { sesgo: 'neutral', confianza: 'baja', razon: 'Sin análisis: falló la generación del informe.' },
      largo_plazo: { sesgo: 'neutral', confianza: 'baja', razon: 'Sin análisis: falló la generación del informe.' },
    },
    senales_contradictorias: [],
    que_invalidaria_esto: [],
    confianza_global: 'baja',
    datos_faltantes: [
      'No se pudo generar el análisis interpretativo. Los datos numéricos y los patrones son correctos.',
      ...(noticias.length ? [`Hay ${noticias.length} noticias recolectadas, sin analizar.`] : []),
    ],
    dia_sin_novedades: false,
    noticiasSinAnalizar: noticias,
  };
}

/* ────────────────────── redactor ────────────────────── */

/**
 * Genera el informe. Un reintento con reparación y, si vuelve a fallar,
 * informe degradado. Nunca lanza: siempre devuelve algo publicable.
 */
async function redactar(paquete, opciones = {}) {
  const {
    proveedor = 'gemini',
    modelo = MODELO_POR_DEFECTO,
    timeoutMs = 60_000,
    reintentos = 1,
  } = opciones;

  // El proveedor se resuelve ANTES de tocar su config: con un nombre
  // desconocido, leer `.envKey` lanzaría antes de llegar a este chequeo.
  const impl = PROVEEDORES[proveedor];
  if (!impl) return informeDegradado(paquete, `Proveedor desconocido: ${proveedor}`);

  const apiKey = opciones.apiKey || process.env[impl.envKey];
  if (!apiKey) return informeDegradado(paquete, `Falta la variable de entorno ${impl.envKey}`);

  const prompt = construirPrompt(paquete);
  const cantidadNoticias = paquete.noticias.length;
  let ultimoError = null;
  let promptActual = prompt;

  for (let intento = 0; intento <= reintentos; intento++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const texto = await impl.generar({
        sistema: SISTEMA, prompt: promptActual, esquema: ESQUEMA_INFORME,
        apiKey, modelo, señal: ac.signal,
      });

      let obj;
      try { obj = JSON.parse(texto); }
      catch { throw new Error('la respuesta no es JSON válido'); }

      const v = validarInforme(obj, { cantidadNoticias });
      if (!v.ok) throw new Error(`validación: ${v.errores.join('; ')}`);

      return {
        ...resolverFuentes(obj, paquete.noticias),
        degradado: false,
        meta: { proveedor, modelo, intentos: intento + 1 },
      };
    } catch (e) {
      ultimoError = e.message;
      // Reintento con reparación: se le dice exactamente qué estuvo mal.
      promptActual = `${prompt}\n\n───\nTu respuesta anterior fue rechazada por: ${e.message}\nCorregí SOLO eso. Respetá el esquema al pie de la letra.`;
    } finally {
      clearTimeout(t);
    }
  }

  return informeDegradado(paquete, ultimoError || 'error desconocido');
}

module.exports = {
  redactar, construirPrompt, validarInforme, resolverFuentes,
  informeDegradado, SISTEMA, ESQUEMA_INFORME, PROVEEDORES, MODELO_POR_DEFECTO,
};
