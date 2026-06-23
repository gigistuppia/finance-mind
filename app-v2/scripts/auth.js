const TRIAL_KEY = 'fm2_trial_start';
const PAID_KEY = 'fm2_paid';
const TRIAL_DAYS = 30;
const DAY_MS = 86_400_000;

export function getTrialStatus() {
  if (localStorage.getItem(PAID_KEY)) {
    return { status: 'paid', daysLeft: Infinity };
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

export function activatePaid(code) {
  if (!code) return false;
  localStorage.setItem(PAID_KEY, code);
  return true;
}

export function isBlocked() {
  return getTrialStatus().status === 'expired';
}
