/**
 * Vista "Informe": el producto nuevo.
 *
 * Responde "¿qué necesito saber hoy?" en vez de "¿cuánto gané?".
 *
 * §14.11 — veinte informes por día no los lee nadie. El feed prioriza: arriba
 * los activos que se movieron fuera de lo normal o tienen noticias, el resto
 * colapsado. La prioridad se calcula en el backend (`calcularPrioridad`) y es
 * determinista: el modelo no decide qué es importante.
 *
 * §14.14 — el disclaimer va VISIBLE en cada informe, no en gris al pie.
 *
 * Carga progresiva: cada activo se pide por separado y se dibuja apenas llega.
 * Con una watchlist de 15, esperar a que terminen todos daría 30 segundos de
 * pantalla vacía.
 */

import { getState } from '../state.js';
import { logoImg } from '../logos.js';

const CONCURRENCIA = 3;

let informes = new Map();   // symbol → resultado del pipeline
let cargando = new Set();
let expandidos = new Set();
let corriendo = false;

/* ────────────────────── helpers ────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const $ = (id) => document.getElementById(id);

function pct(v) {
  if (v == null) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}

function clasePnl(v) {
  return v == null ? '' : v >= 0 ? 'pnl-pos' : 'pnl-neg';
}

function claseSesgo(s) {
  return s === 'alcista' ? 'pnl-pos' : s === 'bajista' ? 'pnl-neg' : 'sesgo-neutral';
}

function fechaCorta(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

/* ────────────────────── tarjetas ────────────────────── */

function tarjetaError(r) {
  return `
    <article class="informe-card error">
      <header class="informe-head">
        <div class="informe-titulo">
          <div class="informe-simbolo mono">${esc(r.symbol)}</div>
          <div class="informe-quepaso">No se pudo analizar</div>
        </div>
      </header>
      <p class="informe-motivo-error">
        Falló en la etapa <strong>${esc(r.etapa || 'desconocida')}</strong>: ${esc(r.error || '')}
      </p>
    </article>`;
}

