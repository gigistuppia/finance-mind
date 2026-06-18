import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TICKERS } from '../data/tickers';

const today = () => new Date().toISOString().split('T')[0];

export default function AddAssetModal({ open, onClose, onAdd }) {
  const [ticker, setTicker] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [qty, setQty] = useState('');
  const [buyDate, setBuyDate] = useState(today());
  const [suggestions, setSuggestions] = useState([]);

  const handleTicker = (v) => {
    setTicker(v.toUpperCase());
    setSuggestions(v ? Object.keys(TICKERS).filter(k => k.startsWith(v.toUpperCase())).slice(0, 5) : []);
  };

  const pickTicker = (t) => { setTicker(t); setSuggestions([]); };

  const submit = (e) => {
    e.preventDefault();
    if (!ticker || !buyPrice || !qty || !buyDate) return;
    onAdd({ ticker, name: TICKERS[ticker] || ticker, buyPrice: Number(buyPrice), qty: Number(qty), buyDate });
    setTicker(''); setBuyPrice(''); setQty(''); setBuyDate(today());
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={s.overlay} onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={s.modal}
            onClick={e => e.stopPropagation()}
          >
            <div style={s.header}>
              <h3 style={s.title}>Agregar Activo</h3>
              <button style={s.close} onClick={onClose}>✕</button>
            </div>
            <form onSubmit={submit} style={s.form}>
              <div style={s.fieldWrap}>
                <label style={s.label}>Ticker</label>
                <input style={s.input} value={ticker} onChange={e => handleTicker(e.target.value)} placeholder="AAPL, MSFT..." autoComplete="off" />
                {suggestions.length > 0 && (
                  <div style={s.suggestions}>
                    {suggestions.map(t => (
                      <div key={t} style={s.suggestion} onClick={() => pickTicker(t)}>
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{t}</span>
                        <span style={{ color: 'var(--text2)' }}>{TICKERS[t]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Precio compra (ARS)</label>
                  <input style={s.input} type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="0" min="0" step="0.01" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Cantidad</label>
                  <input style={s.input} type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" min="1" />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Fecha de compra</label>
                <input style={s.input} type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
              </div>
              <button type="submit" style={s.btn}>Agregar al portfolio</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: 600 },
  close: { background: 'none', border: 'none', color: 'var(--text2)', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  fieldWrap: { position: 'relative' },
  field: { flex: 1 },
  row: { display: 'flex', gap: 12 },
  label: { display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 },
  input: { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', color: 'var(--text1)', fontSize: 14, outline: 'none' },
  suggestions: { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden', zIndex: 10, marginTop: 4 },
  suggestion: { padding: '10px 12px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' },
  btn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, marginTop: 4, transition: 'opacity 0.15s ease-out' },
};
