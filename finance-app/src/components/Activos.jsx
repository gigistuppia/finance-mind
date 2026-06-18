import { useState } from 'react';
import { motion } from 'framer-motion';
import AssetRow from './AssetRow';

export default function Activos({ assets, prices, removeAsset }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('value');
  const [sortDir, setSortDir] = useState(-1);

  const cols = [
    { key: 'name', label: 'Empresa' },
    { key: 'ticker', label: 'Ticker' },
    { key: 'buyPrice', label: 'Precio compra' },
    { key: 'price', label: 'Precio actual' },
    { key: 'qty', label: 'Cantidad' },
    { key: 'value', label: 'Valor total' },
    { key: 'pct', label: 'Rend. %' },
    { key: 'ars', label: 'Rend. ARS' },
    { key: 'buyDate', label: 'Fecha' },
    { key: 'del', label: '' },
  ];

  const enriched = assets.map(a => {
    const price = prices[a.id] || a.buyPrice;
    return { ...a, price, value: price * a.qty, pct: ((price - a.buyPrice) / a.buyPrice) * 100, ars: (price - a.buyPrice) * a.qty };
  });

  const filtered = enriched
    .filter(a => a.ticker.includes(search.toUpperCase()) || a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a[sortKey] > b[sortKey] ? sortDir : -sortDir));

  const handleSort = (key) => {
    if (key === 'del') return;
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} style={s.wrap} className="mob-pad">
      <div style={s.topBar}>
        <h2 style={s.title}>Todos los activos</h2>
        <input style={s.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ticker o empresa..." />
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} style={{ ...s.th, cursor: c.key !== 'del' ? 'pointer' : 'default', color: sortKey === c.key ? 'var(--accent)' : 'var(--text2)' }} onClick={() => handleSort(c.key)}>
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <AssetRow key={a.id} asset={a} price={a.price} onRemove={removeAsset} showDelete showDate animDelay={i * 0.03} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={s.empty}>No hay activos{search ? ' que coincidan con la búsqueda' : ''}.</div>}
      </div>
    </motion.div>
  );
}

const s = {
  wrap: { padding: '80px 16px 40px', maxWidth: 1280, margin: '0 auto' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 18, fontWeight: 600 },
  search: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 14px', color: 'var(--text1)', fontSize: 13, outline: 'none', width: 'min(260px, 100%)' },
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, borderBottom: '1px solid var(--border)', userSelect: 'none', whiteSpace: 'nowrap' },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  empty: { textAlign: 'center', padding: '40px', color: 'var(--text2)' },
};
