import { useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { formatARS, formatPct } from '../utils/format';
import AssetRow from './AssetRow';
import AddAssetModal from './AddAssetModal';

const fadeUp = (i = 0) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] } });

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 600 }}>{d.name} <span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 11 }}>{d.ticker}</span></div>
      <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 4 }}>{d.pct.toFixed(2)}%</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{formatARS(d.value)}</div>
    </div>
  );
};

export default function Dashboard({ assets, prices, addAsset, removeAsset }) {
  const [modal, setModal] = useState(false);

  const sorted = [...assets].sort((a, b) => {
    const va = (prices[a.id] || a.buyPrice) * a.qty;
    const vb = (prices[b.id] || b.buyPrice) * b.qty;
    return vb - va;
  });

  const total = sorted.reduce((s, a) => s + (prices[a.id] || a.buyPrice) * a.qty, 0);

  const chartData = sorted.map(a => ({
    id: a.id, ticker: a.ticker, name: a.name, color: a.color,
    value: (prices[a.id] || a.buyPrice) * a.qty,
    pct: total > 0 ? ((prices[a.id] || a.buyPrice) * a.qty / total) * 100 : 0,
  }));

  return (
    <div style={s.wrap} className="mob-pad">
      <motion.div style={s.charts} {...fadeUp(0)}>
        {assets.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: 'var(--text2)', marginBottom: 16 }}>Tu portfolio está vacío</p>
            <button style={s.addBtn} onClick={() => setModal(true)}>+ Agregar primer activo</button>
          </div>
        ) : (
          <>
            <div className="gem-card" style={{ padding: 20 }}>
              <div style={s.cardTitle}>Distribución del portfolio</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="ticker" cx="50%" cy="50%" outerRadius={90} isAnimationActive startAngle={90} endAngle={450}>
                    {chartData.map(d => <Cell key={d.id} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={s.legend}>
                {chartData.map(d => (
                  <div key={d.id} style={s.legendItem}>
                    <div style={{ ...s.dot, background: d.color }} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{d.ticker}</span>
                    <span style={{ color: 'var(--text2)', fontSize: 11 }}>{d.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="gem-card" style={{ padding: 20 }}>
              <div style={s.cardTitle}>Valor por activo (ARS)</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="ticker" tick={{ fill: 'var(--text2)', fontSize: 11, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'K'} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--mono)' }}>
                      {formatARS(payload[0].value)}
                    </div>
                  ) : null} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive>
                    {chartData.map(d => <Cell key={d.id} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </motion.div>

      <motion.div style={s.section} {...fadeUp(1)}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Activos</h2>
          <button style={s.addBtn} onClick={() => setModal(true)}>+ Agregar activo</button>
        </div>
        {sorted.length > 0 && (
          <div style={{ ...s.tableWrap, overflowX: 'auto' }}>
            <table style={{ ...s.table, minWidth: 640 }}>
              <thead>
                <tr>
                  {['Activo', 'Precio compra', 'Precio actual', 'Cantidad', 'Valor total', 'Rendimiento %', 'Rendimiento ARS'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <AssetRow key={a.id} asset={a} price={prices[a.id] || a.buyPrice} onRemove={removeAsset} animDelay={i * 0.05} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <AddAssetModal open={modal} onClose={() => setModal(false)} onAdd={addAsset} />
    </div>
  );
}

const s = {
  wrap: { padding: '80px 16px 40px', maxWidth: 1280, margin: '0 auto' },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 12, marginBottom: 16 },
  cardTitle: { fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 16 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  section: { marginTop: 8 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 600 },
  addBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, borderBottom: '1px solid var(--border)' },
  empty: { gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' },
};
