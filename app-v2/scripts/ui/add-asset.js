import { addAsset, getState } from '../state.js';
import { logoImg } from '../logos.js';

let pendingAsset = null;
let inputCurrency = 'USD';

export function initAddAsset({ onAdd }) {
  const overlay = document.getElementById('add-asset-modal');
  const selectedBox = document.getElementById('selected-asset');
  const qtyInput = document.getElementById('add-qty');
  const priceInput = document.getElementById('add-price');
  const dateInput = document.getElementById('add-date');
  const cancelBtn = document.getElementById('add-cancel');
  const confirmBtn = document.getElementById('add-confirm');
  const currencyToggle = document.getElementById('add-currency-toggle');

  currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputCurrency = btn.dataset.cur;
      currencyToggle.querySelectorAll('.ctoggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', () => {
    if (!pendingAsset) return;
    const qty = parseFloat(qtyInput.value);
    let price = parseFloat(priceInput.value);
    if (!qty || !price || qty <= 0 || price <= 0) return;

    const assetCurrency = pendingAsset.currency || 'USD';
    const { ccl } = getState();

    // Convertir al precio en la moneda nativa del activo
    if (inputCurrency === 'ARS' && assetCurrency !== 'ARS') {
      price = price / ccl;
    } else if (inputCurrency === 'USD' && assetCurrency === 'ARS') {
      price = price * ccl;
    }

    addAsset({
      symbol: pendingAsset.symbol,
      name: pendingAsset.name,
      quoteType: pendingAsset.quoteType,
      exchange: pendingAsset.exchange,
      currency: assetCurrency,
      quantity: qty,
      avgPrice: price,
      date: dateInput.value,
    });

    close();
    onAdd?.(pendingAsset);
  });

  function close() {
    overlay.classList.remove('open');
    pendingAsset = null;
  }

  return {
    open(asset) {
      pendingAsset = asset;

      // Auto-seleccionamos la moneda del activo por defecto
      const assetCurrency = asset.currency || 'USD';
      inputCurrency = assetCurrency === 'ARS' ? 'ARS' : 'USD';
      currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cur === inputCurrency);
      });

      selectedBox.innerHTML = `
        ${logoImg(asset.symbol, asset.quoteType, 36)}
        <div>
          <div style="font-weight:700;font-size:1rem;color:var(--color-text-1);">${asset.symbol}</div>
          <div style="color:var(--color-text-2);font-size:0.82rem;">${escapeHTML(asset.name || '')}</div>
        </div>
      `;
      qtyInput.value = '';
      priceInput.value = '';
      dateInput.value = new Date().toISOString().slice(0, 10);
      overlay.classList.add('open');
      setTimeout(() => qtyInput.focus(), 50);
    }
  };
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
