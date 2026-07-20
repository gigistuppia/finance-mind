import { addAsset, addSell, getState } from '../state.js';
import { logoImg } from '../logos.js';
import { computePositions } from '../portfolio.js';

let pendingAsset = null;
let inputCurrency = 'USD';
let modalMode = 'buy'; // 'buy' | 'sell'

export function initAddAsset({ onAdd }) {
  const overlay = document.getElementById('add-asset-modal');
  const titleEl = overlay.querySelector('h3');
  const selectedBox = document.getElementById('selected-asset');
  const qtyInput = document.getElementById('add-qty');
  const priceInput = document.getElementById('add-price');
  const feeInput = document.getElementById('add-fee');
  const feeLabelEl = document.getElementById('add-fee-label');
  const dateInput = document.getElementById('add-date');
  const cancelBtn = document.getElementById('add-cancel');
  const confirmBtn = document.getElementById('add-confirm');
  const currencyToggle = document.getElementById('add-currency-toggle');
  const realizedPreview = document.getElementById('add-realized-preview');
  const conversionPreview = document.getElementById('add-conversion-preview');

  currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputCurrency = btn.dataset.cur;
      currencyToggle.querySelectorAll('.ctoggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateConversionPreview();
      updateRealizedPreview();
    });
  });

  // Muestra al usuario cómo se convierte su precio antes de confirmar
  function updateConversionPreview() {
    if (!conversionPreview || !pendingAsset) { conversionPreview.style.display = 'none'; return; }
    const rawPrice = parseFloat(priceInput.value);
    const assetCurrency = pendingAsset.currency || 'USD';
    const { ccl } = getState();

    const needsConversion =
      (inputCurrency === 'ARS' && assetCurrency !== 'ARS') ||
      (inputCurrency === 'USD' && assetCurrency === 'ARS');

    if (!needsConversion || !rawPrice || rawPrice <= 0 || ccl == null) {
      conversionPreview.style.display = 'none';
      return;
    }

    const cclFmt = ccl.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    if (inputCurrency === 'ARS') {
      const usdEquiv = rawPrice / ccl;
      const usdFmt = usdEquiv < 0.01
        ? usdEquiv.toFixed(6)
        : usdEquiv < 1
          ? usdEquiv.toFixed(4)
          : usdEquiv.toFixed(2);
      const arsFmt = rawPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 });
      conversionPreview.style.display = 'block';
      conversionPreview.innerHTML =
        `Al CCL $${cclFmt}: $${arsFmt} ARS → <span class="conv-usd">$${usdFmt} ${assetCurrency}</span> por acción guardado`;
    } else {
      const arsEquiv = rawPrice * ccl;
      const arsFmt = arsEquiv.toLocaleString('es-AR', { maximumFractionDigits: 0 });
      conversionPreview.style.display = 'block';
      conversionPreview.innerHTML =
        `Al CCL $${cclFmt}: $${rawPrice} USD → <span class="conv-usd">$${arsFmt} ARS</span> por acción guardado`;
    }
  }

  // Actualiza el preview de P&L realizado en modo venta
  function updateRealizedPreview() {
    if (modalMode !== 'sell' || !pendingAsset) { realizedPreview.style.display = 'none'; return; }
    const qty = parseFloat(qtyInput.value);
    let price = parseFloat(priceInput.value);
    const fee = parseFloat(feeInput.value) || 0;
    if (!qty || !price || qty <= 0 || price <= 0) { realizedPreview.style.display = 'none'; return; }

    const { ccl } = getState();
    const assetCurrency = pendingAsset.currency || 'USD';
    if (inputCurrency === 'ARS' && assetCurrency !== 'ARS' && ccl) price = price / ccl;
    else if (inputCurrency === 'USD' && assetCurrency === 'ARS' && ccl) price = price * ccl;

    const positions = computePositions(getState().transactions);
    const pos = positions.get(pendingAsset.symbol);
    if (!pos || pos.avgPrice === 0) { realizedPreview.style.display = 'none'; return; }

    const pnl = qty * (price - pos.avgPrice) - fee;
    const pct = pos.avgPrice > 0 ? ((price - pos.avgPrice) / pos.avgPrice) * 100 : 0;
    const sign = pnl >= 0 ? '+' : '';
    const cls = pnl >= 0 ? 'pnl-pos' : 'pnl-neg';
    realizedPreview.style.display = 'block';
    realizedPreview.innerHTML = `
      <span style="color:var(--color-text-2);font-size:0.8rem;">P&L realizado estimado:</span>
      <span class="${cls}" style="font-weight:700;margin-left:8px;">${sign}${pct.toFixed(2)}%</span>
      <span style="color:var(--color-text-3);font-size:0.78rem;margin-left:6px;">(${sign}${price.toFixed(2)} ${assetCurrency})</span>
    `;
  }

  qtyInput.addEventListener('input', updateRealizedPreview);
  priceInput.addEventListener('input', () => { updateConversionPreview(); updateRealizedPreview(); });
  feeInput.addEventListener('input', updateRealizedPreview);

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener('click', () => {
    if (!pendingAsset) return;
    const qty = parseFloat(qtyInput.value);
    let price = parseFloat(priceInput.value);
    const fee = parseFloat(feeInput.value) || 0;
    if (!qty || !price || qty <= 0 || price <= 0) return;

    const assetCurrency = pendingAsset.currency || 'USD';
    const { ccl } = getState();

    // Bloquear si se necesita conversión pero no hay CCL real
    const needsConversion =
      (inputCurrency === 'ARS' && assetCurrency !== 'ARS') ||
      (inputCurrency === 'USD' && assetCurrency === 'ARS');
    if (needsConversion && ccl == null) {
      alert('Esperando cotización del dólar. Intentá en unos segundos.');
      return;
    }

    const fxRateUsed = needsConversion ? ccl : null;
    const inputPrice = price;
    const inputCur = inputCurrency;

    // Convertir al precio en moneda nativa del activo
    if (inputCurrency === 'ARS' && assetCurrency !== 'ARS') price = price / ccl;
    else if (inputCurrency === 'USD' && assetCurrency === 'ARS') price = price * ccl;

    if (modalMode === 'buy') {
      addAsset({
        symbol: pendingAsset.symbol,
        name: pendingAsset.name,
        quoteType: pendingAsset.quoteType,
        exchange: pendingAsset.exchange,
        currency: assetCurrency,
        quantity: qty,
        avgPrice: price,
        fee,
        date: dateInput.value,
        inputPrice,
        inputCurrency: inputCur,
        fxRateUsed,
      });
    } else {
      // Validar que no se venda más de lo que se tiene
      const positions = computePositions(getState().transactions);
      const pos = positions.get(pendingAsset.symbol);
      if (!pos || qty > pos.quantity) {
        alert(`Cantidad máxima a vender: ${pos?.quantity ?? 0}`);
        return;
      }
      addSell({
        symbol: pendingAsset.symbol,
        name: pendingAsset.name,
        quoteType: pendingAsset.quoteType,
        exchange: pendingAsset.exchange,
        currency: assetCurrency,
        quantity: qty,
        price,
        fee,
        date: dateInput.value,
        inputPrice,
        inputCurrency: inputCur,
        fxRateUsed,
      });
    }

    close();
    onAdd?.(pendingAsset);
  });

  function close() {
    overlay.classList.remove('open');
    pendingAsset = null;
    modalMode = 'buy';
    realizedPreview.style.display = 'none';
  }

  function openModal(asset, mode = 'buy') {
    pendingAsset = asset;
    modalMode = mode;

    const assetCurrency = asset.currency || 'USD';
    inputCurrency = assetCurrency === 'ARS' ? 'ARS' : 'USD';
    currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cur === inputCurrency);
    });

    titleEl.textContent = mode === 'sell' ? `Vender ${asset.symbol}` : 'Agregar al portfolio';
    confirmBtn.textContent = mode === 'sell' ? 'Vender' : 'Agregar';
    priceInput.previousElementSibling.textContent = mode === 'sell' ? 'Precio de venta' : 'Precio de compra';
    feeLabelEl.textContent = mode === 'sell' ? 'Comisión de venta (opcional)' : 'Comisión (opcional)';

    // En venta, mostrar máximo vendible
    if (mode === 'sell') {
      const positions = computePositions(getState().transactions);
      const pos = positions.get(asset.symbol);
      const maxQty = pos?.quantity ?? 0;
      qtyInput.max = maxQty;
      qtyInput.placeholder = `Máx. ${maxQty}`;
    } else {
      qtyInput.removeAttribute('max');
      qtyInput.placeholder = '0';
    }

    selectedBox.innerHTML = `
      ${logoImg(asset.symbol, asset.quoteType, 36)}
      <div>
        <div style="font-weight:700;font-size:1rem;color:var(--color-text-1);">${asset.symbol}</div>
        <div style="color:var(--color-text-2);font-size:0.82rem;">${escapeHTML(asset.name || '')}</div>
      </div>
    `;
    qtyInput.value = '';
    priceInput.value = '';
    feeInput.value = '';
    dateInput.value = new Date().toISOString().slice(0, 10);
    realizedPreview.style.display = 'none';
    conversionPreview.style.display = 'none';
    overlay.classList.add('open');
    setTimeout(() => qtyInput.focus(), 50);
  }

  return {
    open: (asset) => openModal(asset, 'buy'),
    openSell: (asset) => openModal(asset, 'sell'),
  };
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
