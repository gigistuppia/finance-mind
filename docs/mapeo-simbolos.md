# Mapeo de símbolos: TradingView → Yahoo Finance

> Insumo de la **fase 2** (importador de watchlists). Ataca el riesgo §14.6 de `CLAUDE.md`.
> Investigado y verificado el 29/08/2026 contra el endpoint público
> `query1.finance.yahoo.com/v8/finance/chart/SIMBOLO`.
>
> **Estado:** América y Europa verificadas (60+ símbolos con precio real).
> Asia-Pacífico, cripto, forex, commodities e índices: pendientes.

---

## 1. Américas

| Prefijo TV | Sufijo Yahoo | Ejemplo | Confianza |
|---|---|---|---|
| `NASDAQ` `NYSE` `AMEX` `NYSEAMERICAN` `ARCA` `OTC` | *(ninguno)* | `NASDAQ:AAPL` → `AAPL` | verificado |
| `BATS` | *(ninguno)* | `BATS:SPY` → `SPY` | probable |
| `TSX` | `.TO` | `TSX:SHOP` → `SHOP.TO` | verificado |
| `TSXV` | `.V` | `TSXV:NFG` → `NFG.V` | verificado |
| `CSE` | `.CN` | `CSE:PLTH` → `PLTH.CN` | verificado |
| `NEO` | `.NE` | `NEO:NVDA` → `NVDA.NE` | verificado |
| `BCBA` `BYMA` | `.BA` | `BCBA:GGAL` → `GGAL.BA` | verificado |
| `BMFBOVESPA` `BOVESPA` | `.SA` | `BMFBOVESPA:PETR4` → `PETR4.SA` | verificado |
| `BMV` | `.MX` | `BMV:WALMEX` → `WALMEX.MX` | verificado |
| `BCS` (Chile) | `.SN` | `BCS:SQM-B` → `SQM-B.SN` | verificado |
| `BVC` (Colombia) | `.CL` | `BVC:ECOPETROL` → `ECOPETROL.CL` | verificado |
| `BVL` (Perú) | `.LM` | — | **indexado pero SIN DATOS** |

## 2. Europa

| Prefijo TV | Sufijo Yahoo | Ejemplo | Confianza |
|---|---|---|---|
| `LSE` | `.L` | `LSE:SHEL` → `SHEL.L` | verificado |
| `LSIN` | `.IL` | `LSIN:KAP` → `KAP.IL` | verificado |
| `XETR` | `.DE` | `XETR:SAP` → `SAP.DE` | verificado |
| `FWB` | `.F` · `SWB` → `.SG` · `MUN` → `.MU` · `DUS` → `.DU` · `HAM` → `.HM` · `HAN` → `.HA` | | verificado |
| `TRADEGATE` `GETTEX` `BER` `LS` | **`.DE` (fallback)** | sin línea propia en Yahoo | verificado |
| `EURONEXTPAR` | `.PA` · `EURONEXTAMS` → `.AS` · `EURONEXTBRU` → `.BR` · `EURONEXTLIS` → `.LS` · `EURONEXTDUB` → `.IR` | | verificado |
| `EURONEXT` (genérico) | **ambiguo** → cascada `.PA`→`.AS`→`.BR`→`.LS` | | ver trampa 7 |
| `BME` | `.MC` · `MIL` → `.MI` · `SIX` → `.SW` · `VIE` → `.VI` · `ATHEX` → `.AT` · `BIST` → `.IS` · `GPW` → `.WA` | | verificado |
| `OMXSTO` | `.ST` · `OSL` → `.OL` · `OMXCOP` → `.CO` · `OMXHEX` → `.HE` | | verificado |
| `OMXICE` `NEWCONNECT` | `.IC` / `.WA` | cobertura escasa, tolerar 404 | incierto |

---

## 3. Trampas — leer antes de escribir el parser

**1. Clases de acción: normalizar el separador ANTES del sufijo.**
Yahoo usa guion `-`; TradingView usa punto, guion bajo o espacio.
`NYSE:BRK.B` → `BRK-B` · `TSX:CTC.A` → `CTC-A.TO` · `OMXSTO:ERIC_B` → `ERIC-B.ST` ·
`OMXCOP:NOVO_B` → `NOVO-B.CO`. **Excepción: Brasil.**

