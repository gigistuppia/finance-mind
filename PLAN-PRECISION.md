# Plan de Precisión — Finance Mind app-v2

> Creado: 12 de julio de 2026. Para ejecutar: 13 de julio de 2026.
> Objetivo: llevar el sistema de rendimientos a precisión nivel TradingView.
> Tiempo total estimado: **~5 h** (una jornada). Solo entra lo que afecta precisión;
> lo diferible quedó en el Backlog al final.
> Contexto: la auditoría encontró 15 fallas. Las 8 críticas ya están corregidas
> (código en working tree, **sin commitear**).

---

## ESTADO ACTUAL (qué quedó hecho el 12/07, sin commitear)

Archivos modificados en el working tree:

| Archivo | Qué se corrigió |
|---|---|
| `netlify/functions/quote.js` | Precios faltantes → `null` (nunca 0). Campos pre/post market. Fallback chart no inventa variación 0%. |
| `app-v2/scripts/api.js` | `normalizeQuote` con semántica null. `change`/`changePercent` solo con datos reales. |
| `app-v2/scripts/state.js` | CCL arranca `null` (sin default 1000). Nuevo `state.fxRates` + `setFxRates()`. |
| `app-v2/scripts/portfolio.js` | Reescrito: `toUSD()` por moneda real (GBp÷100, EUR, JPY…). `hasQuote` por fila. P&L `null` sin cotización. Summary expone `hasCCL`. |
| `app-v2/scripts/app.js` | `refreshQuotes` trae tasas cruzadas (`EURUSD=X`, etc.) según monedas del portfolio. |
| `app-v2/scripts/ui/dashboard.js` | `formatPct()`/`pctClass()` (sin "−0.00%" rojo). Decimales dinámicos 2/4/8. Badges PRE/POST. `.stale` > 5 min. Summary con CCL null → "—". |
| `app-v2/scripts/ui/assets.js` | P&L solo con `hasQuote`. Export con columna "Sin cotización". Decimales dinámicos. |
| `app-v2/styles/app.css` | Estilos `.market-badge.pre/.post` y `.price-cell.stale`. |

Verificado el 12/07 en preview local: sin errores de consola, null-price y conversión GBp/EUR/JPY validadas.

---

## PASO 0 — Cierre y deploy (~20 min)

**0.1. Smoke test rápido** (`preview_start "app-v2"`), 4 checks:
   - [ ] AAPL + un `.BA` → valores ARS/USD coherentes con el CCL de Ajustes.
   - [ ] SAP.DE (EUR) → valor ARS vía tasa cruzada tras el primer refresh (~10 s).
   - [ ] Offline + recarga → P&L "—" o `.stale`, nunca −100% ni +0.00% verde.
   - [ ] Sin `fm2_ccl` y sin red → summary ARS "—".

**0.2. Fix pendiente (~15 líneas):** persistir `fxRates` en localStorage
   (key `fm2_fx_rates`) y cargarlo al iniciar en `state.js`, para que EUR/GBp/JPY
   no muestren "—" hasta el primer refresh.

**0.3. Commit + deploy:**
   ```
   git add app-v2/ netlify/functions/quote.js
   git commit -m "Precision fixes: null-safe quotes, real multi-currency FX, no invented P&L"
   git push
   ```
   - [ ] Verificar https://finance-mind.netlify.app/app-v2/ tras el deploy.
   - `claude-image-generation/` (untracked) NO va en este commit.

---

## FASE 1 — Transacciones + FX histórico (~2.5 h)

> Se fusionan el modelo de transacciones y la captura de FX en una sola fase:
> el FX histórico son solo 3 campos más en la transacción, no amerita fase propia.

### 1.1. Modelo de datos (`state.js`) — key `fm2_transactions`

```js
{
  id: crypto.randomUUID(),
  type: 'buy' | 'sell',
  symbol, name, quoteType, exchange,
  currency: 'USD',            // moneda nativa del activo
  quantity: 10,               // siempre positivo; type define el signo
  price: 150.25,              // precio unitario en moneda NATIVA (fuente de verdad)
  fee: 1.50,                  // comisión en moneda nativa (default 0)
  date: '2026-07-13',
  inputPrice: 235000,         // lo que el usuario tipeó
  inputCurrency: 'ARS',       // en qué moneda lo tipeó
  fxRateUsed: 1565.9,         // CCL usado al convertir (null si no hubo conversión)
  createdAt: Date.now(),
}
```

Regla: si el CCL es `null` al confirmar una compra que requiere conversión →
bloquear con toast "Esperando cotización del dólar". Nunca convertir sin tasa.

### 1.2. Posiciones derivadas (`portfolio.js`)

`computePositions(transactions)` — pura, sin DOM:
- Agrupa por `symbol`, ordena por `date` (desempate `createdAt`).
- **Costeo: precio promedio ponderado (PPP)** — estándar broker argentino.
- Buy: `costTotal += qty*price + fee`.
- Sell: `realizedPnL += qty*(precioVenta − costPromedio) − fee`; el costo promedio NO cambia.
- Venta que deje `qty < 0` → rechazada en UI.
- Retorna `{ symbol, quantity, avgPrice, totalFees, realizedPnL, firstBuyDate }`.
- `computeHoldings()` lee de acá en lugar de `state.portfolio`.

