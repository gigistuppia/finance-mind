import { useState, useEffect, useRef, useCallback } from 'react';
import { GEMINI_COLORS, toYahooSymbol } from '../data/tickers';

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// BYMA: lun-vie 11:00–17:00 ARS (UTC-3)
export function getMarketStatus() {
  const now = new Date();
  const ars = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const day = ars.getDay();
  const mins = ars.getHours() * 60 + ars.getMinutes();

  if (day === 0 || day === 6) return { open: false, label: 'Cerrado · fin de semana' };

  if (mins < 660) {
    const diff = 660 - mins;
    return { open: false, label: `Abre en ${Math.floor(diff / 60)}h ${diff % 60}m` };
  }
  if (mins >= 1020) return { open: false, label: 'Cerró 17:00 hs' };

  const diff = 1020 - mins;
  return { open: true, label: `Abierto · cierra en ${Math.floor(diff / 60)}h ${diff % 60}m` };
}

// Fetch precio vía proxy Vite → Yahoo Finance v8 chart
// TODO: reemplazar con GET https://api.balanz.com/v1/quotes/{ticker} cuando esté disponible
async function fetchTickerPrice(ticker) {
  const symbol = toYahooSymbol(ticker);
  const res = await fetch(`/api/yahoo/v8/finance/chart/${symbol}?interval=1m&range=1d&includePrePost=false`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Sin datos');
  const price = result.meta.regularMarketPrice;
  if (!price || price <= 0) throw new Error('Precio inválido');
  return price;
}

export function usePortfolio() {
  const [assets, setAssets] = useState(() => LS.get('gm_assets', []));
  const [movements, setMovements] = useState(() => LS.get('gm_movements', []));
  // Iniciar con últimos precios guardados (cierre anterior)
  const [prices, setPrices] = useState(() => {
    const saved = LS.get('gm_last_prices', {});
    const bought = {};
    LS.get('gm_assets', []).forEach(a => { bought[a.id] = a.buyPrice; });
    return { ...bought, ...saved };
  });
  const [marketStatus, setMarketStatus] = useState(getMarketStatus);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [fetchErrors, setFetchErrors] = useState({});
  const intervalRef = useRef(null);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const assetsWithColor = assets.map((a, i) => ({ ...a, color: GEMINI_COLORS[i % GEMINI_COLORS.length] }));

  const updatePrices = useCallback(async () => {
    const current = assetsRef.current;
    if (!current.length) return;

    setLoading(true);

    const results = await Promise.allSettled(
      current.map(a =>
        fetchTickerPrice(a.ticker)
          .then(price => ({ id: a.id, ticker: a.ticker, price }))
          .catch(err => ({ id: a.id, ticker: a.ticker, error: err.message }))
      )
    );

    const newErrors = {};
    setPrices(prev => {
      const next = { ...prev };
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          if (r.value.price) {
            next[r.value.id] = r.value.price;
          } else {
            newErrors[r.value.ticker] = r.value.error;
          }
        }
      });
      LS.set('gm_last_prices', next);
      return next;
    });

    setFetchErrors(newErrors);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  // Siempre sincronizar nuevos activos con precio de compra como fallback
  useEffect(() => {
    setPrices(prev => {
      const next = { ...prev };
      assets.forEach(a => { if (!next[a.id]) next[a.id] = a.buyPrice; });
      return next;
    });
  }, [assets.length]);

  // Lógica de actualización según estado del mercado
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const status = getMarketStatus();
    setMarketStatus(status);

    // Fetch inicial siempre (para obtener precio de cierre o en tiempo real)
    updatePrices();

    if (status.open) {
      // Mercado abierto: actualizar precios cada 30s
      intervalRef.current = setInterval(() => {
        const s = getMarketStatus();
        setMarketStatus(s);
        if (s.open) updatePrices();
      }, 30000);
    } else {
      // Mercado cerrado: solo actualizar el label del countdown cada 60s
      intervalRef.current = setInterval(() => {
        const s = getMarketStatus();
        setMarketStatus(s);
        // Si el mercado acaba de abrir, arrancar la actualización de precios
        if (s.open) {
          updatePrices();
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            setMarketStatus(getMarketStatus());
            updatePrices();
          }, 30000);
        }
      }, 60000);
    }

    return () => clearInterval(intervalRef.current);
  }, [updatePrices]);

  const addAsset = useCallback((data) => {
    const id = Date.now().toString();
    const asset = { ...data, id };
    const newAssets = [...assets, asset];
    setAssets(newAssets);
    LS.set('gm_assets', newAssets);
    setPrices(prev => ({ ...prev, [id]: data.buyPrice }));

    const movement = {
      id, date: data.buyDate, type: 'Compra',
      ticker: data.ticker, name: data.name,
      qty: data.qty, price: data.buyPrice, total: data.buyPrice * data.qty,
    };
    const newMov = [...movements, movement];
    setMovements(newMov);
    LS.set('gm_movements', newMov);

    if (!LS.get('gm_portfolio_start_date', null)) {
      LS.set('gm_portfolio_start_date', data.buyDate);
      LS.set('gm_portfolio_start_value', data.buyPrice * data.qty);
    }

    // Buscar precio real del nuevo activo
    fetchTickerPrice(data.ticker)
      .then(price => { if (price) setPrices(prev => ({ ...prev, [id]: price })); })
      .catch(() => {});
  }, [assets, movements]);

  const removeAsset = useCallback((id) => {
    const newAssets = assets.filter(a => a.id !== id);
    setAssets(newAssets);
    LS.set('gm_assets', newAssets);
    setPrices(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, [assets]);

  const totalInvested = assets.reduce((s, a) => s + a.buyPrice * a.qty, 0);
  const totalCurrent = assetsWithColor.reduce((s, a) => s + (prices[a.id] || a.buyPrice) * a.qty, 0);
  const totalPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  return {
    assets: assetsWithColor, prices, movements, addAsset, removeAsset,
    totalInvested, totalCurrent, totalPct,
    marketStatus, loading, lastUpdate, fetchErrors,
  };
}
