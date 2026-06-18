/**
 * update-cedears.js
 * Actualiza cedears-db.json con precios desde Open BYMA Data (gratis, sin auth, 20 min delay).
 * Uso: node landing/db/update-cedears.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, 'cedears-db.json');
const BYMA_API = 'https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/cedears';

function fetchCedears() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const options = {
      hostname: 'open.bymadata.com.ar',
      path: '/vanoms-be-core/rest/api/bymadata/free/cedears',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'FinanceMind/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function normalizeSymbol(sym) {
  if (!sym) return '';
  return sym.replace(/\s+/g, '').toUpperCase();
}

async function main() {
  console.log('=== Finance Mind — Actualización de CEDEARs ===\n');
  console.log(`API: ${BYMA_API} (POST)\n`);

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const tickerMap = new Map();
  for (const cedear of db.cedears) {
    tickerMap.set(normalizeSymbol(cedear.ticker), cedear);
  }

  let bymaData;
  try {
    bymaData = await fetchCedears();
    if (!Array.isArray(bymaData) || bymaData.length === 0) {
      throw new Error('Respuesta vacía o formato inesperado');
    }
    console.log(`BYMA respondió con ${bymaData.length} registros\n`);
  } catch (e) {
    console.error(`Error conectando a BYMA: ${e.message}`);
    console.log('\nTip: Open BYMA Data puede no responder fuera de horario de mercado (10-17 ART, lun-vie).');
    process.exit(1);
  }

  let updated = 0;
  let notFound = 0;
  const seen = new Set();

  for (const item of bymaData) {
    const symbol = normalizeSymbol(item.symbol);
    if (!symbol || seen.has(symbol)) continue;

    const cedear = tickerMap.get(symbol);
    if (!cedear) {
      notFound++;
      continue;
    }

    const price = parseFloat(item.trade || item.closingPrice || item.settlementPrice || 0);
    const prevClose = parseFloat(item.previousClosingPrice || 0);
    const volume = parseInt(item.volume || item.tradeVolume || 0, 10);

    if (price > 0) {
      if (!seen.has(symbol) || item.settlementType === '2') {
        cedear.lastPrice = price;
        cedear.change = prevClose > 0 ? +(price - prevClose).toFixed(2) : 0;
        cedear.changePercent = prevClose > 0 ? +((price - prevClose) / prevClose * 100).toFixed(4) : 0;
        cedear.volume = volume;
        cedear.high = parseFloat(item.tradingHighPrice || 0) || null;
        cedear.low = parseFloat(item.tradingLowPrice || 0) || null;
        cedear.open = parseFloat(item.openingPrice || 0) || null;
        cedear.tradeHour = item.tradeHour || null;
        cedear.lastUpdate = new Date().toISOString();
        updated++;
        seen.add(symbol);
      }
    }
  }

  db.meta.lastPriceUpdate = new Date().toISOString();
  db.meta.totalRecords = db.cedears.length;

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  console.log(`Resultado:`);
  console.log(`  Actualizados: ${updated}/${db.cedears.length} CEDEARs con precio`);
  console.log(`  Sin match:    ${notFound} tickers en BYMA sin entrada en la DB`);
  console.log(`  Guardado en:  ${DB_PATH}`);
  console.log(`  Timestamp:    ${db.meta.lastPriceUpdate}`);
}

main().catch(e => { console.error(e); process.exit(1); });
