import { motion } from 'framer-motion';
import { formatARS, formatDate } from '../utils/format';

async function exportExcel(movements, assets, prices) {
  const { utils, writeFile } = await import('xlsx');
  const movData = movements.map(m => ({
    Fecha: formatDate(m.date), Tipo: m.type, Activo: m.name, Ticker: m.ticker,
    Cantidad: m.qty, 'Precio unitario': m.price, 'Total ARS': m.total,
  }));
  const sumData = assets.map(a => ({
    Empresa: a.name, Ticker: a.ticker, 'Precio compra': a.buyPrice,
    'Precio actual': prices[a.id] || a.buyPrice, Cantidad: a.qty,
    'Valor total': (prices[a.id] || a.buyPrice) * a.qty,
    'Rendimiento %': (((prices[a.id] || a.buyPrice) - a.buyPrice) / a.buyPrice * 100).toFixed(2) + '%',
  }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(movData), 'Movimientos');
  utils.book_append_sheet(wb, utils.json_to_sheet(sumData), 'Portfolio');
  writeFile(wb, 'portfolio-finance-mind.xlsx');
}

async function exportPDF(movements) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(28, 138, 255);
  doc.text('Finance Mind — Planilla de Movimientos', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [['Fecha', 'Tipo', 'Activo', 'Ticker', 'Cantidad', 'Precio unit.', 'Total ARS']],
    body: movements.map(m => [formatDate(m.date), m.type, m.name, m.ticker, m.qty, formatARS(m.price), formatARS(m.total)]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [28, 138, 255], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
  });
  doc.save('portfolio-finance-mind.pdf');
}

async function exportWord(movements) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType } = await import('docx');
  const { saveAs } = await import('file-saver');
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Finance Mind — Planilla de Movimientos', bold: true, size: 28, color: '1C8AFF' })] }),
        new Paragraph({ children: [new TextRun({ text: `Generado: ${new Date().toLocaleDateString('es-AR')}`, size: 18, color: '999999' })] }),
        new Paragraph({ text: '' }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: ['Fecha', 'Tipo', 'Activo', 'Ticker', 'Cantidad', 'Precio', 'Total ARS'].map(h =>
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
              ),
            }),
            ...movements.map(m => new TableRow({
              children: [formatDate(m.date), m.type, m.name, m.ticker, String(m.qty), formatARS(m.price), formatARS(m.total)].map(v =>
                new TableCell({ children: [new Paragraph(String(v))] })
              ),
            })),
          ],
        }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'portfolio-finance-mind.docx');
}

export default function Planilla({ movements, assets, prices }) {
  const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} style={s.wrap} className="mob-pad">
      <div style={s.topBar}>
        <h2 style={s.title}>Planilla de movimientos</h2>
        <div style={s.exports}>
          <button style={{ ...s.exportBtn, background: 'rgba(0,176,116,0.1)', color: '#00B074', borderColor: 'rgba(0,176,116,0.2)' }} onClick={() => exportExcel(movements, assets, prices)}>
            ↓ Excel
          </button>
          <button style={{ ...s.exportBtn, background: 'rgba(255,23,68,0.1)', color: 'var(--red)', borderColor: 'rgba(255,23,68,0.2)' }} onClick={() => exportPDF(movements)}>
            ↓ PDF
          </button>
          <button style={{ ...s.exportBtn, background: 'rgba(28,138,255,0.1)', color: 'var(--accent)', borderColor: 'rgba(28,138,255,0.2)' }} onClick={() => exportWord(movements)}>
            ↓ Word
          </button>
        </div>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Fecha', 'Tipo', 'Activo', 'Ticker', 'Cantidad', 'Precio unitario', 'Total ARS'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <motion.tr key={m.id + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <td style={s.td}>{formatDate(m.date)}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: m.type === 'Compra' ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)', color: m.type === 'Compra' ? 'var(--green)' : 'var(--red)', borderColor: m.type === 'Compra' ? 'rgba(0,230,118,0.2)' : 'rgba(255,23,68,0.2)' }}>
                    {m.type}
                  </span>
                </td>
                <td style={s.td}>{m.name}</td>
                <td style={{ ...s.td, fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: 12 }}>{m.ticker}</td>
                <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 13 }}>{m.qty}</td>
                <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 13 }}>{formatARS(m.price)}</td>
                <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600 }}>{formatARS(m.total)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div style={s.empty}>No hay movimientos registrados todavía.</div>}
      </div>
    </motion.div>
  );
}

const s = {
  wrap: { padding: '80px 16px 40px', maxWidth: 1280, margin: '0 auto' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 18, fontWeight: 600 },
  exports: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  exportBtn: { border: '1px solid', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  tableWrap: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 700 },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, borderBottom: '1px solid var(--border)' },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontSize: 13 },
  badge: { padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500, border: '1px solid' },
  empty: { textAlign: 'center', padding: '40px', color: 'var(--text2)' },
};
