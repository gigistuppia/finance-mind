import { getState, getPortfolioItems } from './state.js';
import { computePositions } from './portfolio.js';
import { toast } from './ui/toast.js';

const SPLITS_CHECK_KEY = 'fm2_splits_last_check';
const SPLITS_LOG_KEY = 'fm2_splits_applied';
const CHECK_INTERVAL = 24 * 60 * 60_000; // una vez por día

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4175' : '';

async function fetchSplits(symbol, fromTimestamp) {
  try {
    const res = await fetch(`${API_BASE}/api/events?symbol=${encodeURIComponent(symbol)}&from=${Math.floor(fromTimestamp / 1000)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.splits ?? [];
  } catch {
    return [];
  }
}

/**
 * Aplica splits a las transacciones de un símbolo.
 * Para cada split (ratio = numerator/denominator, e.g. 4 para split 4:1):
 *   - Transacciones BUY anteriores al split: quantity × ratio, price ÷ ratio
 *   - Transacciones SELL anteriores al split: igual
 * Las transacciones posteriores al split ya tienen el precio ajustado.
 */
function applySplitstToTransactions(transactions, symbol, splits) {
  if (splits.length === 0) return { changed: false, transactions };

  const updated = transactions.map(tx => {
    if (tx.symbol !== symbol) return tx;
    if (tx.splitAdjusted) return tx; // ya fue ajustada previamente

    let qty = tx.quantity;
    let price = tx.price;
    let avgPrice = tx.avgPrice;
    const txDateSec = new Date(tx.date).getTime() / 1000;

    // Aplicar cada split que ocurrió DESPUÉS de esta transacción
    for (const split of splits) {
      if (split.date > txDateSec && split.ratio > 0) {
        qty = qty * split.ratio;
        price = price / split.ratio;
        if (avgPrice != null) avgPrice = avgPrice / split.ratio;
      }
    }

    if (qty === tx.quantity) return tx; // sin cambio

    return {
      ...tx,
      quantity: qty,
      price,
      avgPrice,
      splitAdjusted: true,
      _splitRatioApplied: splits.map(s => s.ratio).join('×'),
    };
  });

  const changed = updated.some((tx, i) => tx !== transactions[i]);
  return { changed, transactions: updated };
}

function loadSplitsLog() {
  try { return JSON.parse(localStorage.getItem(SPLITS_LOG_KEY) || '[]'); } catch { return []; }
}

function saveSplitsLog(log) {
  try { localStorage.setItem(SPLITS_LOG_KEY, JSON.stringify(log.slice(0, 100))); } catch {}
}

function getLastCheckTimes() {
  try { return JSON.parse(localStorage.getItem(SPLITS_CHECK_KEY) || '{}'); } catch { return {}; }
}

function saveLastCheckTime(symbol) {
  const times = getLastCheckTimes();
  times[symbol] = Date.now();
  try { localStorage.setItem(SPLITS_CHECK_KEY, JSON.stringify(times)); } catch {}
}

/**
 * Punto de entrada. Llamar una vez al iniciar la app.
 * Chequea splits para cada símbolo en portfolio, máximo una vez por día por símbolo.
 * Si detecta splits nuevos, ajusta las transacciones y muestra un toast.
 */
export async function checkSplits(onTransactionsChanged) {
  const portfolioItems = getPortfolioItems();
  if (portfolioItems.length === 0) return;

  const lastChecks = getLastCheckTimes();
  const now = Date.now();
  const { transactions } = getState();
  const positions = computePositions(transactions);

  let anyChanged = false;
  let updatedTransactions = [...transactions];
  const appliedLog = loadSplitsLog();

  for (const item of portfolioItems) {
    const { symbol } = item;
    const lastCheck = lastChecks[symbol] ?? 0;
    if (now - lastCheck < CHECK_INTERVAL) continue; // ya chequeado hoy

    const pos = positions.get(symbol);
    if (!pos) { saveLastCheckTime(symbol); continue; }

    // Buscar desde la primera compra del símbolo
    const firstBuyDate = new Date(pos.firstBuyDate).getTime();
    const splits = await fetchSplits(symbol, firstBuyDate);

    saveLastCheckTime(symbol);

    if (splits.length === 0) continue;

    // Filtrar splits que ya aplicamos
    const alreadyApplied = new Set(
      appliedLog.filter(e => e.symbol === symbol).map(e => e.splitDate)
    );
    const newSplits = splits.filter(s => !alreadyApplied.has(s.date));
    if (newSplits.length === 0) continue;

    const { changed, transactions: adjusted } = applySplitstToTransactions(
      updatedTransactions, symbol, newSplits
    );

    if (changed) {
      updatedTransactions = adjusted;
      anyChanged = true;

      for (const s of newSplits) {
        appliedLog.unshift({
          symbol,
          splitDate: s.date,
          ratio: s.ratio,
          appliedAt: now,
        });
      }

      const ratioLabel = newSplits.map(s => `${s.numerator}:${s.denominator}`).join(', ');
      toast(`Split detectado en ${symbol} (${ratioLabel}) — posición ajustada`, 'info', 5000);
    }
  }

  if (anyChanged) {
    saveSplitsLog(appliedLog);
    onTransactionsChanged(updatedTransactions);
  }
}
