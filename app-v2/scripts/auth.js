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
  return getTrialStatus().status === 'expired';
}