### 1.3. Doble P&L en `computeHoldings`

- `costARShistorico` = Σ `(qty*price + fee) * fxRateUsed` por transacción (activos no-ARS).
  Transacciones migradas sin `fxRateUsed` → CCL actual + flag `fxApproximate`.
- Cada fila y summary exponen `pnlUSD` (moneda dura, lo actual) y `pnlARSReal`
  (`valueARS_hoy − costARShistorico`, captura la devaluación).
- UI mínima: toggle "P&L en USD / P&L en ARS reales" en la card del dashboard,
  persistido en `fm2_pnl_mode`. Sin tooltips elaborados por ahora.

### 1.4. Migración (crítica, una sola vez, idempotente)

Si existe `fm2_portfolio` y no `fm2_transactions`: cada posición → 1 buy sintética
(`price = avgPrice`, `fee: 0`, `migrated: true`). Renombrar la key vieja a
`fm2_portfolio_backup_v1` — nunca borrar.

### 1.5. UI mínima indispensable

- Modal "Agregar" (`add-asset.js`): campo opcional "Comisión"; crea transacción.
- Flujo "Vender": botón por fila → mismo modal en modo venta (cantidad max = tenencia,
  precio, comisión, fecha) + preview del P&L realizado.
- Summary: línea "P&L realizado" cuando sea ≠ 0.
- ❌ Diferido: edición/borrado de transacciones individuales, rediseño de Actividad.

### 1.6. Verificación

- [ ] 10 AAPL a 100 + 10 a 200 → avg 150, qty 20.
- [ ] Vender 5 a 180, fee 2 → realizedPnL 148; qty 15; avg sigue 150.
- [ ] Vender 20 → rechazado.
- [ ] Compra con CCL 1000 en la tx; CCL hoy 1500 → P&L USD igual, P&L ARS real ≈ +50% del costo.
- [ ] Usuario viejo migra sin pérdida; dashboard idéntico al previo.

---

## FASE 2 — Splits automáticos (~1.5 h)

> Solo splits. Dividendos van al Backlog: no corrompen el P&L, los splits sí.

- **2.1.** Nueva Netlify Function `events.js`: `/api/events?symbol=X&from=TS` →
  chart API con `events=splits` (misma auth/UA que `quote.js`).
  Devuelve `{ splits: [{date, numerator, denominator}] }`.
- **2.2.** Cliente (`splits.js` nuevo): al iniciar, máx. 1 vez cada 24 h
  (`fm2_splits_check`). Por símbolo del portfolio, pedir splits desde `firstBuyDate`.
  Split no aplicado (registro en `fm2_splits_applied`) → a cada tx anterior a la fecha:
  `quantity *= ratio`, `price /= ratio`. Toast: "Split 10:1 de NVDA aplicado (15/06/2026)".
- **2.3.** Verificación:
  - [ ] Tx de NVDA fechada antes de su split real → qty/avg ajustados, P&L coherente.
  - [ ] Segundo arranque → no re-aplica.

---

## FASE 3 — Frescura mínima (~30 min)

- Indicador "Actualizado hace Xs" en el header (peor `updatedAt` del portfolio;
  verde < 1 min, amarillo < 5, rojo después).
- `marketState: 'UNKNOWN'` → tratar como OPEN en horario 9:30–16:00 ET aproximado.
- ❌ Diferido: extender `.stale` a cards mobile, Cartera y Watchlist.

---

## ORDEN Y DEPENDENCIAS

```
PASO 0 (20 min)  →  primero siempre: aísla y deploya lo ya probado
FASE 1 (2.5 h)   →  transacciones + FX histórico juntos
FASE 2 (1.5 h)   →  splits (depende de 1: ajusta transacciones)
FASE 3 (30 min)  →  comodín; si el día se acorta, se cae sin culpa
```

Un commit por fase, push = deploy, prueba en producción entre fases.

## BACKLOG (diferido a propósito — no tocar mañana)

- Dividendos (registro en Actividad + `totalDividends` por posición).
- Edición/borrado de transacciones individuales; rediseño de vista Actividad.
- Leyenda "punta vendedora" en Ajustes.
- `.stale` en cards mobile, Cartera y Watchlist.
- Tooltips explicativos del doble P&L.

## REGLAS TRANSVERSALES (no negociables)

1. **Nunca inventar un número**: sin dato → `null` → "—" en UI.
2. **Nunca destruir el dato original**: toda conversión guarda entrada + tasa.
3. **Migraciones con backup**: renombrar keys viejas, nunca borrarlas.
4. **Cálculo puro separado de UI**: testeable desde consola.
5. Redondear SOLO al mostrar; signo y color sobre el valor redondeado.
6. Tokens CSS, escala 8px, sin hex hardcodeados, español rioplatense en UI.
