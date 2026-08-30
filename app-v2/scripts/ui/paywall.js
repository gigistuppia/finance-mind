import { getTrialStatus, activatePaid, MONETIZACION_ACTIVA } from '../auth.js';
import { toast } from './toast.js';

export function renderTrialBadge() {
  const el = document.getElementById('trial-badge');
  if (!el) return;

  // Con la monetización apagada el badge no se rellena: se saca del DOM.
  // Ocultarlo por CSS no alcanza — el HTML trae "TRIAL · 30 días" escrito a
  // mano, y se ve hasta que este código corre.
  if (!MONETIZACION_ACTIVA) {
    el.remove();
    return;
  }
  el.hidden = false; // el HTML lo trae oculto para que no parpadee

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
  const paywall = document.getElementById('paywall');
  if (!paywall) return;

  // Se saca del DOM entero: el modal contiene el precio y un enlace real de
  // checkout de Mercado Pago. Ocultarlo por CSS lo dejaría visible para
  // cualquiera que abra el inspector o mire el HTML fuente.
  if (!MONETIZACION_ACTIVA) {
    paywall.remove();
    return;
  }

  const { status } = getTrialStatus();
  if (status === 'expired') {
    paywall.classList.add('open');
  } else {
    paywall.classList.remove('open');
  }
}

export function initPaywall() {
  if (!MONETIZACION_ACTIVA) return;

  const activateBtn = document.getElementById('paywall-activate');
  const codeInput = document.getElementById('paywall-code');
  const errorMsg = document.getElementById('paywall-error');

  activateBtn?.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code || activateBtn.disabled) return;
    const label = activateBtn.textContent;
    activateBtn.disabled = true;
    activateBtn.textContent = 'Verificando…';
    const ok = await activatePaid(code);
    activateBtn.disabled = false;
    activateBtn.textContent = label;
    if (ok) {
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