**2. Brasil NO lleva guion — el dígito es parte del ticker.**
`PETR4` (preferida), `PETR3` (ordinaria), `SANB11` (unit). Solo agregar `.SA`.

**3. `.CL` es COLOMBIA, no Chile.** El error más caro de la tabla.
Chile = `.SN` (Santiago) · Colombia = `.CL` (BVC). Ambos verificados.

**4. Perú (`.LM`) aparece en el buscador de Yahoo pero el chart devuelve `result: null`.**
No pidas velas. Mapear al ADR de NYSE cuando exista (`BVL:CREDITC1` → `BAP`) o marcar
el activo como sin cotización.

**5. Berlín (`.BE`) fue dado de baja.** 404 verificado. Caer a `.DE`.

**6. Tradegate y gettex no existen en Yahoo.** `SAP.TG` → 404. Caer a `.DE`;
es el mismo papel con céntimos de diferencia.

**7. `EURONEXT:` a secas es ambiguo** entre París, Ámsterdam, Bruselas y Lisboa.
Resolver por cascada, o vía `/v1/finance/search?q=TICKER` mirando `exchDisp`.

**8. México: locales y SIC comparten `.MX`.** `WALMEX.MX` (local) y `AAPL.MX` (SIC).
La serie va pegada: `AMX B` → `AMXB.MX`. `AAPLN.MX` NO existe.

**9. Alemania tiene 7 plazas con 7 precios distintos** para el mismo papel
(188,88 a 191,32 en la misma corrida). Normalizar a `.DE` salvo compra explícita en otra.

**10. Ambigüedad multi-plaza real.**
`ROG.SW` está 404 hoy; la línea viva de Roche en SIX es `ROP.SW`. Si un símbolo suizo
falla, buscarlo antes de descartarlo. `1BMW.MI` es el cross-listing italiano, no `BMW.DE`.
Si el usuario importa `OTC:RHHBY`, respetarlo — no "corregirlo" al local.

**11. ⚠ LSE cotiza en PENIQUES.** `SHEL.L` devuelve `currency: "GBp"` (p minúscula) con
precio 3344,5 = £33,44. **Hay que dividir por 100 antes de convertir a USD.**
Aplica a casi todas las líneas `.L` y `.IL`.

**12. Los índices no llevan sufijo sino prefijo `^`** y necesitan tabla aparte:
`SP:SPX` → `^GSPC` · `NASDAQ:IXIC` → `^IXIC` · `XETR:DAX` → `^GDAXI` ·
`LSE:UKX` → `^FTSE` · `BCBA:IMV` → `^MERV`.

---

## 4. Arquitectura recomendada del importador

**No fallar duro ante un prefijo desconocido.** Cascada:

1. Buscar el prefijo en la tabla → armar el símbolo Yahoo.
2. Validar contra `/v8/finance/chart/SIMBOLO?range=5d`.
3. Si da 404, pasar el ticker pelado por `/v1/finance/search?q=TICKER` y quedarse con
   el primer resultado cuyo `exchDisp` sea plausible.
4. Si nada resuelve, **mostrárselo al usuario** para que corrija a mano (§14.6:
   nunca fallar en silencio).
5. **Cachear el mapeo por símbolo TV** — la resolución por búsqueda es cara y el
   resultado no cambia.

---

## 5. Símbolos verificados con precio real

`AAPL` `IBM` `SPY` `UAMY` `BAYRY` `RHHBY` `SHOP.TO` `ABX.TO` `ATD.TO` `CTC-A.TO` `NFG.V`
`AMX.V` `PLTH.CN` `MOOD.CN` `NVDA.NE` `GGAL.BA` `YPFD.BA` `PAMP.BA` `AAPL.BA` `MELI.BA`
`PETR4.SA` `VALE3.SA` `ITUB4.SA` `SANB11.SA` `AMXB.MX` `WALMEX.MX` `AAPL.MX` `MSFT.MX`
`SQM-B.SN` `ECOPETROL.CL` `ISA.CL` `SHEL.L` `HSBA.L` `BP.L` `RR.L` `KAP.IL` `SAP.DE`
`SAP.F` `SAP.SG` `SAP.MU` `SAP.DU` `SAP.HM` `SAP.HA` `MC.PA` `ASML.AS` `ABI.BR` `EDP.LS`
`RYA.IR` `SAN.MC` `ITX.MC` `ENI.MI` `RACE.MI` `1BMW.MI` `NESN.SW` `UBSG.SW` `ERIC-B.ST`
`VOLV-B.ST` `ATCO-A.ST` `ELUX-B.ST` `SEB-A.ST` `EQNR.OL` `TEL.OL` `NOVO-B.CO`
`MAERSK-B.CO` `DANSKE.CO` `NOKIA.HE` `PKO.WA` `CDR.WA` `OMV.VI` `VOE.VI` `ETE.AT` `THYAO.IS`

