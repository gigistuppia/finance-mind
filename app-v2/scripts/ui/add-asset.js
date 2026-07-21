import { addAsset, addSell, getState } from '../state.js';
import { logoImg } from '../logos.js';
import { computePositions } from '../portfolio.js';
import { getQuotes } from '../api.js';

let pendingAsset = null;
let inputCurrency = 'USD';    // Moneda en la que el usuario ingresa/sigue el precio: 'USD' | 'ARS'
let modalMode = 'buy';        // 'buy' | 'sell'
let marketPrice = null;       // Precio actual del asset en su moneda nativa
let marketCurrency = null;    // Moneda nativa según Yahoo

// Convierte un valor entre USD y ARS usando el CCL. Devuelve null si el par no
// es soportado o falta el CCL. Para monedas nativas exóticas (EUR, GBp…) el
// toggle queda deshabilitado, así que acá solo manejamos USD↔ARS.
function convertUsdArs(value, from, to, ccl) {
  if (value == null) return null;
  if (from === to) return value;
  if (!ccl) return null;
  if (from === 'USD' && to === 'ARS') return value * ccl;
  if (from === 'ARS' && to === 'USD') return value / ccl;
  return null;
}

// ¿El activo permite el toggle USD/ARS? Solo si su moneda nativa es una de esas
// dos (cubre acciones US, crypto, ETFs, CEDEARs y acciones argentinas).
function isConvertible(currency) {
  return currency === 'USD' || currency === 'ARS';
}

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
  const currencyField = currencyToggle?.closest('.field');
  const usdBtn = currencyToggle?.querySelector('[data-cur="USD"]');
  const arsBtn = currencyToggle?.querySelector('[data-cur="ARS"]');
  const realizedPreview = document.getElementById('add-realized-preview');
  const conversionPreview = document.getElementById('add-conversion-preview');
  const marketHint = document.getElementById('add-market-hint');
  const priceWarning = document.getElementById('add-price-warning');

  currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputCurrency = btn.dataset.cur;
      currencyToggle.querySelectorAll('.ctoggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateMarketHint();
      updateConversionPreview();
      updatePriceSanityCheck();
      updateRealizedPreview();
    });
  });

  function renderSelectedAsset(asset) {
    selectedBox.innerHTML = `
      ${logoImg(asset.symbol, asset.quoteType, 36)}
      <div>
        <div style="font-weight:700;font-size:1rem;color:var(--color-text-1);">${asset.symbol}</div>
        <div style="color:var(--color-text-2);font-size:0.82rem;">${escapeHTML(asset.name || '')}</div>
      </div>
    `;
  }

  // Muestra el precio de mercado convertido a la moneda que el usuario eligió,
  // con el precio nativo como referencia secundaria.
  function updateMarketHint() {
    if (!marketHint || !pendingAsset) return;
    if (marketPrice == null || marketCurrency == null) {
      marketHint.style.display = 'none';
      return;
    }
    const { ccl } = getState();
    const nativeFmt = formatPriceLocal(marketPrice, marketCurrency);

    if (inputCurrency === marketCurrency) {
      marketHint.style.display = 'block';
      marketHint.innerHTML = `📊 Precio de mercado: <span class="conv-usd">${nativeFmt}</span>`;
      return;
    }

    const shown = convertUsdArs(marketPrice, marketCurrency, inputCurrency, ccl);
    marketHint.style.display = 'block';
    if (shown == null) {
      marketHint.innerHTML = `📊 Precio de mercado: <span class="conv-usd">${nativeFmt}</span>`;
    } else {
      marketHint.innerHTML =
        `📊 Precio de mercado: <span class="conv-usd">${formatPriceLocal(shown, inputCurrency)}</span> ` +
        `<span style="color:var(--color-text-3);">(${nativeFmt} nativo)</span>`;
    }
  }

  // Compara el precio ingresado (convertido a moneda nativa) contra el precio de
  // mercado. Detecta el caso "cargué el precio del CEDEAR sobre el ticker US" o
  // cualquier input sin sentido. Avisa, nunca bloquea.
  function updatePriceSanityCheck() {
    if (!priceWarning || !pendingAsset) return;
    const rawPrice = parseFloat(priceInput.value);
    if (!rawPrice || rawPrice <= 0 || marketPrice == null || marketPrice <= 0) {
      priceWarning.style.display = 'none';
      return;
    }
    const { ccl } = getState();
    const assetCurrency = marketCurrency || pendingAsset.currency || 'USD';

    // Convertir el input a la moneda nativa del asset
    let priceNative = rawPrice;
    if (inputCurrency !== assetCurrency) {
      const conv = convertUsdArs(rawPrice, inputCurrency, assetCurrency, ccl);
      if (conv == null) { priceWarning.style.display = 'none'; return; }
      priceNative = conv;
    }

    const ratio = priceNative / marketPrice;
    // Precio razonable dentro de 5x — sin warning
    if (ratio >= 0.2 && ratio <= 5) {
      priceWarning.style.display = 'none';
      return;
    }

    const marketFmt = formatPriceLocal(marketPrice, assetCurrency);
    const inputFmt = `${rawPrice.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${inputCurrency}`;
    const equivFmt = formatPriceLocal(priceNative, assetCurrency);

    // Divergencia extrema (>20x o <0.05x) → error rojo con posible causa
    const extreme = ratio > 20 || ratio < 0.05;
    priceWarning.className = 'price-warning' + (extreme ? '' : ' mild');
    priceWarning.style.display = 'block';

    // Caso típico: precio en ARS muy chico frente al ticker US → compró el CEDEAR
    const isCedearCandidate = extreme && inputCurrency === 'ARS' && assetCurrency === 'USD' && ratio < 0.05;
    const hint = isCedearCandidate
      ? `<div style="margin-top:6px;color:var(--color-text-2);">¿Compraste el <strong>CEDEAR</strong>? Ese cotiza distinto a la acción original. Agregá <strong>${pendingAsset.symbol}.BA</strong> desde el buscador para seguirlo en pesos con su precio real.</div>`
      : '';

    priceWarning.innerHTML = `
      <strong>⚠ Precio inusual.</strong> Estás ingresando <strong>${inputFmt}</strong> (${equivFmt} en moneda nativa), pero <strong>${pendingAsset.symbol}</strong> cotiza a <strong>${marketFmt}</strong>.
      ${hint}
    `;
  }

  function formatPriceLocal(n, currency) {
    if (n == null) return '—';
    if (currency === 'ARS') return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS`;
    const abs = Math.abs(n);
    const decimals = abs > 0 && abs < 1 ? 4 : 2;
    return `$${n.toFixed(decimals)} ${currency}`;
  }

  // Muestra cómo se convierte el precio ingresado al valor que se guarda (moneda nativa)
  function updateConversionPreview() {
    if (!conversionPreview || !pendingAsset) { conversionPreview.style.display = 'none'; return; }
    const rawPrice = parseFloat(priceInput.value);
    const assetCurrency = pendingAsset.currency || 'USD';
    const { ccl } = getState();

    if (inputCurrency === assetCurrency || !rawPrice || rawPrice <= 0) {
      conversionPreview.style.display = 'none';
      return;
    }
    const priceNative = convertUsdArs(rawPrice, inputCurrency, assetCurrency, ccl);
    if (priceNative == null) { conversionPreview.style.display = 'none'; return; }

    const cclFmt = ccl.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    const inputFmt = formatPriceLocal(rawPrice, inputCurrency);
    const nativeFmt = formatPriceLocal(priceNative, assetCurrency);
    conversionPreview.style.display = 'block';
    conversionPreview.innerHTML =
      `Al CCL $${cclFmt}: ${inputFmt} → <span class="conv-usd">${nativeFmt}</span> por unidad guardado`;
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
    if (inputCurrency !== assetCurrency) {
      const conv = convertUsdArs(price, inputCurrency, assetCurrency, ccl);
      if (conv == null) { realizedPreview.style.display = 'none'; return; }
      price = conv;
    }

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
  priceInput.addEventListener('input', () => { updateConversionPreview(); updatePriceSanityCheck(); updateRealizedPreview(); });
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

    const inputPrice = price;
    const inputCur = inputCurrency;
    let fxRateUsed = null;

    // Convertir el precio ingresado a la moneda nativa del activo (lo que se guarda)
    if (inputCurrency !== assetCurrency) {
      const priceNative = convertUsdArs(price, inputCurrency, assetCurrency, ccl);
      if (priceNative == null) {
        alert('Esperando cotización del dólar (CCL). Probá de nuevo en unos segundos.');
        return;
      }
      price = priceNative;
      fxRateUsed = ccl;
    }

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
    const convertible = isConvertible(assetCurrency);

    // Configurar el toggle: si el activo es USD/ARS mostramos ambos botones y
    // arrancamos en la moneda nativa; si es exótico (EUR, GBp…), ocultamos el
    // toggle y se ingresa directo en la moneda nativa.
    if (convertible) {
      if (currencyField) currencyField.style.display = '';
      inputCurrency = assetCurrency;
      currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cur === inputCurrency);
      });
    } else {
      if (currencyField) currencyField.style.display = 'none';
      inputCurrency = assetCurrency;
    }

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

    renderSelectedAsset(asset);
    qtyInput.value = '';
    priceInput.value = '';
    feeInput.value = '';
    dateInput.value = new Date().toISOString().slice(0, 10);
    realizedPreview.style.display = 'none';
    conversionPreview.style.display = 'none';
    if (marketHint) marketHint.style.display = 'none';
    if (priceWarning) priceWarning.style.display = 'none';
    overlay.classList.add('open');
    setTimeout(() => qtyInput.focus(), 50);

    // Cargar precio de mercado del asset (hint + sanity check)
    marketPrice = null;
    marketCurrency = null;
    const cachedQuote = getState().quotes[asset.symbol];
    if (cachedQuote?.price != null && cachedQuote.price > 0) {
      applyMarketPrice(cachedQuote.price, cachedQuote.currency || assetCurrency);
    } else {
      const symAtOpen = asset.symbol;
      getQuotes([asset.symbol]).then(quotes => {
        if (pendingAsset?.symbol !== symAtOpen) return; // el usuario ya cerró o cambió
        const q = quotes[asset.symbol];
        if (q?.price != null && q.price > 0) {
          applyMarketPrice(q.price, q.currency || assetCurrency);
        }
      }).catch(() => {});
    }
  }

  // Aplica el precio de mercado al modal y refresca los previews.
  function applyMarketPrice(price, currency) {
    marketPrice = price;
    marketCurrency = currency;
    updateMarketHint();
    updateConversionPreview();
    updatePriceSanityCheck();
    updateRealizedPreview();
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
