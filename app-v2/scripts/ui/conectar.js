/**
 * Vista "Conectar": cargar la lista de activos que el bot va a analizar.
 *
 * TradingView NO tiene API para usuarios (verificado — CLAUDE.md §0.1), así
 * que la vía real es su exportación nativa: "Advanced view → Export list"
 * baja un .txt con `NASDAQ:AAPL,NYSE:IBM,BCBA:GGAL`. Arrastrar ese archivo es
 * menos fricción que copiar una API key, y el usuario no tiene que entender
 * qué es una key.
 *
 * El mapeo y la validación viven en el servidor (`/api/map` → `lib/symbols.js`)
 * para que haya UNA sola fuente de verdad de las reglas.
 *
 * §14.6: nunca fallar en silencio. Todo símbolo que no se pudo resolver se le
 * muestra al usuario con el motivo y la opción de corregirlo a mano.
 */

import { addToWatchlist, getState } from '../state.js';
import { logoImg } from '../logos.js';
import { toast } from './toast.js';

const MAX_ARCHIVO = 512 * 1024; // el .txt de TradingView pesa unos pocos KB

let ultimoResultado = null;
let cargando = false;

/* ────────────────────── helpers ────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function $(id) { return document.getElementById(id); }

function formatPrecio(v, moneda) {
  if (v == null) return '—';
  const d = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 1 ? 2 : 6;
  return `${v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })}${moneda ? ' ' + moneda : ''}`;
}

/* ────────────────────── llamada al servidor ────────────────────── */

async function mapear(texto, { validar = true } = {}) {
  const res = await fetch('/api/map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, validar }),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ────────────────────── render ────────────────────── */

function filaListo(item) {
  const yaEsta = getState().watchlist.some(w => w.symbol === item.symbol);
  return `
    <label class="conectar-fila ${yaEsta ? 'ya-esta' : ''}">
      <input type="checkbox" class="conectar-check" value="${esc(item.symbol)}"
             ${yaEsta ? 'disabled' : 'checked'}
             data-nombre="${esc(item.nombre || item.symbol)}" />
      ${logoImg(item.symbol, item.quoteType, 28)}
      <div class="conectar-fila-info">
        <div class="conectar-simbolo">${esc(item.symbol)}</div>
        <div class="conectar-origen mono">${esc(item.entrada)}</div>
      </div>
      <div class="conectar-precio mono">${formatPrecio(item.ultimoCierre, item.moneda)}</div>
      ${yaEsta ? '<span class="conectar-tag">ya está</span>' : ''}
      ${item.corregidoDesde
        ? `<span class="conectar-tag warn" title="Se propuso ${esc(item.corregidoDesde)} y no existía; se resolvió por alternativa">corregido</span>`
        : ''}
    </label>`;
}

function filaProblema(item) {
  return `
    <div class="conectar-fila problema">
      <div class="conectar-fila-info">
        <div class="conectar-simbolo mono">${esc(item.entrada || item.symbol)}</div>
        <div class="conectar-motivo">${esc(item.motivo || item.nota || 'No se pudo resolver.')}</div>
      </div>
      <input type="text" class="conectar-manual" placeholder="Símbolo de Yahoo"
             value="${esc(item.symbol || '')}" data-entrada="${esc(item.entrada || '')}" />
      <button class="btn ghost conectar-probar" data-entrada="${esc(item.entrada || '')}">Probar</button>
    </div>`;
}

function render() {
  const cont = $('conectar-resultado');
  if (!cont) return;

  if (cargando) {
    cont.innerHTML = `
      <div class="conectar-cargando">
        <div class="sparkle" aria-hidden="true"></div>
        <p>Mapeando y validando contra Yahoo…</p>
        <div class="skeleton" style="height:14px;width:60%;margin:8px auto;"></div>
        <div class="skeleton" style="height:14px;width:40%;margin:8px auto;"></div>
      </div>`;
    return;
  }

  if (!ultimoResultado) { cont.innerHTML = ''; return; }

  const r = ultimoResultado;
  const listos = r.listos || [];
  const problemas = [...(r.rechazados || []), ...(r.revisar || [])];
  const nuevos = listos.filter(l => !getState().watchlist.some(w => w.symbol === l.symbol));

  cont.innerHTML = `
    <div class="conectar-resumen">
      <strong>${r.total}</strong> símbolos leídos ·
      <span class="pnl-pos">${listos.length} válidos</span>
      ${problemas.length ? ` · <span class="pnl-neg">${problemas.length} con problemas</span>` : ''}
      ${r.corregidos ? ` · ${r.corregidos} corregidos automáticamente` : ''}
    </div>

    ${listos.length ? `
      <section class="conectar-grupo">
        <header class="conectar-grupo-head">
          <h4>Listos para agregar</h4>
          <button class="btn ghost" id="conectar-toggle-todos">Marcar / desmarcar todos</button>
        </header>
        <div class="conectar-lista">${listos.map(filaListo).join('')}</div>
      </section>` : ''}

    ${problemas.length ? `
      <section class="conectar-grupo">
        <header class="conectar-grupo-head">
          <h4>Necesitan tu ayuda</h4>
        </header>
        <p class="conectar-ayuda">
          Estos no se pudieron resolver solos. Podés escribir el símbolo de Yahoo a mano
          y probarlo, o dejarlos afuera.
        </p>
        <div class="conectar-lista">${problemas.map(filaProblema).join('')}</div>
      </section>` : ''}

    ${nuevos.length ? `
      <div class="conectar-acciones">
        <button class="btn primary" id="conectar-agregar">
          Agregar <span id="conectar-contador">${nuevos.length}</span> a mi watchlist
        </button>
      </div>` : `<div class="conectar-acciones"><p class="conectar-ayuda">No hay activos nuevos para agregar.</p></div>`}
  `;

  cablearResultado();
}

function actualizarContador() {
  const c = $('conectar-contador');
  if (!c) return;
  c.textContent = document.querySelectorAll('.conectar-check:checked:not(:disabled)').length;
}

/* ────────────────────── acciones ────────────────────── */

function cablearResultado() {
  $('conectar-toggle-todos')?.addEventListener('click', () => {
    const checks = [...document.querySelectorAll('.conectar-check:not(:disabled)')];
    const todosMarcados = checks.every(c => c.checked);
    checks.forEach(c => { c.checked = !todosMarcados; });
    actualizarContador();
  });

  document.querySelectorAll('.conectar-check').forEach(c =>
    c.addEventListener('change', actualizarContador));

  // Corrección manual de un símbolo que no resolvió.
  document.querySelectorAll('.conectar-probar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fila = btn.closest('.conectar-fila');
      const input = fila.querySelector('.conectar-manual');
      const valor = input.value.trim();
      if (!valor) return;

      btn.disabled = true;
      const etiqueta = btn.textContent;
      btn.textContent = 'Probando…';
      try {
        const r = await mapear(valor, { validar: true });
        const ok = (r.listos || [])[0];
        if (ok) {
          // Se promueve al grupo de válidos y desaparece de los problemas.
          ultimoResultado.listos = [...(ultimoResultado.listos || []), ok];
          const quitar = (lista) => (lista || []).filter(x =>
            (x.entrada || x.symbol) !== btn.dataset.entrada);
          ultimoResultado.rechazados = quitar(ultimoResultado.rechazados);
          ultimoResultado.revisar = quitar(ultimoResultado.revisar);
          toast(`${ok.symbol} validado`, 'success');
          render();
        } else {
          toast(`Yahoo no reconoce "${valor}"`, 'error');
        }
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = etiqueta;
      }
    });
  });

  $('conectar-agregar')?.addEventListener('click', () => {
    const marcados = [...document.querySelectorAll('.conectar-check:checked:not(:disabled)')];
    if (!marcados.length) { toast('No marcaste ningún activo', 'error'); return; }

    for (const c of marcados) {
      const item = (ultimoResultado.listos || []).find(l => l.symbol === c.value);
      addToWatchlist({
        symbol: c.value,
        name: c.dataset.nombre || c.value,
        quoteType: item?.quoteType || 'EQUITY',
        currency: item?.moneda || null,
      });
    }
    toast(`${marcados.length} ${marcados.length === 1 ? 'activo agregado' : 'activos agregados'}`, 'success', 3500);
    render();
  });
}