---

# Parte 2 — Asia-Pacífico, cripto, forex, commodities e índices

> Verificado el 29/08/2026, ~90 símbolos probados.

## ⚠ 0. Cómo validar un símbolo (trampa crítica)

**Yahoo NO devuelve 404 para todos los símbolos inválidos.** Devuelve HTTP 200 con basura:

```
SM.PS      → fullExchangeName "YHD", currency null, sin precio, datos de 2019
PBBANK.KL  → fullExchangeName "YHD", currency null, price 10653584400
```

Ese precio de diez mil millones tiene forma de número válido. Un símbolo es válido solo si:

1. `meta.regularMarketPrice` existe y no es `null`
2. `meta.fullExchangeName !== "YHD"` ← el marcador de "no existe"
3. `meta.currency !== null`

Ya implementado en `lib/yahoo.js` como `metaEsValida()`, con tests en `test/yahoo.test.cjs`.

## A) Asia-Pacífico

| Prefijo TV | Regla | Ejemplo | Confianza |
|---|---|---|---|
| `TSE` (**Tokio**) | `+ ".T"` | `TSE:7203` → `7203.T` | verificado |
| `HKEX` | `padStart(4,"0") + ".HK"` | `HKEX:700` → `0700.HK` | verificado |
| `SSE` | `+ ".SS"` | `SSE:600519` → `600519.SS` | verificado |
| `SZSE` | `+ ".SZ"` | `SZSE:300750` → `300750.SZ` | verificado |
| `KRX` | `+ ".KS"` (KOSPI) o `.KQ` (KOSDAQ) | `KRX:005930` → `005930.KS` | verificado |
| `NSE` | `+ ".NS"` | `NSE:RELIANCE` → `RELIANCE.NS` | verificado |
| `BSE` | `+ ".BO"` (ticker alfabético, NO scrip code) | `BSE:RELIANCE` → `RELIANCE.BO` | verificado |
| `TWSE` | `+ ".TW"` · `SGX` → `.SI` · `ASX` → `.AX` · `NZX` → `.NZ` | | verificado |
| `IDX` | `+ ".JK"` · `SET` → `.BK` · `HOSE`/`HNX` → `.VN` | | verificado |
| `MYX` | `.KL` pero requiere **código numérico** | `MYX:MAYBANK` → `1155.KL` | incierto |
| `PSE` | **sin equivalente para acciones** | rechazar en el importador | verificado |

## B) Cripto

**Algoritmo:** descartar prefijo de exchange → quitar sufijo `.P`/`PERP` → separar base/cotización
probando sufijos de **más largo a más corto**:
`["FDUSD","BUSD","USDT","USDC","TUSD","USDD","USDP","DAI","USD","BTC","ETH","BNB","EUR","GBP","JPY"]`
→ si la cotización es stablecoin, normalizar a `USD` → `${base}-${quote}`.

`BINANCE:BTCUSDT` → `BTC-USD` · `BYBIT:AVAXUSDT.P` → `AVAX-USD` · `BINANCE:ETHBTC` → `ETH-BTC`
(cross se preserva) · `BITSTAMP:BTCEUR` → `BTC-EUR` (fiat no-USD se preserva) ·
`BINANCE:USDTUSD` → `USDT-USD` (stablecoin como **base** se mantiene).

⚠ Ordenar por longitud descendente y exigir que el resto mida ≥2 caracteres.
Rompen un `endsWith` ingenuo: `PAXGUSDT` (base `PAXG`), `BTCDOMUSDT`, `1000PEPEUSDT`.
Los multiplicadores `1000`/`1M` hay que quitarlos, y aun así el precio queda en otra escala:
**marcar como no comparable**.

## C) Forex

Regla única: **`BASE + QUOTE + "=X"`**, el prefijo del broker es ruido.
`OANDA:EURUSD` → `EURUSD=X` · `FX_IDC:USDARS` → `USDARS=X`. Quitar guion bajo si viene.

