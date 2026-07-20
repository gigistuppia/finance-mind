import { addAsset, addSell, getState } from '../state.js';
import { logoImg } from '../logos.js';
import { computePositions } from '../portfolio.js';
import { getQuotes } from '../api.js';

let pendingAsset = null;
let originalAsset = null;    // Asset original elegido en el buscador (para volver desde CEDEAR)
let cedearCache = null;      // Asset CEDEAR .BA cacheado para el original actual (o 'none' si no existe)
let inputCurrency = 'USD';
let modalMode = 'buy'; // 'buy' | 'sell'
let marketPrice = null;      // Precio actual del asset en su moneda nativa
let marketCurrency = null;   // Moneda nativa según Yahoo

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
  const marketHint = document.getElementById('add-market-hint');
  const priceWarning = document.getElementById('add-price-warning');

  currencyToggle?.querySelectorAll('.ctoggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      inputCurrency = btn.dataset.cur;
      currencyToggle.querySelectorAll('.ctoggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await syncAssetToCurrency();
      updateConversionPreview();
      updatePriceSanityCheck();
      updateRealizedPreview();
    });
  });

  // Si el user elige "Pesos ARS" y el asset original NO es ARS, cambia al CEDEAR (.BA)
  // Si el user vuelve a "Cotización nativa", restaura el original.
  async function syncAssetToCurrency() {
    if (!originalAsset) return;
    const originalIsARS = (originalAsset.currency || 'USD') === 'ARS';

    if (inputCurrency === 'USD' || originalIsARS) {
      // Restaurar al original (o si el original ya es ARS no hay CEDEAR alternativo)
      if (pendingAsset.symbol !== originalAsset.symbol) {
        pendingAsset = originalAsset;
        renderSelectedAsset(pendingAsset);
      }
      const cachedQuote = getState().quotes[pendingAsset.symbol];
      if (cachedQuote?.price != null && cachedQuote.price > 0) {
        marketPrice = cachedQuote.price;
        marketCurrency = cachedQuote.currency || pendingAsset.currency || 'USD';
      } else {
        marketPrice = null;
        marketCurrency = pendingAsset.currency || 'USD';
      }
      updateMarketHint();
      return;
    }

    // inputCurrency === 'ARS' y original no es ARS → buscar CEDEAR
    if (cedearCache === 'none') {
      showNoCedearNotice();
      return;
    }
    if (cedearCache && cedearCache.symbol) {
      applyCedear(cedearCache);
      return;
    }

    // Fetch fresh: probar {symbol}.BA en Yahoo
    const candidate = originalAsset.symbol + '.BA';
    marketHint.style.display = 'block';
    marketHint.innerHTML = `Buscando CEDEAR de ${originalAsset.symbol}…`;
    try {
      const quotes = await getQuotes([candidate]);
      const q = quotes[candidate];
      if (q?.price != null && q.price > 0 && (q.currency || '').toUpperCase() === 'ARS') {
        cedearCache = {
          symbol: candidate,
          name: q.name || `${originalAsset.name} (CEDEAR)`,
          quoteType: q.quoteType || 'EQUITY',
          exchange: q.exchange || 'BUE',
          currency: 'ARS',
          _price: q.price,
        };
        applyCedear(cedearCache);
      } else {
        cedearCache = 'none';
        showNoCedearNotice();
      }
    } catch {
      cedearCache = 'none';
      showNoCedearNotice();
    }
  }

  function applyCedear(cedear) {
    pendingAsset = {
      symbol: cedear.symbol, name: cedear.name, quoteType: cedear.quoteType,
      exchange: cedear.exchange, currency: 'ARS',
    };
    renderSelectedAsset(pendingAsset);
    marketPrice = cedear._price;
    marketCurrency = 'ARS';
    updateMarketHint();
  }

  function showNoCedearNotice() {
    marketHint.style.display = 'block';
    marketHint.innerHTML = `⚠ <span style="color:var(--color-yellow);">${originalAsset.symbol} no tiene CEDEAR (.BA) en Yahoo Finance.</span> Volvé a "Cotización nativa" para agregar la acción original.`;
    marketPrice = null;
    marketCurrency = null;
  }

  function renderSelectedAsset(asset) {
    selectedBox.innerHTML = `
      ${logoImg(asset.symbol, asset.quoteType, 36)}
      <div>
        <div style="font-weight:700;font-size:1rem;color:var(--color-text-1);">${asset.symbol}</div>
        <div style="color:var(--color-text-2);font-size:0.82rem;">${escapeHTML(asset.name || '')}</div>
      </div>
    `;
  }

  // Muestra el precio actual de mercado del activo como referencia
  function updateMarketHint() {
    if (!marketHint || !pendingAsset) return;
    if (marketPrice == null || marketCurrency == null) {
      marketHint.style.display = 'none';
      return;
    }
    const { ccl } = getState();
    const priceFmt = formatPriceLocal(marketPrice, marketCurrency);
    let equiv = '';
    if (marketCurrency !== 'ARS' && ccl != null) {
      const ars = marketPrice * ccl;
      equiv = ` <span style="color:var(--color-text-3);">≈ $${ars.toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS</span>`;
    } else if (marketCurrency === 'ARS' && ccl != null) {
      const usd = marketPrice / ccl;
      equiv = ` <span style="color:var(--color-text-3);">≈ $${usd.toFixed(2)} USD</span>`;
    }
    marketHint.style.display = 'block';
    marketHint.innerHTML = `📊 Precio actual de mercado: <span class="conv-usd">${priceFmt}</span>${equiv}`;
  }

  // Compara el precio ingresado (convertido a moneda nativa) contra el precio de mercado.
  // Detecta el caso "compré CEDEAR pero elegí ticker US en USD" o inputs sin sentido.
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
    if (inputCurrency === 'ARS' && assetCurrency !== 'ARS') {
      if (ccl == null) { priceWarning.style.display = 'none'; return; }
      priceNative = rawPrice / ccl;
    } else if (inputCurrency === 'USD' && assetCurrency === 'ARS') {
      if (ccl == null) { priceWarning.style.display = 'none'; return; }
      priceNative = rawPrice * ccl;
    }

    const ratio = priceNative / marketPrice;
    // Precio 100% razonable dentro de 5x — sin warning
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

    const isCedearCandidate = extreme && inputCurrency === 'ARS' && assetCurrency !== 'ARS';
    const hint = isCedearCandidate
      ? `<div style="margin-top:6px;color:var(--color-text-2);">Si querés registrar la versión argentina (CEDEAR), buscá <strong>${pendingAsset.symbol}.BA</strong>.</div>`
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

    // Si el user eligió ARS pero pendingAsset sigue no-ARS, es porque no hay CEDEAR (.BA).
    // Bloqueamos para no caer al fallback de conversión CCL (que causaba el bug de precios inconsistentes).
    if (inputCurrency === 'ARS' && assetCurrency !== 'ARS') {
      alert(`${pendingAsset.symbol} no tiene CEDEAR argentino disponible. Cambiá a "Cotización nativa" para agregar la acción original.`);
      return;
    }

    // Bloquear si se necesita conversión pero no hay CCL real
    const needsConversion =
      (inputCurrency === 'USD' && assetCurrency === 'ARS');
    if (needsConversion && ccl == null) {
      alert('Esperando cotización del dólar. Intentá en unos segundos.');
      return;
    }

    const fxRateUsed = needsConversion ? ccl : null;
    const inputPrice = price;
    const inputCur = inputCurrency;

    // Convertir al precio en moneda nativa del activo (solo para el caso USD→ARS restante)
    if (inputCurrency === 'USD' && assetCurrency === 'ARS') price = price * ccl;

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
    originalAsset = null;
    cedearCache = null;
    modalMode = 'buy';
    realizedPreview.style.display = 'none';
  }

  function openModal(asset, mode = 'buy') {
    pendingAsset = asset;
    originalAsset = asset;
    cedearCache = null;
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

    // Cargar precio de mercado del asset (pre-fill + hint + sanity check)
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

  // Aplica el precio de mercado al modal: pre-llena el input si está vacío,
  // sincroniza la moneda nativa y refresca los previews.
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
