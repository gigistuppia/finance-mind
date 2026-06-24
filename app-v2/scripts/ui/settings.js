import { getState, setCCL, clearAll } from '../state.js';
import { getTrialStatus, activatePaid } from '../auth.js';
import { toast } from './toast.js';

export function initSettings() {
  const ccl = document.getElementById('settings-ccl');
  const code = document.getElementById('settings-code');
  const activateBtn = document.getElementById('settings-activate');
  const exportBtn = document.getElementById('settings-export-data');
  const clearBtn = document.getElementById('settings-clear-data');
  const planStatus = document.getElementById('settings-plan-status');

  if (ccl) {
    ccl.value = getState().ccl;
    ccl.addEventListener('change', () => {
      const v = parseFloat(ccl.value);
      if (v > 0) {
        setCCL(v);
        toast(`Dólar CCL actualizado a ${Math.round(v).toLocaleString('es-AR')}`, 'success');
      }
    });
  }

  if (planStatus) {
    const { status, daysLeft } = getTrialStatus();
    if (status === 'paid') planStatus.textContent = '✓ Plan Pro activo';
    else if (status === 'trial') planStatus.textContent = `Trial activo · ${daysLeft} días restantes`;
    else planStatus.textContent = 'Trial expirado';
  }

  activateBtn?.addEventListener('click', () => {
    const c = code.value.trim();
    if (!c) return;
    if (activatePaid(c)) {
      planStatus.textContent = '✓ Plan Pro activo';
      code.value = '';
      toast('Plan Pro activado. Gracias!', 'success', 4000);
    } else {
      toast('Código inválido', 'error');
    }
  });

  exportBtn?.addEventListener('click', () => {
    const data = {
      portfolio: getState().portfolio,
      watchlist: getState().watchlist,
      ccl: getState().ccl,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-mind-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup descargado', 'success');
  });

  clearBtn?.addEventListener('click', () => {
    if (confirm('¿Borrar todos los datos? Esta acción no se puede deshacer.')) {
      clearAll();
      toast('Datos borrados', 'info');
    }
  });
}
