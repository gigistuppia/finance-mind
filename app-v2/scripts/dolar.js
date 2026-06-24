import { setCCL } from './state.js';

const URL_CCL = 'https://dolarapi.com/v1/dolares/contadoconliqui';
const REFRESH_MS = 5 * 60_000;

let cachedValue = null;

export function getDolarCCL() { return cachedValue; }

async function fetchCCL() {
  try {
    const res = await fetch(URL_CCL, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const venta = parseFloat(data.venta);
    if (!(venta > 0)) throw new Error('invalid value');
    cachedValue = venta;
    setCCL(venta);
    renderValue(venta);
    setStale(false);
  } catch (e) {
    setStale(true);
  }
}

function renderValue(v) {
  const el = document.getElementById('dolar-value');
  if (el) el.textContent = '$' + Math.round(v).toLocaleString('es-AR');
}

function setStale(stale) {
  const btn = document.getElementById('dolar-btn');
  if (btn) btn.classList.toggle('is-stale', stale);
}

export function initDolar() {
  const btn = document.getElementById('dolar-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      location.hash = '#/ajustes';
    });
  }
  fetchCCL();
  setInterval(fetchCCL, REFRESH_MS);
}
