/**
 * INTERRUPTOR ÚNICO DE MONETIZACIÓN (CLAUDE.md §10 y §14.15).
 *
 * En `false`: no hay trial, no hay paywall, no se muestra ningún precio y
 * NO se escribe la marca de trial en el navegador del visitante.
 * En `true`: vuelve todo como estaba, sin reconstruir nada.
 *
 * PROHIBIDO borrar este módulo, `paywall.js`, `mp-webhook.js` o
 * `validate-code.js`. El flag apaga; no se borra código.
 *
 * ⚠ Poner esto en `true` exige plan Vercel Pro: Hobby prohíbe uso comercial,
 * y Vercel considera comercial el solo hecho de anunciar la venta (§14.15).
 * El mismo flag oculta la sección de precios de la landing.
 */
export const MONETIZACION_ACTIVA = false;

const TRIAL_KEY = 'fm2_trial_start';
const PAID_KEY = 'fm2_paid';
const TRIAL_DAYS = 30;
const DAY_MS = 86_400_000;

const MASTER_CODE = 'FM-GROW-MARK';
const LEGACY_CODES = new Set([
  MASTER_CODE,
  'FM-PRO1-2026',
  'FM-PRO2-2026',
  'FM-PRO3-2026',
  'FM-PRO4-2026',
  'FM-PRO5-2026',
  'FM-BETA-VIP1',
  'FM-BETA-VIP2',
  'FM-BETA-VIP3',
  'FM-BETA-VIP4',
  'FM-BETA-VIP5',
]);

const CODE_PATTERN = /^FM-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function getTrialStatus() {
  // Con la monetización apagada se corta ACÁ, antes de cualquier lectura o
  // escritura de localStorage. Es importante: más abajo esta función tiene un
  // efecto secundario (siembra `fm2_trial_start` la primera vez), y con el
  // flag en false no queremos dejar ninguna marca de trial en el navegador.
  if (!MONETIZACION_ACTIVA) {
    return { status: 'paid', daysLeft: Infinity, code: null, monetizacionApagada: true };
  }

  const paidCode = localStorage.getItem(PAID_KEY);
  if (paidCode) {
    return { status: 'paid', daysLeft: Infinity, code: paidCode };
  }

  let start = localStorage.getItem(TRIAL_KEY);
  if (!start) {
    start = String(Date.now());
    localStorage.setItem(TRIAL_KEY, start);
  }

  const elapsed = Date.now() - parseInt(start, 10);
  const daysLeft = TRIAL_DAYS - Math.floor(elapsed / DAY_MS);

  if (daysLeft > 0) return { status: 'trial', daysLeft };
  return { status: 'expired', daysLeft: 0 };
}

async function validateCodeServer(code) {
  try {
    const res = await fetch(`/api/validate-code?code=${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    const { valid } = await res.json();
    return valid === true;
  } catch {
    return false;
  }
}

export async function activatePaid(code) {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(clean)) return false;

  if (LEGACY_CODES.has(clean)) {
    localStorage.setItem(PAID_KEY, clean);
    return true;
  }

  const valid = await validateCodeServer(clean);
  if (valid) localStorage.setItem(PAID_KEY, clean);
  return valid;
}

export function isMaster() {
  return localStorage.getItem(PAID_KEY) === MASTER_CODE;
}

export function isBlocked() {
  // Redundante con getTrialStatus(), a propósito: hoy nadie la llama, y si
  // alguien la cablea más adelante sin saber del flag, no debe poder revivir
  // el bloqueo por la puerta de atrás.
  if (!MONETIZACION_ACTIVA) return false;
  return getTrialStatus().status === 'expired';
}