async function procesar(texto) {
  if (!texto.trim()) { toast('No hay nada que procesar', 'error'); return; }
  cargando = true;
  render();
  try {
    ultimoResultado = await mapear(texto, { validar: true });
  } catch (e) {
    ultimoResultado = null;
    toast(e.message, 'error', 5000);
  } finally {
    cargando = false;
    render();
  }
}

/* ────────────────────── init ────────────────────── */

export function initConectar() {
  const zona = $('conectar-dropzone');
  const archivo = $('conectar-file');
  const textarea = $('conectar-texto');
  const btnProcesar = $('conectar-procesar');

  if (!zona) return;

  const leerArchivo = (file) => {
    if (!file) return;
    if (file.size > MAX_ARCHIVO) {
      toast('El archivo es demasiado grande. El .txt de TradingView pesa pocos KB.', 'error', 5000);
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      textarea.value = String(lector.result || '');
      procesar(textarea.value);
    };
    lector.onerror = () => toast('No se pudo leer el archivo', 'error');
    lector.readAsText(file);
  };

  zona.addEventListener('click', () => archivo.click());
  zona.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); archivo.click(); }
  });
  archivo.addEventListener('change', () => leerArchivo(archivo.files[0]));

  ['dragenter', 'dragover'].forEach(ev =>
    zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('activa'); }));
  ['dragleave', 'drop'].forEach(ev =>
    zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('activa'); }));
  zona.addEventListener('drop', (e) => leerArchivo(e.dataTransfer?.files?.[0]));

  btnProcesar?.addEventListener('click', () => procesar(textarea.value));
  textarea?.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') procesar(textarea.value);
  });
}

/** El router la llama al entrar a la vista. */
export function renderConectar() {
  if (ultimoResultado) render();
}
