import { motion } from 'framer-motion';
import { formatARS, formatPct } from '../utils/format';

const PieLogo = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="9" fill="#111"/>
    <g transform="translate(18,18)">
      {/* Blue: 0°→150° */}
      <path d="M0,0 L0,-13 A13,13,0,0,1,6.5,11.26 Z" fill="#4285F4"/>
      {/* Green: 150°→270° */}
      <path d="M0,0 L6.5,11.26 A13,13,0,0,1,-13,0 Z" fill="#0F9D58"/>
      {/* Yellow: 270°→330° */}
      <path d="M0,0 L-13,0 A13,13,0,0,1,-6.5,-11.26 Z" fill="#F4B400"/>
      {/* Red small slice (exploded) 330°→360° */}
      <g style={{ animation: 'pieExplode 3.5s ease-in-out infinite', transformOrigin: '0 0' }}>
        <path d="M0,0 L-6.5,-11.26 A13,13,0,0,1,0,-13 Z" fill="#DB4437"/>
      </g>
      {/* Donut hole */}
      <circle cx="0" cy="0" r="5" fill="#111"/>
    </g>
  </svg>
);

const NAV_ITEMS = ['Dashboard', 'Activos', 'Estadísticas', 'Planilla'];

const Dot = ({ on }) => (
  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: on ? 'var(--green)' : 'var(--text3)', boxShadow: on ? '0 0 6px var(--green)' : 'none', flexShrink: 0, animation: on ? 'pulse 2s ease-in-out infinite' : 'none' }} />
);

export default function Header({ section, setSection, totalPct, totalInvested, marketStatus, loading }) {
  return (
    <motion.header
      className="app-header"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={s.left}>
        <PieLogo />
        <span className="gem-text" style={s.brand}>Finance Mind</span>
        {/* Market status badge */}
        {marketStatus && (
          <div style={s.mktBadge} className="hide-mobile">
            <Dot on={marketStatus.open} />
            <span style={{ fontSize: 11, color: marketStatus.open ? 'var(--green)' : 'var(--text2)', fontFamily: 'var(--mono)' }}>
              {marketStatus.label}
            </span>
            {loading && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>↻</span>}
          </div>
        )}
      </div>

      <nav className="nav-links" style={s.nav}>
        {NAV_ITEMS.map(item => (
          <button key={item} className={`nav-btn${section === item ? ' active' : ''}`} onClick={() => setSection(item)}>
            {item}
          </button>
        ))}
      </nav>

      <div className="perf-numbers" style={s.perf}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: totalPct >= 0 ? 'var(--green)' : 'var(--red)', transition: 'color 0.3s ease-out' }}>
          {formatPct(totalPct)} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text2)' }}>desde inicio</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <div style={s.perfTotal}>
          <span style={{ color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invertido</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{formatARS(totalInvested)}</span>
        </div>
      </div>

      {/* Mobile: compact */}
      <div className="mob-perf" style={{ display: 'none' }}>
        {marketStatus && <Dot on={marketStatus.open} />}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: totalPct >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPct(totalPct)}</span>
        {loading && <span style={{ fontSize: 10, color: 'var(--accent)' }}>↻</span>}
      </div>
    </motion.header>
  );
}

const s = {
  left: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  brand: { fontWeight: 700, fontSize: 15 },
  mktBadge: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' },
  nav: { display: 'flex', gap: 2 },
  perf: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  perfTotal: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 },
};
