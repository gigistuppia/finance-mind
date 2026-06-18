import { useRef, useEffect, useState } from 'react';
import { formatARS, formatPct, formatDate } from '../utils/format';

export default function AssetRow({ asset, price, onRemove, showDelete = false, showDate = false, animDelay = 0 }) {
  const pct = ((price - asset.buyPrice) / asset.buyPrice) * 100;
  const ars = (price - asset.buyPrice) * asset.qty;
  const isPos = pct >= 0;
  const prevRef = useRef(price);
  const flashRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay * 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (flashRef.current && price !== prevRef.current) {
      flashRef.current.style.background = isPos ? 'rgba(0,230,118,0.07)' : 'rgba(255,23,68,0.07)';
      setTimeout(() => { if (flashRef.current) flashRef.current.style.background = 'transparent'; }, 200);
    }
    prevRef.current = price;
  }, [price]);

  return (
    <tr ref={flashRef} style={{ transition: 'background 0.2s ease-out, opacity 0.3s ease-out', cursor: 'default', opacity: visible ? 1 : 0 }}>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ ...dot, background: asset.color }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{asset.name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{asset.ticker}</div>
          </div>
        </div>
      </td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text2)' }}>{formatARS(asset.buyPrice)}</td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13 }}>{formatARS(price)}</td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13 }}>{asset.qty}</td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13 }}>{formatARS(price * asset.qty)}</td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13, color: isPos ? 'var(--green)' : 'var(--red)', transition: 'color 0.3s ease-out' }}>
        {formatPct(pct)}
      </td>
      <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 13, color: isPos ? 'var(--green)' : 'var(--red)', transition: 'color 0.3s ease-out' }}>
        {isPos ? '+' : ''}{formatARS(ars)}
      </td>
      {showDate && (
        <td style={{ ...td, color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--mono)' }}>{formatDate(asset.buyDate)}</td>
      )}
      {showDelete && (
        <td style={td}>
          <button onClick={() => onRemove(asset.id)} style={delBtn}>✕</button>
        </td>
      )}
    </tr>
  );
}

const td = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const dot = { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 };
const delBtn = { background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.2)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' };
