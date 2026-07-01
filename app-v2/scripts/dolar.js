import { setCCL, getState, setDolarTipo } from './state.js';

const URL_ALL = 'https://dolarapi.com/v1/dolares';
const REFRESH_MS = 5 * 60_000;

let cachedTypes = [];

export function getDolarTypes() { return cachedTypes; }

export function getSelectedTipo() { return getState().dolarTipo; }

export async function setActiveDolar(casa) {
  setDolarTipo(casa);
  const found = cachedTypes.find(d => d.casa === casa);
  if (found?.venta > 0) setCCL(found.venta);
  document.dispatchEvent(new CustomEvent('dolar-updated'));
}

async function fetchAll() {
  try {
    const res = await fetch(URL_ALL, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    cachedTypes = await res.json();
    applySelected();
    document.dispatchEvent(new CustomEvent('dolar-updated'));
  } catch {}
}

function applySelected() {
  const tipo = getState().dolarTipo;
  const found = cachedTypes.find(d => d.casa === tipo);
  if (found?.venta > 0) setCCL(found.venta);
}

export function initDolar() {
  fetchAll();
  setInterval(fetchAll, REFRESH_MS);
}
