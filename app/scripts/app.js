(function () {
  'use strict';

  const STORAGE_KEY = 'fm_portfolio';
  const CCL_KEY = 'fm_ccl';
  const DB_PATH = './cedears-db.json';

  const CHART_COLORS = [
    '#1C8AFF', '#00BCD4', '#00E676', '#F4B400', '#DB4437',
    '#9C27B0', '#FF6D00', '#00B0FF', '#76FF03', '#FF4081',
    '#448AFF', '#69F0AE', '#FFD740', '#FF6E40', '#7C4DFF'
  ];

  let cedearsDB = [];
  let portfolio = [];
  let pieChart = null;
  let barChart = null;

  // ── Persistence ──
  function savePortfolio() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  }

  function loadPortfolio() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveCCL(val) {
    localStorage.setItem(CCL_KEY, val);
  }

  function loadCCL() {
    return parseFloat(localStorage.getItem(CCL_KEY)) || 1350;
  }

  // ── DB ──
  async function loadDB() {
    try {
      var data;
      if (typeof CEDEARS_DB !== 'undefined') {
        data = CEDEARS_DB;
      } else {
        const res = await fetch(DB_PATH);
        data = await res.json();
      }
      cedearsDB = data.cedears || [];
      if (data.meta && data.meta.lastPriceUpdate) {
        const d = new Date(data.meta.lastPriceUpdate);
        document.getElementById('lastUpdate').textContent =
          'Precios: ' + d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {
      showToast('No se pudo cargar la base de CEDEARs', 'error');
    }
  }

  function findCedear(ticker) {
    return cedearsDB.find(c => c.ticker.toUpperCase() === ticker.toUpperCase());
  }

  // ── Autocomplete ──
  function initAutocomplete() {
    const input = document.getElementById('tickerInput');
    const list = document.getElementById('autocompleteList');

    input.addEventListener('input', function () {
      const q = this.value.trim().toUpperCase();
      list.innerHTML = '';

      if (q.length < 1) { list.classList.remove('active'); return; }

      const matches = cedearsDB
        .filter(c => c.ticker.toUpperCase().startsWith(q) || c.name.toUpperCase().includes(q))
        .slice(0, 12);

      if (matches.length === 0) { list.classList.remove('active'); return; }

      matches.forEach(c => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        const priceStr = c.lastPrice ? ' · $' + formatNum(c.lastPrice) : '';
        item.innerHTML = `
          <span class="autocomplete-item__ticker">${c.ticker}</span>
          <span class="autocomplete-item__name">${c.name}${priceStr}</span>
        `;
        item.addEventListener('click', () => {
          input.value = c.ticker;
          list.classList.remove('active');
          if (c.lastPrice) {
            document.getElementById('buyPrice').placeholder = formatNum(c.lastPrice);
          }
        });
        list.appendChild(item);
      });

      list.classList.add('active');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ticker-wrapper')) list.classList.remove('active');
    });
  }

  // ── Add Asset ──
  function initForm() {
    const form = document.getElementById('addForm');
    const dateInput = document.getElementById('buyDate');
    dateInput.value = new Date().toISOString().split('T')[0];

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const ticker = document.getElementById('tickerInput').value.trim().toUpperCase();
      const buyPrice = parseFloat(document.getElementById('buyPrice').value);
      const quantity = parseInt(document.getElementById('quantity').value, 10);
      const buyDate = dateInput.value;

      if (!ticker || !buyPrice || !quantity) return;

      const cedear = findCedear(ticker);
      if (!cedear) {
        showToast(`"${ticker}" no se encontró en la base de CEDEARs`, 'error');
        return;
      }

      portfolio.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ticker,
        name: cedear.name,
        buyPrice,
        quantity,
        buyDate,
        sector: cedear.sector,
        ratio: cedear.ratio
      });

      savePortfolio();
      render();
      form.reset();
      dateInput.value = new Date().toISOString().split('T')[0];
      showToast(`${ticker} agregado al portfolio`, 'success');
    });
  }

  function removeAsset(id) {
    portfolio = portfolio.filter(p => p.id !== id);
    savePortfolio();
    render();
  }

  // ── Calculations ──
  function calcHoldings() {
    const ccl = parseFloat(document.getElementById('cclInput').value) || 1350;
    const holdings = [];
    let totalValue = 0;
    let totalCost = 0;

    for (const pos of portfolio) {
      const cedear = findCedear(pos.ticker);
      const currentPrice = cedear && cedear.lastPrice ? cedear.lastPrice : pos.buyPrice;
      const value = currentPrice * pos.quantity;
      const cost = pos.buyPrice * pos.quantity;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

      totalValue += value;
      totalCost += cost;

      holdings.push({
        ...pos,
        currentPrice,
        value,
        cost,
        valueUSD: value / ccl,
        pnl,
        pnlPct,
        sector: cedear ? cedear.sector : pos.sector,
        changePercent: cedear ? cedear.changePercent || 0 : 0
      });
    }

    for (const h of holdings) {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }

    holdings.sort((a, b) => b.value - a.value);

    return { holdings, totalValue, totalCost, totalPnL: totalValue - totalCost, ccl };
  }

  // ── Render ──
  function render() {
    const { holdings, totalValue, totalCost, totalPnL, ccl } = calcHoldings();
    const pnlPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
    const sectors = new Set(holdings.map(h => h.sector));

    document.getElementById('totalARS').textContent = '$' + formatNum(totalValue);
    document.getElementById('totalUSD').textContent = 'US$' + formatNum(totalValue / ccl);

    const pnlEl = document.getElementById('totalPnL');
    pnlEl.textContent = (totalPnL >= 0 ? '+' : '') + '$' + formatNum(totalPnL);
    pnlEl.className = 'summary-card__value ' + (totalPnL >= 0 ? 'pos' : 'neg');

    const pnlPctEl = document.getElementById('totalPnLPct');
    pnlPctEl.textContent = (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2) + '%';
    pnlPctEl.className = 'summary-card__sub mono ' + (pnlPct >= 0 ? 'pos' : 'neg');

    document.getElementById('totalAssets').textContent = holdings.length;
    document.getElementById('totalSectors').textContent = sectors.size + ' sectores';

    renderTable(holdings, ccl);
    renderCharts(holdings);
  }

  function renderTable(holdings, ccl) {
    const container = document.getElementById('holdingsBody');

    if (holdings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <div class="empty-state__title">Tu portfolio está vacío</div>
          <p>Agregá tu primer CEDEAR arriba para empezar a trackear</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <table class="holdings-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Nombre</th>
            <th class="text-right">Cantidad</th>
            <th class="text-right">Precio Compra</th>
            <th class="text-right">Precio Actual</th>
            <th class="text-right">Valor ARS</th>
            <th class="text-right">Valor USD</th>
            <th>Peso</th>
            <th class="text-right">P&L</th>
            <th class="text-right">Hoy</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${holdings.map(h => `
            <tr>
              <td class="ticker-cell">${h.ticker}</td>
              <td class="name-cell">${h.name}</td>
              <td class="text-right mono-cell">${h.quantity}</td>
              <td class="text-right mono-cell">$${formatNum(h.buyPrice)}</td>
              <td class="text-right mono-cell">$${formatNum(h.currentPrice)}</td>
              <td class="text-right mono-cell" style="color:var(--color-text-1);font-weight:600">$${formatNum(h.value)}</td>
              <td class="text-right mono-cell">US$${formatNum(h.valueUSD)}</td>
              <td>
                <div class="weight-bar">
                  <div class="weight-bar__fill" style="width:${Math.max(h.weight, 1)}%"></div>
                  <span class="weight-bar__label">${h.weight.toFixed(1)}%</span>
                </div>
              </td>
              <td class="text-right mono-cell ${h.pnl >= 0 ? 'pos' : 'neg'}">
                ${h.pnl >= 0 ? '+' : ''}$${formatNum(h.pnl)}
                <br><span style="font-size:0.7em">${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%</span>
              </td>
              <td class="text-right mono-cell ${h.changePercent >= 0 ? 'pos' : 'neg'}">
                ${h.changePercent >= 0 ? '+' : ''}${h.changePercent.toFixed(2)}%
              </td>
              <td>
                <button class="btn btn--danger" onclick="window.__removeAsset('${h.id}')" title="Eliminar">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // ── Charts ──
  function renderCharts(holdings) {
    if (holdings.length === 0) {
      if (pieChart) { pieChart.destroy(); pieChart = null; }
      if (barChart) { barChart.destroy(); barChart = null; }
      return;
    }

    const labels = holdings.map(h => h.ticker);
    const values = holdings.map(h => h.value);
    const weights = holdings.map(h => h.weight);
    const colors = holdings.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    const pnlColors = holdings.map(h => h.pnl >= 0 ? 'rgba(0,230,118,0.8)' : 'rgba(255,23,68,0.8)');

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#a0a0a0',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            padding: 12
          }
        }
      }
    };

    // Pie
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: weights,
          backgroundColor: colors,
          borderColor: '#0a0a0a',
          borderWidth: 2,
          hoverBorderColor: '#fff',
          hoverBorderWidth: 2
        }]
      },
      options: {
        ...baseOptions,
        cutout: '55%',
        plugins: {
          ...baseOptions.plugins,
          legend: {
            ...baseOptions.plugins.legend,
            position: holdings.length > 8 ? 'bottom' : 'right'
          },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleColor: '#f5f5f5',
            bodyColor: '#a0a0a0',
            borderColor: 'rgba(28,138,255,0.3)',
            borderWidth: 1,
            titleFont: { family: "'JetBrains Mono', monospace", weight: '700' },
            bodyFont: { family: "'JetBrains Mono', monospace" },
            callbacks: {
              label: function (ctx) {
                const h = holdings[ctx.dataIndex];
                return ` ${h.ticker}: ${h.weight.toFixed(1)}% — $${formatNum(h.value)}`;
              }
            }
          }
        }
      }
    });

    // Bar
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Valor ARS',
          data: values,
          backgroundColor: colors.map(c => c + 'CC'),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...baseOptions,
        indexAxis: holdings.length > 6 ? 'y' : 'x',
        plugins: {
          ...baseOptions.plugins,
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleColor: '#f5f5f5',
            bodyColor: '#a0a0a0',
            borderColor: 'rgba(28,138,255,0.3)',
            borderWidth: 1,
            titleFont: { family: "'JetBrains Mono', monospace", weight: '700' },
            bodyFont: { family: "'JetBrains Mono', monospace" },
            callbacks: {
              label: function (ctx) {
                const h = holdings[ctx.dataIndex];
                const pnlStr = (h.pnl >= 0 ? '+' : '') + '$' + formatNum(h.pnl);
                return ` $${formatNum(h.value)} (${pnlStr})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#555', font: { family: "'JetBrains Mono', monospace", size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: {
              color: '#555',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: function (v) { return '$' + formatCompact(v); }
            },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        }
      }
    });
  }

  // ── Export ──
  function initExport() {
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('exportExcel').addEventListener('click', exportExcel);
    document.getElementById('exportPDF').addEventListener('click', exportPDF);
  }

  function getExportData() {
    const { holdings, totalValue, totalPnL, ccl } = calcHoldings();
    return { holdings, totalValue, totalPnL, ccl };
  }

  function exportCSV() {
    const { holdings, totalValue, totalPnL, ccl } = getExportData();
    if (holdings.length === 0) { showToast('No hay activos para exportar', 'error'); return; }

    const header = 'Ticker,Nombre,Cantidad,Precio Compra ARS,Precio Actual ARS,Valor ARS,Valor USD,Peso %,P&L ARS,P&L %,Sector,Fecha Compra';
    const rows = holdings.map(h =>
      `${h.ticker},"${h.name}",${h.quantity},${h.buyPrice},${h.currentPrice},${h.value.toFixed(2)},${h.valueUSD.toFixed(2)},${h.weight.toFixed(2)},${h.pnl.toFixed(2)},${h.pnlPct.toFixed(2)},${h.sector},${h.buyDate}`
    );
    rows.push('');
    rows.push(`TOTAL,,,,,$${totalValue.toFixed(2)},US$${(totalValue / ccl).toFixed(2)},100%,$${totalPnL.toFixed(2)},,,`);

    const csv = [header, ...rows].join('\n');
    downloadFile(csv, 'finance-mind-portfolio.csv', 'text/csv');
    showToast('CSV exportado', 'success');
  }

  function exportExcel() {
    const { holdings, totalValue, totalPnL, ccl } = getExportData();
    if (holdings.length === 0) { showToast('No hay activos para exportar', 'error'); return; }

    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

    xml += '<Styles>\n';
    xml += '<Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#1a1a1a" ss:Pattern="Solid"/></Style>\n';
    xml += '<Style ss:ID="pos"><Font ss:Color="#00E676"/></Style>\n';
    xml += '<Style ss:ID="neg"><Font ss:Color="#FF1744"/></Style>\n';
    xml += '<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>\n';
    xml += '<Style ss:ID="pct"><NumberFormat ss:Format="0.00%"/></Style>\n';
    xml += '<Style ss:ID="total"><Font ss:Bold="1" ss:Size="12"/><Interior ss:Color="#111111" ss:Pattern="Solid"/></Style>\n';
    xml += '</Styles>\n';

    xml += '<Worksheet ss:Name="Portfolio">\n<Table>\n';
    xml += '<Column ss:Width="60"/><Column ss:Width="180"/><Column ss:Width="70"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="110"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="100"/><Column ss:Width="90"/>\n';

    const headers = ['Ticker', 'Nombre', 'Cantidad', 'Precio Compra', 'Precio Actual', 'Valor ARS', 'Valor USD', 'Peso %', 'P&L ARS', 'P&L %', 'Sector', 'Fecha Compra'];
    xml += '<Row>';
    headers.forEach(h => { xml += `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`; });
    xml += '</Row>\n';

    holdings.forEach(h => {
      const style = h.pnl >= 0 ? 'pos' : 'neg';
      xml += '<Row>';
      xml += `<Cell><Data ss:Type="String">${h.ticker}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${h.name}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="Number">${h.quantity}</Data></Cell>`;
      xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${h.buyPrice}</Data></Cell>`;
      xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${h.currentPrice}</Data></Cell>`;
      xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${h.value.toFixed(2)}</Data></Cell>`;
      xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${h.valueUSD.toFixed(2)}</Data></Cell>`;
      xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${(h.weight / 100).toFixed(4)}</Data></Cell>`;
      xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${h.pnl.toFixed(2)}</Data></Cell>`;
      xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${(h.pnlPct / 100).toFixed(4)}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${h.sector}</Data></Cell>`;
      xml += `<Cell><Data ss:Type="String">${h.buyDate}</Data></Cell>`;
      xml += '</Row>\n';
    });

    xml += '<Row></Row>\n';
    xml += '<Row>';
    xml += `<Cell ss:StyleID="total"><Data ss:Type="String">TOTAL</Data></Cell>`;
    xml += '<Cell></Cell><Cell></Cell><Cell></Cell><Cell></Cell>';
    xml += `<Cell ss:StyleID="total"><Data ss:Type="Number">${totalValue.toFixed(2)}</Data></Cell>`;
    xml += `<Cell ss:StyleID="total"><Data ss:Type="Number">${(totalValue / ccl).toFixed(2)}</Data></Cell>`;
    xml += '<Cell></Cell>';
    xml += `<Cell ss:StyleID="total"><Data ss:Type="Number">${totalPnL.toFixed(2)}</Data></Cell>`;
    xml += '<Cell></Cell><Cell></Cell><Cell></Cell>';
    xml += '</Row>\n';

    xml += '</Table>\n</Worksheet>\n</Workbook>';
    downloadFile(xml, 'finance-mind-portfolio.xls', 'application/vnd.ms-excel');
    showToast('Excel exportado', 'success');
  }

  function exportPDF() {
    const { holdings, totalValue, totalPnL, ccl } = getExportData();
    if (holdings.length === 0) { showToast('No hay activos para exportar', 'error'); return; }

    const pnlPct = holdings.reduce((s, h) => s + h.cost, 0);
    const totalPnLPct = pnlPct > 0 ? (totalPnL / pnlPct) * 100 : 0;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Finance Mind — Portfolio</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #111; padding: 40px; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 13px; margin-bottom: 32px; }
      .summary { display: flex; gap: 24px; margin-bottom: 32px; }
      .summary-item { background: #f5f5f5; padding: 16px 20px; border-radius: 8px; flex: 1; }
      .summary-item .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.1em; }
      .summary-item .val { font-size: 22px; font-weight: 700; margin-top: 4px; }
      .pos { color: #0a8a3e; } .neg { color: #c41e3a; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #ddd; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.08em; }
      td { padding: 10px 8px; border-bottom: 1px solid #eee; }
      .r { text-align: right; }
      .b { font-weight: 600; }
      .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; }
    </style></head><body>
    <h1>Finance Mind — Portfolio</h1>
    <div class="sub">Generado el ${new Date().toLocaleDateString('es-AR')} · CCL: $${formatNum(ccl)}</div>
    <div class="summary">
      <div class="summary-item"><div class="label">Valor Total ARS</div><div class="val">$${formatNum(totalValue)}</div></div>
      <div class="summary-item"><div class="label">Valor Total USD</div><div class="val">US$${formatNum(totalValue / ccl)}</div></div>
      <div class="summary-item"><div class="label">Ganancia/Pérdida</div><div class="val ${totalPnL >= 0 ? 'pos' : 'neg'}">${totalPnL >= 0 ? '+' : ''}$${formatNum(totalPnL)} (${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%)</div></div>
    </div>
    <table>
      <thead><tr><th>Ticker</th><th>Nombre</th><th class="r">Cant.</th><th class="r">Compra</th><th class="r">Actual</th><th class="r">Valor ARS</th><th class="r">Valor USD</th><th class="r">Peso</th><th class="r">P&L</th></tr></thead>
      <tbody>
        ${holdings.map(h => `<tr>
          <td class="b">${h.ticker}</td>
          <td>${h.name}</td>
          <td class="r">${h.quantity}</td>
          <td class="r">$${formatNum(h.buyPrice)}</td>
          <td class="r">$${formatNum(h.currentPrice)}</td>
          <td class="r b">$${formatNum(h.value)}</td>
          <td class="r">US$${formatNum(h.valueUSD)}</td>
          <td class="r">${h.weight.toFixed(1)}%</td>
          <td class="r ${h.pnl >= 0 ? 'pos' : 'neg'}">${h.pnl >= 0 ? '+' : ''}$${formatNum(h.pnl)} (${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%)</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">Finance Mind — Portfolio Tracker de CEDEARs · Los precios tienen 20 min de delay (Open BYMA Data) · No constituye asesoramiento financiero</div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.addEventListener('load', () => { w.print(); });
    }
    showToast('PDF abierto para imprimir', 'success');
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob(['﻿' + content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Utils ──
  function formatNum(n) {
    if (n == null || isNaN(n)) return '0';
    return Math.abs(n) >= 1
      ? n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : n.toFixed(2);
  }

  function formatCompact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toString();
  }

  function showToast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast visible toast--' + type;
    setTimeout(() => { el.className = 'toast'; }, 3000);
  }

  // ── CCL listener ──
  function initCCL() {
    const input = document.getElementById('cclInput');
    input.value = loadCCL();
    input.addEventListener('change', () => {
      saveCCL(input.value);
      render();
    });
  }

  // ── Dólares ──
  const DOLAR_NAMES = {
    'oficial': 'Dólar Oficial',
    'blue': 'Dólar Blue',
    'bolsa': 'Dólar MEP',
    'contadoconliqui': 'Dólar CCL',
    'tarjeta': 'Dólar Tarjeta',
    'mayorista': 'Dólar Mayorista',
    'cripto': 'Dólar Cripto'
  };

  async function loadDolares() {
    var grid = document.getElementById('dolaresGrid');
    var updateEl = document.getElementById('dolaresUpdate');
    try {
      var res = await fetch('https://dolarapi.com/v1/dolares');
      var dolares = await res.json();
      grid.innerHTML = '';
      dolares.forEach(function (d) {
        var name = DOLAR_NAMES[d.casa] || d.nombre || d.casa;
        var compra = d.compra ? d.compra.toLocaleString('es-AR') : '—';
        var venta = d.venta ? d.venta.toLocaleString('es-AR') : '—';
        var spread = (d.compra && d.venta) ? '$' + (d.venta - d.compra).toLocaleString('es-AR') + ' spread' : '';
        var card = document.createElement('div');
        card.className = 'dolar-card';
        card.innerHTML =
          '<span class="dolar-card__name">' + name + '</span>' +
          '<div class="dolar-card__prices">' +
            '<div class="dolar-card__price-group">' +
              '<span class="dolar-card__label">Compra</span>' +
              '<span class="dolar-card__value">$' + compra + '</span>' +
            '</div>' +
            '<div class="dolar-card__price-group">' +
              '<span class="dolar-card__label">Venta</span>' +
              '<span class="dolar-card__value">$' + venta + '</span>' +
            '</div>' +
          '</div>' +
          (spread ? '<div class="dolar-card__spread">' + spread + '</div>' : '');
        grid.appendChild(card);
      });
      var now = new Date();
      updateEl.textContent = 'Actualizado: ' + now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      grid.innerHTML = '<div class="dolar-card dolar-card--loading"><span class="dolar-card__name">No se pudieron cargar las cotizaciones</span></div>';
      updateEl.textContent = 'Sin conexión';
    }
  }

  // ── Global ──
  window.__removeAsset = removeAsset;

  // ── Init ──
  async function init() {
    await loadDB();
    portfolio = loadPortfolio();
    initAutocomplete();
    initForm();
    initExport();
    initCCL();
    render();
    loadDolares();
  }

  init();
})();
