# Base de Datos de CEDEARs — Finance Mind

## Contenido

- `cedears-db.json` — 342+ CEDEARs habilitados en BYMA (ticker, nombre, ratio, mercado, sector, país)
- `update-cedears.js` — Script Node.js que actualiza precios desde Open BYMA Data (gratis, sin auth)

## Uso

```bash
# Ver datos estáticos (siempre disponibles)
cat landing/db/cedears-db.json

# Actualizar precios (requiere conexión + horario de mercado ART 10-17 lun-vie)
node landing/db/update-cedears.js
```

## Fuente de datos

| Dato | Fuente | Frecuencia |
|------|--------|------------|
| Tickers, ratios, sectores | BYMA oficial + Rankia | Estático (actualizar manualmente si BYMA agrega CEDEARs) |
| Precios, variación, volumen | Open BYMA Data (`open.bymadata.com.ar`) | 20 min delay, gratis, sin auth |

## Schema

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "ratio": "20:1",
  "market": "NASDAQ",
  "sector": "Technology",
  "country": "US",
  "lastPrice": 24350.00,
  "change": 298.50,
  "changePercent": 1.24,
  "volume": 152340,
  "lastUpdate": "2026-06-17T15:30:00.000Z"
}
```

Los campos `lastPrice` → `lastUpdate` son `null` hasta correr `update-cedears.js`.

## Notas

- Los precios son en ARS (pesos argentinos)
- El delay de 20 minutos es inherente a Open BYMA Data (API gratuita)
- Para tiempo real se necesita la API paga de BYMA (`api-mgr.byma.com.ar`, requiere `client_id` + `client_secret`)
- Los ratios pueden cambiar por acciones corporativas — verificar contra [BYMA oficial](https://www.byma.com.ar/en/products/financial-products/cedears/)
