import { getState, setCCL, clearAll } from '../state.js';
import { getTrialStatus, activatePaid } from '../auth.js';
import { toast } from './toast.js';
import { getDolarTypes, getSelectedTipo, setActiveDolar } from '../dolar.js';

export function initSettings() {
  const code = document.getElementById('settings-code');
  const activateBtn = document.getElementById('settings-activate');
  const exportBtn = document.getElementById('settings-export-data');
  const clearBtn = document.getElementById('settings-clear-data');
  const planStatus = document.getElementById('settings-plan-status');
  const dolarToggle = document.getElementById('settings-dolar-toggle');
  const dolarPanel = document.getElementById('settings-dolar-panel');

  if (planStatus) {
    const { status, daysLeft } = getTrialStatus();
    if (status === 'paid') planStatus.textContent = '✓ Plan Pro activo';
    else if (status === 'trial') planStatus.textContent = `Trial activo · ${daysLeft} días restantes`;
    else planStatus.textContent = 'Trial expirado';
  }

  dolarToggle?.addEventListener('click', () => {
    const open = dolarPanel.classList.toggle('open');
    dolarToggle.textContent = open ? 'Cerrar ▲' : 'Ver cotizaciones del dólar ▼';
    if (open) renderDolarPanel();
  });

  document.addEventListener('dolar-updated', () => {
    if (dolarPanel?.classList.contains('open')) renderDolarPanel();
    updateDolarSelected();
  });

  activateBtn?.addEventListener('click', async () => {
    const c = code.value.trim();
    if (!c || activateBtn.disabled) return;
    const label = activateBtn.textContent;
    activateBtn.disabled = true;
    activateBtn.textContent = 'Verificando…';
    const ok = await activatePaid(c);
    activateBtn.disabled = false;
    activateBtn.textContent = label;
    if (ok) {
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
      dolarTipo: getState().dolarTipo,
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

function updateDolarSelected() {
  const selected = getSelectedTipo();
  const label = document.getElementById('settings-dolar-selected');
  if (!label) return;
  const types = getDolarTypes();
  const found = types.find(d => d.casa === selected);
  if (found) {
    label.textContent = `${found.nombre} · $${Math.round(found.venta).toLocaleString('es-AR')}`;
  }
}

function renderDolarPanel() {
  const panel = document.getElementById('settings-dolar-panel');
  if (!panel) return;
  const types = getDolarTypes();
  const selected = getSelectedTipo();

  if (!types.length) {
    panel.innerHTML = '<p class="dolar-loading">Cargando cotizaciones…</p>';
    return;
  }

  panel.innerHTML = types.map(d => `
    <button class="dolar-type-row${d.casa === selected ? ' active' : ''}" data-casa="${d.casa}">
      <div class="dolar-type-info">
        <span class="dolar-type-name">${d.nombre}</span>
        <span class="dolar-type-prices">
          <span class="compra">C $${Math.round(d.compra).toLocaleString('es-AR')}</span>
          <span class="venta">V $${Math.round(d.venta).toLocaleString('es-AR')}</span>
        </span>
      </div>
      ${d.casa === selected ? '<span class="dolar-check">✓ Seleccionado</span>' : '<span class="dolar-usar">Usar este</span>'}
    </button>
  `).join('');

  panel.querySelectorAll('.dolar-type-row').forEach(btn => {
    btn.addEventListener('click', async () => {
      const casa = btn.dataset.casa;
      await setActiveDolar(casa);
      const found = getDolarTypes().find(d => d.casa === casa);
      if (found) toast(`Dólar ${found.nombre} seleccionado · $${Math.round(found.venta).toLocaleString('es-AR')}`, 'success');
      renderDolarPanel();
      updateDolarSelected();
    });
  });

  updateDolarSelected();
}