function bloqueIndicadores(s) {
  const filas = [
    ['RSI (14)', s.rsi14 != null ? `${s.rsi14} — ${s.lecturas.rsi}` : '—'],
    ['MACD', s.macd != null ? `${s.macd} · señal ${s.macdSignal ?? '—'}` : '—'],
    ['Medias', `20: ${s.sma20 ?? '—'} · 50: ${s.sma50 ?? '—'} · 200: ${s.sma200 ?? '—'}`],
    ['Posición', s.lecturas.posicionVsMedias],
    ['ATR (14)', s.atrPct != null ? `${s.atrPct}% del precio — un día normal se mueve menos que esto` : '—'],
    ['Volumen', s.volumenRelativo != null ? `${s.volumenRelativo}x — ${s.lecturas.volumen}` : '—'],
    ['Desde el máximo', s.drawdownDesdeMaximoPct != null ? `${s.drawdownDesdeMaximoPct}%` : '—'],
  ];
  return `<dl class="informe-indicadores">${filas.map(([k, v]) =>
    `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}</dl>`;
}

function bloqueNiveles(s) {
  const nivel = (precio, dist, toques, etiqueta) => precio == null
    ? `<div><dt>${etiqueta}</dt><dd class="informe-sin-nivel">Sin nivel significativo</dd></div>`
    : `<div><dt>${etiqueta}</dt><dd class="mono">${precio}
         <span class="informe-nivel-meta">${pct(dist)} · tocado ${toques} ${toques === 1 ? 'vez' : 'veces'}</span>
       </dd></div>`;
  return `<dl class="informe-indicadores">
    ${nivel(s.soporte, s.distanciaSoportePct, s.soporteToques, 'Soporte')}
    ${nivel(s.resistencia, s.distanciaResistenciaPct, s.resistenciaToques, 'Resistencia')}
  </dl>`;
}

function bloquePatrones(p) {
  if (!p.detectados?.length) {
    return `<p class="informe-vacio">
      Se evaluaron los ${p.evaluados.length} patrones del catálogo y no apareció ninguno.
      Eso también es información.
    </p>`;
  }
  return `<ul class="informe-patrones">
    ${p.detectados.map(d => `
      <li>
        <span class="informe-badge ${d.confiabilidad === 'media' ? 'media' : 'baja'}">${esc(d.confiabilidad)}</span>
        <div>
          <strong class="${claseSesgo(d.direccion)}">${esc(d.nombre)}</strong>
          <span class="informe-hace">hace ${d.haceDias} ${d.haceDias === 1 ? 'rueda' : 'ruedas'}</span>
          <p>${esc(d.detalle)}</p>
        </div>
      </li>`).join('')}
  </ul>`;
}

function bloqueHorizonte(h) {
  const uno = (k, etiqueta, ventana) => {
    const x = h[k];
    if (!x) return '';
    return `
      <div class="informe-plazo">
        <div class="informe-plazo-head">
          <span class="informe-plazo-nombre">${etiqueta}</span>
          <span class="informe-plazo-ventana mono">${ventana}</span>
        </div>
        <div class="informe-sesgo ${claseSesgo(x.sesgo)}">${esc(x.sesgo)}</div>
        <div class="informe-confianza">confianza ${esc(x.confianza)}</div>
        <p>${esc(x.razon)}</p>
      </div>`;
  };
  return `<div class="informe-horizonte">
    ${uno('corto_plazo', 'Corto plazo', '1–4 semanas')}
    ${uno('largo_plazo', 'Largo plazo', '6–12 meses')}
  </div>`;
}

function bloqueCausas(inf) {
  if (!inf.por_que?.length) {
    return `<p class="informe-vacio">
      Sin causas citables: no hubo noticias en las últimas 72 horas que respaldaran
      una explicación. No se inventa una.
    </p>`;
  }
  return `<ul class="informe-causas">
    ${inf.por_que.map(c => `
      <li>
        <div class="informe-causa-head">
          <strong>${esc(c.causa)}</strong>
          <span class="informe-badge peso-${esc(c.peso)}">peso ${esc(c.peso)}</span>
        </div>
        <ul class="informe-fuentes">
          ${(c.fuentes || []).map(f => `
            <li>
              <a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a>
              <span class="informe-fuente-meta">${esc(f.medio)} · hace ${f.horasAtras}h</span>
            </li>`).join('')}
        </ul>
      </li>`).join('')}
  </ul>`;
}

function tarjeta(r) {
  if (!r.ok) return tarjetaError(r);

  const s = r.snapshot;
  const inf = r.informe;
  const p = r.prioridad || { nivel: 'baja', motivos: [], requiereAtencion: false };
  const abierto = expandidos.has(r.symbol);

  return `
    <article class="informe-card prioridad-${p.nivel} ${abierto ? 'abierto' : ''}" data-symbol="${esc(r.symbol)}">
      <header class="informe-head" role="button" tabindex="0" data-toggle="${esc(r.symbol)}"
              aria-expanded="${abierto}">
        ${logoImg(r.symbol, s.quoteType, 40)}
        <div class="informe-titulo">
          <div class="informe-simbolo mono">${esc(r.symbol)}
            ${r.nombre ? `<span class="informe-nombre">${esc(r.nombre)}</span>` : ''}
          </div>
          <div class="informe-quepaso">${esc(inf?.que_paso || '')}</div>
        </div>
        <div class="informe-precio">
          <div class="mono">${s.precio} ${esc(r.moneda || '')}</div>
          <div class="mono ${clasePnl(s.variacionDiaPct)}">${pct(s.variacionDiaPct)}</div>
        </div>
        <svg class="informe-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </header>

      ${p.motivos.length ? `
        <ul class="informe-motivos">
          ${p.motivos.map(m => `<li>${esc(m)}</li>`).join('')}
        </ul>` : ''}

      <div class="informe-detalle" ${abierto ? '' : 'hidden'}>
        ${inf?.degradado ? `
          <div class="informe-degradado">
            <strong>Informe sin interpretación.</strong>
            ${esc(inf.motivoDegradacion)}.
            Los datos de abajo son correctos: lo que falta es el análisis redactado.
          </div>` : ''}

        <section><h5>Por qué</h5>${bloqueCausas(inf || {})}</section>

        <section>
          <h5>Lectura técnica</h5>
          ${inf?.lectura_tecnica ? `<p>${esc(inf.lectura_tecnica)}</p>` : ''}
          ${bloqueIndicadores(s)}
        </section>

        <section><h5>Niveles</h5>${bloqueNiveles(s)}</section>

        <section>
          <h5>Patrones <span class="informe-h5-meta">${r.patrones.detectados.length} de ${r.patrones.evaluados.length} evaluados</span></h5>
          ${bloquePatrones(r.patrones)}
        </section>

        ${inf?.horizonte ? `<section><h5>Horizonte</h5>${bloqueHorizonte(inf.horizonte)}</section>` : ''}

        ${inf?.senales_contradictorias?.length ? `
          <section>
            <h5 class="informe-h5-alerta">Señales contradictorias</h5>
            <ul class="informe-lista-simple">${inf.senales_contradictorias.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </section>` : ''}

        ${inf?.que_invalidaria_esto?.length ? `
          <section>
            <h5>Qué invalidaría esta lectura</h5>
            <ul class="informe-lista-simple">${inf.que_invalidaria_esto.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </section>` : ''}

        ${r.noticias.length ? `
          <section>
            <h5>Noticias consideradas <span class="informe-h5-meta">últimas 72 h</span></h5>
            <ul class="informe-fuentes">
              ${r.noticias.map(n => `
                <li>
                  <a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.titulo)}</a>
                  <span class="informe-fuente-meta">${esc(n.medio)} · hace ${n.horasAtras}h</span>
                </li>`).join('')}
            </ul>
          </section>` : `
          <section>
            <h5>Noticias</h5>
            <p class="informe-vacio">
              Ninguna en las últimas ${r.diagnosticoNoticias.ventanaHoras} horas.
              Se revisaron ${r.diagnosticoNoticias.totalCrudas} notas de
              ${r.diagnosticoNoticias.fuentesConsultadas.join(' y ') || 'las fuentes disponibles'}.
            </p>
          </section>`}

        ${inf?.datos_faltantes?.length ? `
          <section>
            <h5>Datos faltantes</h5>
            <ul class="informe-lista-simple informe-tenue">${inf.datos_faltantes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </section>` : ''}

        <p class="informe-disclaimer">
          Esto es información y análisis, no asesoramiento financiero. Los indicadores
          son cálculos sobre datos públicos y los patrones técnicos fallan seguido.
          Las decisiones de inversión son tuyas.
        </p>

        <div class="informe-pie mono">
          ${esc(r.fecha)} · ${s.velasUsadas} velas · ${esc(s.mercado)}
          ${r.tiempos ? ` · ${r.tiempos.total}ms` : ''}
        </div>
      </div>
    </article>`;
}

function tarjetaCargando(symbol) {
  return `
    <article class="informe-card cargando">
      <header class="informe-head">
        ${logoImg(symbol, 'EQUITY', 40)}
        <div class="informe-titulo">
          <div class="informe-simbolo mono">${esc(symbol)}</div>
          <div class="skeleton" style="height:12px;width:70%;margin-top:6px;"></div>
        </div>
        <div class="skeleton" style="height:28px;width:80px;"></div>
      </header>
    </article>`;
}

/* ────────────────────── render ────────────────────── */

export function renderInforme() {
  const cont = $('informe-feed');
  const resumen = $('informe-resumen');
  if (!cont) return;

  const { watchlist } = getState();

  if (!watchlist.length) {
    if (resumen) resumen.innerHTML = '';
    cont.innerHTML = `
      <div class="empty">
        <h4>Todavía no hay nada que analizar</h4>
        <p>Cargá tus activos y el analista los revisa todos los días.</p>
        <div class="empty-cta"><a class="btn primary" href="#/conectar">Cargar mi lista</a></div>
      </div>`;
    return;
  }

  const listos = watchlist
    .map(w => informes.get(w.symbol))
    .filter(Boolean);

  const atencion = listos.filter(r => r.ok && r.prioridad?.requiereAtencion);

  if (resumen) {
    const pendientes = watchlist.length - listos.length;
    resumen.innerHTML = listos.length === 0
      ? `<span class="informe-resumen-cargando">Analizando ${watchlist.length} activos…</span>`
      : `<strong>${atencion.length}</strong> ${atencion.length === 1 ? 'activo necesita' : 'activos necesitan'} tu atención hoy
         <span class="informe-resumen-meta">de ${listos.length} analizados${pendientes ? ` · ${pendientes} en curso` : ''}</span>`;
  }

  // Prioridad primero; a igual prioridad, el que más se movió.
  const orden = { alta: 0, media: 1, baja: 2 };
  const ordenados = [...listos].sort((a, b) => {
    const pa = orden[a.prioridad?.nivel] ?? 3;
    const pb = orden[b.prioridad?.nivel] ?? 3;
    if (pa !== pb) return pa - pb;
    return Math.abs(b.snapshot?.variacionDiaPct ?? 0) - Math.abs(a.snapshot?.variacionDiaPct ?? 0);
  });

  const enCurso = watchlist.filter(w => cargando.has(w.symbol));

  cont.innerHTML = ordenados.map(tarjeta).join('')
    + enCurso.map(w => tarjetaCargando(w.symbol)).join('');

  cont.querySelectorAll('[data-toggle]').forEach(h => {
    const alternar = () => {
      const s = h.dataset.toggle;
      if (expandidos.has(s)) expandidos.delete(s); else expandidos.add(s);
      renderInforme();
    };
    h.addEventListener('click', alternar);
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
    });
  });
}

/* ────────────────────── carga ────────────────────── */

async function pedirInforme(item) {
  const q = new URLSearchParams({ symbol: item.symbol });
  if (item.name) q.set('nombre', item.name);
  try {
    const res = await fetch(`/api/informe?${q}`);
    const data = await res.json();
    informes.set(item.symbol, data);
  } catch (e) {
    informes.set(item.symbol, {
      symbol: item.symbol, ok: false, etapa: 'red', error: e.message,
    });
  } finally {
    cargando.delete(item.symbol);
    renderInforme();
  }
}

/** Carga la watchlist entera en tandas, dibujando a medida que llegan. */
async function cargarTodos({ forzar = false } = {}) {
  if (corriendo) return;
  corriendo = true;

  const { watchlist } = getState();
  const faltan = watchlist.filter(w => forzar || !informes.has(w.symbol));
  if (forzar) informes.clear();

  faltan.forEach(w => cargando.add(w.symbol));
  renderInforme();

  try {
    for (let i = 0; i < faltan.length; i += CONCURRENCIA) {
      await Promise.all(faltan.slice(i, i + CONCURRENCIA).map(pedirInforme));
    }
  } finally {
    corriendo = false;
    renderInforme();
  }
}

export function initInforme() {
  $('informe-refrescar')?.addEventListener('click', () => cargarTodos({ forzar: true }));
}

/** El router la llama al entrar. Solo carga lo que falta. */
export function entrarInforme() {
  renderInforme();
  const { watchlist } = getState();
  if (watchlist.some(w => !informes.has(w.symbol))) cargarTodos();
}
