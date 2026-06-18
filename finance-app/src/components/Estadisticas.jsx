import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatARS, formatPct } from '../utils/format';
import { GEMINI_COLORS } from '../data/tickers';

const PERIODS = ['Diario', 'Semanal', 'Mensual'];

function genHistory(assets, prices, period) {
  const points = period === 'Diario' ? 24 : period === 'Semanal' ? 7 : 30;
  const labels = Array.from({ length: points }, (_, i) => {
    if (period === 'Diario') return `${i}:00`;
    if (period === 'Semanal') { const d = new Date(); d.setDate(d.getDate() - (points - 1 - i)); return d.toLocaleDateString('es-AR', { weekday: 'short' }); }
    const d = new Date(); d.setDate(d.getDate() - (points - 1 - i)); return d.getDate() + '/' + (d.getMonth() + 1);
  });

  let base = assets.reduce((s, a) => s + a.buyPrice * a.qty, 0) || 100000;
  return labels.map((label, i) => {
    const noise = (Math.random() - 0.48) * 0.02;
    base = base * (1 + noise);
    const pct = ((base - (assets.reduce((s, a) => s + a.buyPrice * a.qty, 0) || 100000)) / (assets.reduce((s, a) => s + a.buyPrice * a.qty, 0) || 100000)) * 100;
    return { label, value: base, pct };
  });
}

const StatCard = ({ label, value, sub, color }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
    <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--text1)' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{sub}</div>}
  </div>
);

const ttStyle = { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--mono)' };

export default function Estadisticas({ assets, prices }) {
  const [period, setPeriod] = useState('Semanal');

  const history = useMemo(() => genHistory(assets, prices, period), [assets, period]);

  const enriched = assets.map(a => {
    const p = prices[a.id] || a.buyPrice;
    return { ...a, pct: ((p - a.buyPrice) / a.buyPrice) * 100 };
  });
  const best = enriched.length ? enriched.reduce((b, a) => a.pct > b.pct ? a : b, enriched[0]) : null;
  const worst = enriched.length ? enriched.reduce((b, a) => a.pct < b.pct ? a : b, enriched[0]) : null;

  const currentVal = assets.reduce((s, a) => s + (prices[a.id] || a.buyPrice) * a.qty, 0);
  const investedVal = assets.reduce((s, a) => s + a.buyPrice * a.qty, 0);
  const totalPct = investedVal > 0 ? ((currentVal - investedVal) / investedVal) * 100 : 0;

  const volatility = history.length > 1 ? (() => {
    const returns = history.slice(1).map((d, i) => (d.value - history[i].value) / history[i].value * 100);
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    return Math.sqrt(returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length).toFixed(2);
  })() : '0.00';

  const maxVal = Math.max(...history.map(d => d.value));
  const minAfterMax = history.slice(history.findIndex(d => d.value === maxVal)).map(d => d.value);
  const maxDrawdown = minAfterMax.length > 0 ? (((Math.min(...minAfterMax) - maxVal) / maxVal) * 100).toFixed(2) : '0.00';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} style={s.wrap} className="mob-pad">
      <div style={s.topBar}>
        <h2 style={s.title}>Estadísticas</h2>
        <div style={s.toggle}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ ...s.toggleBtn, ...(period === p ? s.toggleActive : {}) }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={s.cards}>
        <StatCard label="Mejor activo" value={best ? `${best.ticker} ${formatPct(best.pct)}` : '-'} sub={best?.name} color={best?.pct >= 0 ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="Peor activo" value={worst ? `${worst.ticker} ${formatPct(worst.pct)}` : '-'} sub={worst?.name} color={worst?.pct >= 0 ? 'var(--green)' : 'var(--red)'} />
        <StatCard label="Volatilidad promedio" value={`${volatility}%`} sub="Desviación estándar de retornos" />
        <StatCard label="Máximo drawdown" value={`${maxDrawdown}%`} sub="Mayor caída desde pico" color="var(--red)" />
      </div>

      <div style={s.charts}>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Evolución del portfolio ({period.toLowerCase()})</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'K'} />
              <Tooltip contentStyle={ttStyle} formatter={v => [formatARS(v), 'Valor']} labelStyle={{ color: 'var(--text2)' }} />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={s.chartCard}>
          <div style={s.chartTitle}>Rendimiento acumulado %</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
              <Tooltip contentStyle={ttStyle} formatter={v => [formatPct(v), 'Rendimiento']} labelStyle={{ color: 'var(--text2)' }} />
              <Area type="monotone" dataKey="pct" stroke="var(--accent2)" fill="url(#pctGrad)" strokeWidth={2} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...s.chartCard, gridColumn: '1 / -1' }}>
          <div style={s.chartTitle}>Rendimiento por activo</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={enriched.map(a => ({ name: a.ticker, pct: a.pct, color: a.color }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(1) + '%'} />
              <Tooltip contentStyle={ttStyle} formatter={v => [formatPct(v), 'Rendimiento']} labelStyle={{ color: 'var(--text2)' }} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive>
                {enriched.map((a, i) => <Cell key={a.id} fill={a.pct >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

const s = {
  wrap: { padding: '80px 16px 40px', maxWidth: 1280, margin: '0 auto' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 18, fontWeight: 600 },
  toggle: { display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 2 },
  toggleBtn: { background: 'none', border: 'none', color: 'var(--text2)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  toggleActive: { background: 'var(--surface2)', color: 'var(--text1)', fontWeight: 500 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, marginBottom: 14 },
  charts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 },
  chartCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 12px', transition: 'border-color 0.3s ease-out, box-shadow 0.3s ease-out' },
  chartTitle: { fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 14 },
};
