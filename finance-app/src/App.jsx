import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePortfolio } from './hooks/usePortfolio';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Activos from './components/Activos';
import Estadisticas from './components/Estadisticas';
import Planilla from './components/Planilla';

const NAV = ['Dashboard', 'Activos', 'Estadísticas', 'Planilla'];

const ICONS = {
  Dashboard: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9"/><rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".6"/><rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".6"/><rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9"/></svg>,
  Activos: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  'Estadísticas': <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 15 L7 9 L11 12 L15 5 L18 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Planilla: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 7h6M7 11h6M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

const GeminiBG = () => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', width: '70vw', height: '70vw', maxWidth: 800, maxHeight: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(66,133,244,0.07) 0%, transparent 70%)', top: '-25%', left: '-15%', animation: 'orbMove1 24s ease-in-out infinite alternate', willChange: 'transform' }} />
    <div style={{ position: 'absolute', width: '60vw', height: '60vw', maxWidth: 700, maxHeight: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,188,212,0.06) 0%, transparent 70%)', bottom: '-20%', right: '-10%', animation: 'orbMove2 30s ease-in-out infinite alternate', willChange: 'transform' }} />
    <div style={{ position: 'absolute', width: '45vw', height: '45vw', maxWidth: 550, maxHeight: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,157,88,0.05) 0%, transparent 70%)', top: '40%', left: '38%', animation: 'orbMove3 20s ease-in-out infinite alternate', willChange: 'transform' }} />
    <div style={{ position: 'absolute', width: '35vw', height: '35vw', maxWidth: 450, maxHeight: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,180,0,0.04) 0%, transparent 70%)', top: '5%', right: '10%', animation: 'orbMove4 36s ease-in-out infinite alternate', willChange: 'transform' }} />
  </div>
);

const BottomNav = ({ section, setSection }) => (
  <div className="bottom-nav">
    {NAV.map(item => (
      <button key={item} className={`bnav-btn${section === item ? ' active' : ''}`} onClick={() => setSection(item)}>
        {ICONS[item]}
        <span>{item === 'Estadísticas' ? 'Stats' : item}</span>
      </button>
    ))}
  </div>
);

export default function App() {
  const [section, setSection] = useState('Dashboard');
  const { assets, prices, movements, addAsset, removeAsset, totalInvested, totalCurrent, totalPct, marketStatus, loading } = usePortfolio();

  return (
    <>
      <GeminiBG />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header section={section} setSection={setSection} totalPct={totalPct} totalInvested={totalInvested} marketStatus={marketStatus} loading={loading} />
        <AnimatePresence mode="wait">
          {section === 'Dashboard' && <Dashboard key="dash" assets={assets} prices={prices} addAsset={addAsset} removeAsset={removeAsset} />}
          {section === 'Activos' && <Activos key="act" assets={assets} prices={prices} removeAsset={removeAsset} />}
          {section === 'Estadísticas' && <Estadisticas key="stats" assets={assets} prices={prices} />}
          {section === 'Planilla' && <Planilla key="plan" movements={movements} assets={assets} prices={prices} />}
        </AnimatePresence>
      </div>
      <BottomNav section={section} setSection={setSection} />
    </>
  );
}
