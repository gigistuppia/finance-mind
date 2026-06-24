import { getTrialStatus, activatePaid } from '../auth.js';
import { toast } from './toast.js';

export function renderTrialBadge() {
  const el = document.getElementById('trial-badge');
  if (!el) return;
  const { status, daysLeft } = getTrialStatus();
  if (status === 'paid') {
    el.innerHTML = '<div class="trial-badge">PRO</div><div>Acceso completo</div>';
    return;
  }
  if (status === 'expired') {
    el.innerHTML = '<div class="trial-badge danger">EXPIRADO</div><div>Activá tu plan</div>';
    return;
  }
  const cls = daysLeft < 3 ? 'danger' : daysLeft < 7 ? 'warn' : '';
  el.innerHTML = `<div class="trial-badge ${cls}">TRIAL · ${daysLeft} días</div><div>Probando Finance Mind</div>`;
}

export function checkPaywall() {
  const { status } = getTrialStatus();
  const paywall = document.getElementById('paywall');
  if (status === 'expired') {
    paywall.classList.add('open');
  } else {
    paywall.classList.remove('open');
  }
}

export function initPaywall() {
  const activateBtn = document.getElementById('paywall-activate');
  const codeInput = document.getElementById('paywall-code');
  const errorMsg = document.getElementById('paywall-error');

  activateBtn?.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (activatePaid(code)) {
      if (errorMsg) errorMsg.style.display = 'none';
      document.getElementById('paywall').classList.remove('open');
      renderTrialBadge();
      toast('Plan Pro activado!', 'success', 3500);
    } else {
      if (errorMsg) errorMsg.style.display = 'block';
      codeInput.classList.add('shake');
      setTimeout(() => codeInput.classList.remove('shake'), 500);
    }
  });

  codeInput?.addEventListener('input', () => {
    if (errorMsg) errorMsg.style.display = 'none';
  });
}