⚠ **Nunca usar la forma corta de 3 letras.** `JPY=X` = `USDJPY=X` (mismo valor), pero
`EUR=X` = 0.863 = `USDEUR`, la **inversa** de `EURUSD=X` (1.1587). Siempre 6 letras + `=X`.

⚠ Oro y plata spot **no existen**: `XAUUSD=X` falla. Mapear a `GC=F` y `SI=F`.

## D) Commodities (`=F`)

Quitar el sufijo de contrato continuo (`1!`, `2!`, `!`) o vencimiento (`GCZ2026`), quedarse con
la raíz y agregar `=F`. Todos verificados:

`GC=F` oro · `SI=F` plata · `HG=F` cobre · `PL=F` platino · `PA=F` paladio · `CL=F` WTI ·
`BZ=F` Brent · `NG=F` gas · `RB=F` nafta · `HO=F` heating oil · `ZW=F` trigo · `ZC=F` maíz ·
`ZS=F` soja · `ZM=F` harina · `ZL=F` aceite · `ZO=F` avena · `ZR=F` arroz · `KC=F` café ·
`CT=F` algodón · `SB=F` azúcar · `CC=F` cacao · `LE=F` ganado · `HE=F` cerdo.

Financieros: `ES=F` `NQ=F` `YM=F` `RTY=F` `ZN=F` `ZB=F` `6E=F`.

## E) Índices (`^`)

`SP:SPX` → `^GSPC` · `NASDAQ:IXIC` → `^IXIC` · `NASDAQ:NDX` → `^NDX` · `DJ:DJI` → `^DJI` ·
`TVC:RUT` → `^RUT` · `TVC:VIX` → `^VIX` · **`BCBA:IMV` → `^MERV`** · `TVC:UKX` → `^FTSE` ·
`TVC:DAX` → `^GDAXI` · `TVC:CAC40` → `^FCHI` · `TVC:SX5E` → `^STOXX50E` · `TVC:IBEX35` → `^IBEX` ·
`TVC:AEX` → `^AEX` · `TVC:SMI` → `^SSMI` · `TVC:OMXS30` → `^OMX` · `TVC:NI225` → `^N225` ·
`TVC:HSI` → `^HSI` · `TVC:KOSPI` → `^KS11` · `TVC:TAIEX` → `^TWII` · `ASX:XJO` → `^AXJO` ·
`NSE:NIFTY` → `^NSEI` · `BSE:SENSEX` → `^BSESN` · `TVC:STI` → `^STI` · `IDX:COMPOSITE` → `^JKSE` ·
`TVC:KLCI` → `^KLSE` · `SET:SET` → `^SET.BK` · `NZX:NZ50G` → `^NZ50` · `BMFBOVESPA:IBOV` → `^BVSP` ·
`TSX:TSX` → `^GSPTSE` · `BMV:ME` → `^MXX` · `TVC:IPSA` → `^IPSA` ·
`TVC:US10Y` → `^TNX` (`^FVX` `^TYX` `^IRX` para 5y/30y/13w).

⚠ **Cinco índices NO llevan `^`:** `FTSEMIB.MI`, `000001.SS`, `399001.SZ`, `PSEI.PS`, `DX-Y.NYB`.

## Trampas de la parte 2

1. **`TSE` en TradingView es TOKIO, no Toronto.** Toronto es `TSX`. Confundirlos convierte a
   Toyota en un símbolo canadiense inexistente.
2. **Hong Kong: `padStart(4,"0")`, nunca más.** `700.HK` falla, `0700.HK` anda; `9988.HK` anda,
   `09988.HK` falla.
3. **Corea: TV no distingue KOSPI de KOSDAQ.** Probar `.KS` y reintentar `.KQ`.
4. **India: BSE usa ticker alfabético.** `RELIANCE.BO` ✓ / `500325.BO` ✗.
5. **`SSE:000001` es el Shanghai Composite Y el ticker de Ping An Bank (`000001.SZ`).**
   El prefijo de exchange es lo único que los distingue.
6. **Filipinas: rechazar `PSE:`** con mensaje claro. Solo vive el índice `PSEI.PS`.
7. **Malasia: sin regla algorítmica.** Tabla de lookup para blue chips, o rechazar.
8. **Perpetuos y continuos:** strippear `.P`, `1!`, `2!`, `!` antes de mapear.
