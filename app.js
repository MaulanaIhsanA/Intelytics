/* ============================================================
   4. GLOBAL STATE
   ============================================================ */
const state = {
  rangeMode: '1Y',
  rangeFrom: null, rangeTo: null,
  marketAsset: 'gold',
  volWindow: 7,
  histAsset: 'gold', histFrom: null, histTo: null, histFreq: 'daily',
  histSearch: '', histSortCol: 'date', histSortDir: 'desc', histPage: 1, histPageSize: 15
};
function presetToRange(mode){
  const to = LAST.date;
  let from;
  const y = to.getFullYear();
  switch(mode){
    case '7D': from = new Date(to.getTime() - 7*DAY_MS); break;
    case '1M': from = new Date(to.getTime() - 30*DAY_MS); break;
    case '3M': from = new Date(to.getTime() - 91*DAY_MS); break;
    case '6M': from = new Date(to.getTime() - 182*DAY_MS); break;
    case 'YTD': from = new Date(y,0,1); break;
    case '1Y': from = new Date(to.getTime() - 365*DAY_MS); break;
    case '3Y': from = new Date(to.getTime() - 3*365*DAY_MS); break;
    case '5Y': from = new Date(to.getTime() - 5*365*DAY_MS); break;
    case 'MAX': from = FIRST.date; break;
    default: from = new Date(to.getTime() - 365*DAY_MS);
  }
  if (from.getTime() < FIRST.t) from = FIRST.date;
  return { from, to };
}
{
  const r = presetToRange('1Y');
  state.rangeFrom = r.from; state.rangeTo = r.to;
  state.histFrom = r.from; state.histTo = LAST.date;
}

/* ============================================================
   5. CHART REGISTRY
   ============================================================ */
const charts = {};
function killChart(id){ if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
const GOLD = '#AD8A42', NAVY = '#151D2B', GREEN = '#2E7D5B', RED = '#B8483A';
const xTick = d => d.toLocaleDateString('id-ID', {day:'2-digit', month:'short'});
const xTooltip = d => fmtDateLong(d);

/* ============================================================
   6. RENDER: OVERVIEW
   ============================================================ */
function sparkPath(vals, w=88, h=32){
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max-min) || 1;
  return vals.map((v,i) => {
    const x = (i/(vals.length-1)) * w;
    const y = h - ((v-min)/range) * h;
    return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
function kpiCard({label, value, changePct, spark, up, foot}){
  const dir = up ? 'up' : 'down';
  const arrow = up ? '▲' : '▼';
  const color = up ? GREEN : RED;
  return `<div class="card card-hover">
    <div class="card-label">${label}</div>
    <div class="kpi-value num">${value}</div>
    <div class="kpi-sub">
      <span class="kpi-change ${dir} num">${arrow} ${changePct}</span>
      <svg class="kpi-spark" viewBox="0 0 88 32" preserveAspectRatio="none"><path d="${sparkPath(spark)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="kpi-foot">${foot}</div>
  </div>`;
}
function renderKPIs(){
  const rows = filterRange(state.rangeFrom, state.rangeTo);
  const prevIdx = Math.max(0, DATA.indexOf(LAST) - 1);
  const prevGold = DATA[prevIdx].gold, prevUsd = DATA[prevIdx].usd;
  const goldChg = LAST.gold - prevGold, goldPct = goldChg/prevGold*100;
  const usdChg = LAST.usd - prevUsd, usdPct = usdChg/prevUsd*100;
  const spark30 = DATA.slice(-30);
  const statsGold = computeStats(rows, 'gold');
  const rets = dailyReturns(seriesOf(rows,'gold'));
  const vol = stddev(rets) * Math.sqrt(252) * 100;

  const html = [
    kpiCard({label:'ANTAM GOLD · 1 GRAM', value: fmtIDR(LAST.gold), changePct: fmtPct(goldPct), up: goldChg>=0,
      spark: spark30.map(d=>d.gold), foot:'Perubahan harian'}),
    kpiCard({label:'USD / IDR', value: 'Rp'+fmtNum(LAST.usd), changePct: fmtPct(usdPct), up: usdChg>=0,
      spark: spark30.map(d=>d.usd), foot:'Perubahan harian'}),
    `<div class="card card-hover">
      <div class="card-label">PERIOD RETURN <span style="font-weight:500;color:var(--ink-faint)">(${state.rangeMode})</span></div>
      <div class="kpi-value num" style="color:${statsGold.pctChange>=0?GREEN:RED}">${fmtPct(statsGold.pctChange)}</div>
      <div class="kpi-foot">Emas Antam, periode terpilih</div>
    </div>`,
    `<div class="card card-hover">
      <div class="card-label">VOLATILITY</div>
      <div class="kpi-value num">${vol.toFixed(2)}%</div>
      <div class="kpi-foot">Tahunan, dari periode terpilih</div>
    </div>`
  ].join('');
  document.getElementById('kpiGrid').innerHTML = html;
}
function renderOverviewChart(){
  const rows = filterRange(state.rangeFrom, state.rangeTo);
  killChart('overview');
  charts.overview = MiniChart.line(document.getElementById('overviewChart'), {
    labels: rows.map(r=>r.date),
    datasets:[
      {label:'ANTAM Gold', data: normalize(seriesOf(rows,'gold')), color: GOLD, area:true, tooltipFormat: v=>v.toFixed(1)},
      {label:'USD/IDR', data: normalize(seriesOf(rows,'usd')), color: NAVY, dashed:true, tooltipFormat: v=>v.toFixed(1)}
    ],
    xFormat: xTick, xTooltipFormat: xTooltip, yFormat: v => v.toFixed(0)
  });
}
function renderOverviewTable(){
  const rows = filterRange(state.rangeFrom, state.rangeTo).slice(-10).reverse();
  let head = '<thead><tr><th>Tanggal</th><th>ANTAM Gold</th><th>USD/IDR</th><th>Perubahan Emas</th></tr></thead>';
  let body = '<tbody>' + rows.map((r) => {
    const idx = DATA.indexOf(r);
    const prev = DATA[idx-1];
    const chg = prev ? (r.gold-prev.gold)/prev.gold*100 : 0;
    return `<tr><td>${fmtDateShort(r.date)}</td><td class="num">${fmtIDR(r.gold)}</td><td class="num">Rp${fmtNum(r.usd)}</td><td class="num ${chg>=0?'change-pos':'change-neg'}">${fmtPct(chg)}</td></tr>`;
  }).join('') + '</tbody>';
  document.getElementById('overviewTable').innerHTML = head + body;
}
function overviewInsightsRender(){
  const rows = filterRange(state.rangeFrom, state.rangeTo);
  const gStats = computeStats(rows, 'gold');
  const uStats = computeStats(rows, 'usd');
  const rel = gStats.pctChange - uStats.pctChange;
  const pos = (LAST.gold - gStats.min) / ((gStats.max - gStats.min) || 1) * 100;
  const cards = [
    {t:'Market Trend', d:`ANTAM Gold ${gStats.pctChange>=0?'naik':'turun'} ${Math.abs(gStats.pctChange).toFixed(2)}% selama periode terpilih (${rangeLabel()}).`},
    {t:'Relative Performance', d:`Emas ${rel>=0?'mengungguli':'tertinggal dari'} USD/IDR sebesar ${Math.abs(rel).toFixed(2)} poin persentase pada periode yang sama.`},
    {t:'Historical Position', d:`Harga emas saat ini berada pada persentil ${pos.toFixed(0)}% dari kisaran harga selama periode terpilih.`}
  ];
  document.getElementById('overviewInsights').innerHTML = cards.map(c => `
    <div style="display:flex; gap:12px; align-items:flex-start;">
      <div style="width:8px; height:8px; border-radius:50%; background:var(--gold); margin-top:6px; flex-shrink:0;"></div>
      <div><div style="font-size:12px; font-weight:700; color:var(--gold-deep); margin-bottom:3px;">${c.t}</div><div style="font-size:13.5px; color:var(--ink); line-height:1.55;">${c.d}</div></div>
    </div>`).join('');
}
function rangeLabel(){
  const labels = {'7D':'7 hari terakhir','1M':'1 bulan terakhir','3M':'3 bulan terakhir','6M':'6 bulan terakhir','YTD':'tahun berjalan','1Y':'1 tahun terakhir','3Y':'3 tahun terakhir','5Y':'5 tahun terakhir','MAX':'seluruh riwayat data'};
  return labels[state.rangeMode] || `${fmtDateShort(state.rangeFrom)} – ${fmtDateShort(state.rangeTo)}`;
}
function renderOverview(){ renderKPIs(); renderOverviewChart(); renderOverviewTable(); overviewInsightsRender(); }

/* ============================================================
   7. RENDER: MARKETS
   ============================================================ */
function renderMarkets(){
  const rows = filterRange(state.rangeFrom, state.rangeTo);
  killChart('markets');
  let datasets;
  if (state.marketAsset === 'both'){
    datasets = [
      {label:'ANTAM Gold', data: normalize(seriesOf(rows,'gold')), color: GOLD, area:true, tooltipFormat:v=>v.toFixed(1)},
      {label:'USD/IDR', data: normalize(seriesOf(rows,'usd')), color: NAVY, dashed:true, tooltipFormat:v=>v.toFixed(1)}
    ];
  } else if (state.marketAsset === 'gold'){
    datasets = [{label:'ANTAM Gold (Rp/gram)', data: seriesOf(rows,'gold'), color: GOLD, area:true, tooltipFormat: v=>fmtIDR(v)}];
  } else {
    datasets = [{label:'USD/IDR (Rp)', data: seriesOf(rows,'usd'), color: NAVY, area:true, tooltipFormat: v=>'Rp'+fmtNum(v)}];
  }
  charts.markets = MiniChart.line(document.getElementById('marketsChart'), {
    labels: rows.map(r=>r.date), datasets,
    xFormat: xTick, xTooltipFormat: xTooltip,
    yFormat: v => state.marketAsset === 'both' ? v.toFixed(0) : (v >= 1000 ? (v/1000).toFixed(0)+'rb' : v.toFixed(0))
  });

  const key = state.marketAsset === 'usd' ? 'usd' : 'gold';
  const stats = computeStats(rows, key);
  document.getElementById('mkStart').textContent = fmtAsset(key, stats.first);
  document.getElementById('mkEnd').textContent = fmtAsset(key, stats.last);
  const chgEl = document.getElementById('mkChange');
  chgEl.textContent = fmtPct(stats.pctChange);
  chgEl.style.color = stats.pctChange >= 0 ? GREEN : RED;
}

/* ============================================================
   8. RENDER: HISTORICAL
   ============================================================ */
function aggregate(rows, freq, key){
  if (freq === 'daily') return rows.map(r => ({date:r.date, value:r[key], t:r.t}));
  const groups = {};
  rows.forEach(r => {
    const k = freq === 'monthly' ? `${r.date.getFullYear()}-${String(r.date.getMonth()+1).padStart(2,'0')}` : `${r.date.getFullYear()}`;
    groups[k] = r;
  });
  return Object.values(groups).sort((a,b)=>a.t-b.t).map(r => ({date:r.date, value:r[key], t:r.t}));
}
function renderHistorical(){
  const rows = filterRange(state.histFrom, state.histTo);
  let agg = aggregate(rows, state.histFreq, state.histAsset);
  agg = agg.map((d,i,arr) => {
    const prev = arr[i-1];
    const chg = prev ? d.value - prev.value : 0;
    const pct = prev ? chg/prev.value*100 : 0;
    return {...d, chg, pct};
  });
  if (state.histSearch.trim()){
    const q = state.histSearch.trim().toLowerCase();
    agg = agg.filter(d => toDateStr(d.date).includes(q) || fmtDateShort(d.date).toLowerCase().includes(q));
  }
  agg.sort((a,b) => {
    const dir = state.histSortDir === 'asc' ? 1 : -1;
    if (state.histSortCol === 'date') return (a.date - b.date) * dir;
    if (state.histSortCol === 'price') return (a.value - b.value) * dir;
    if (state.histSortCol === 'chg') return (a.chg - b.chg) * dir;
    return (a.pct - b.pct) * dir;
  });

  const table = document.getElementById('histTable');
  if (!agg.length){
    table.style.display = 'none';
    document.getElementById('histEmpty').style.display = 'block';
    document.getElementById('histEmpty').innerHTML = emptyState('Tidak ada data untuk filter ini', 'Coba ubah rentang tanggal, aset, atau kata kunci pencarian.');
    document.getElementById('histCount').textContent = '0 baris ditemukan';
    document.getElementById('histPager').innerHTML = '';
    return;
  }
  table.style.display = 'table';
  document.getElementById('histEmpty').style.display = 'none';

  const total = agg.length;
  const pages = Math.max(1, Math.ceil(total / state.histPageSize));
  state.histPage = Math.min(state.histPage, pages);
  const startIdx = (state.histPage-1) * state.histPageSize;
  const pageRows = agg.slice(startIdx, startIdx + state.histPageSize);

  const arrow = (col) => state.histSortCol === col ? (state.histSortDir === 'asc' ? ' ↑' : ' ↓') : '';
  table.innerHTML = `<thead><tr>
      <th data-sort="date">Tanggal${arrow('date')}</th>
      <th data-sort="price">Harga${arrow('price')}</th>
      <th data-sort="chg">Perubahan Harian${arrow('chg')}</th>
      <th data-sort="pct">Perubahan %${arrow('pct')}</th>
    </tr></thead>
    <tbody>${pageRows.map(d => `<tr>
      <td>${fmtDateShort(d.date)}</td>
      <td class="num">${fmtAsset(state.histAsset, d.value)}</td>
      <td class="num ${d.chg>=0?'change-pos':'change-neg'}">${d.chg===0?'—':(d.chg>=0?'+':'')+fmtNum(d.chg)}</td>
      <td class="num ${d.pct>=0?'change-pos':'change-neg'}">${fmtPct(d.pct)}</td>
    </tr>`).join('')}</tbody>`;
  table.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (state.histSortCol === col) state.histSortDir = state.histSortDir === 'asc' ? 'desc' : 'asc';
    else { state.histSortCol = col; state.histSortDir = 'desc'; }
    renderHistorical();
  }));

  document.getElementById('histCount').textContent = `${total.toLocaleString('id-ID')} baris ditemukan · halaman ${state.histPage} dari ${pages}`;
  const pager = document.getElementById('histPager');
  pager.innerHTML = '';
  const mkBtn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'btn-outline'; b.textContent = label; b.style.padding = '7px 12px';
    if (active) { b.style.background='var(--navy)'; b.style.color='#fff'; b.style.borderColor='var(--navy)'; }
    if (disabled) { b.disabled = true; b.style.opacity = 0.4; }
    b.addEventListener('click', () => { state.histPage = page; renderHistorical(); });
    return b;
  };
  pager.appendChild(mkBtn('‹ Prev', state.histPage-1, state.histPage<=1, false));
  const windowSize = 5;
  let s = Math.max(1, state.histPage - 2), e = Math.min(pages, s + windowSize - 1);
  s = Math.max(1, e - windowSize + 1);
  for (let p = s; p <= e; p++) pager.appendChild(mkBtn(String(p), p, false, p===state.histPage));
  pager.appendChild(mkBtn('Next ›', state.histPage+1, state.histPage>=pages, false));

  window._histExportRows = agg;
}
function emptyState(title, sub){
  return `<div class="empty-state">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <h4>${title}</h4><p>${sub}</p></div>`;
}
function exportCSV(){
  const rows = window._histExportRows || [];
  const head = 'Tanggal,Harga,Perubahan Harian,Perubahan %\n';
  const body = rows.map(d => `${toDateStr(d.date)},${Math.round(d.value)},${Math.round(d.chg)},${d.pct.toFixed(2)}`).join('\n');
  const blob = new Blob([head+body], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `intelytics-${state.histAsset}-${state.histFreq}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   9. RENDER: ANALYTICS
   ============================================================ */
function statCell(label, value){ return `<div class="stat-cell"><div class="sl">${label}</div><div class="sv num">${value}</div></div>`; }
function renderAnalytics(){
  const rows = filterRange(state.rangeFrom, state.rangeTo);
  const s = computeStats(rows, 'gold');
  document.getElementById('perfStats').innerHTML = [
    statCell('Initial Price', fmtIDR(s.first)),
    statCell('Current Price', fmtIDR(s.last)),
    statCell('Absolute Change', (s.change>=0?'+':'') + fmtIDR(s.change)),
    statCell('Percentage Return', fmtPct(s.pctChange)),
    statCell('Average Price', fmtIDR(s.avg)),
    statCell('Median Price', fmtIDR(s.median)),
    statCell('Highest Price', fmtIDR(s.max)),
    statCell('Lowest Price', fmtIDR(s.min)),
    statCell('CAGR', fmtPct(s.cagr)),
    statCell('Maximum Drawdown', fmtPct(s.maxDrawdown)),
    statCell('Volatility (annualized)', s.volatility.toFixed(2)+'%'),
    statCell('Std. Deviation', fmtIDR(s.stdDev))
  ].join('');

  killChart('cum');
  charts.cum = MiniChart.line(document.getElementById('cumChart'), {
    labels: rows.map(r=>r.date),
    datasets:[
      {label:'ANTAM Gold', data: normalize(seriesOf(rows,'gold')), color: GOLD, area:true, tooltipFormat: v=>v.toFixed(1)},
      {label:'USD/IDR', data: normalize(seriesOf(rows,'usd')), color: NAVY, dashed:true, tooltipFormat: v=>v.toFixed(1)}
    ],
    xFormat: xTick, xTooltipFormat: xTooltip, yFormat: v => v.toFixed(0)
  });
  const gS = computeStats(rows,'gold'), uS = computeStats(rows,'usd');
  const goldIdx = 100 * (gS.last/gS.first), usdIdx = 100 * (uS.last/uS.first);
  const winner = goldIdx >= usdIdx ? 'ANTAM Gold' : 'USD/IDR';
  document.getElementById('cumInsight').textContent =
    `${winner} mengungguli sepanjang periode terpilih — indeks akhir ANTAM Gold ${goldIdx.toFixed(1)} vs USD/IDR ${usdIdx.toFixed(1)} (basis 100 di awal periode).`;

  const dd = drawdownSeries(rows, 'gold');
  killChart('dd');
  charts.dd = MiniChart.line(document.getElementById('ddChart'), {
    labels: dd.map(d=>d.date),
    datasets:[{label:'Drawdown Emas', data: dd.map(d=>d.dd), color: RED, area:true, tooltipFormat: v=>v.toFixed(2)+'%'}],
    xFormat: xTick, xTooltipFormat: xTooltip, yFormat: v => v.toFixed(0)+'%', legend:false
  });
  const currentDD = dd[dd.length-1].dd;
  document.getElementById('ddInsight').textContent =
    `ANTAM Gold saat ini berada ${Math.abs(currentDD).toFixed(2)}% di bawah puncak historisnya dalam periode terpilih (maximum drawdown: ${Math.abs(gS.maxDrawdown).toFixed(2)}%).`;

  renderVolatility(rows);
  renderCorrelation(rows);
  renderDeepInsights(rows, gS, uS);
}
function renderVolatility(rows){
  const vol = rollingVolatility(rows, 'gold', state.volWindow);
  killChart('vol');
  charts.vol = MiniChart.line(document.getElementById('volChart'), {
    labels: vol.map(v=>v.date),
    datasets:[{label:`Volatilitas ${state.volWindow}D`, data: vol.map(v=>v.vol), color: GOLD, area:true, tooltipFormat: v=>v.toFixed(2)+'%'}],
    xFormat: xTick, xTooltipFormat: xTooltip, yFormat: v => v.toFixed(0)+'%', legend:false
  });
  const vals = vol.map(v=>v.vol);
  document.getElementById('volCurrent').textContent = (vals[vals.length-1]||0).toFixed(2)+'%';
  document.getElementById('volAvg').textContent = mean(vals).toFixed(2)+'%';
  document.getElementById('volMax').textContent = Math.max(...vals,0).toFixed(2)+'%';
}
function renderCorrelation(rows){
  const goldRet = dailyReturns(seriesOf(rows,'gold')).map(r=>r*100);
  const usdRet = dailyReturns(seriesOf(rows,'usd')).map(r=>r*100);
  killChart('corr');
  charts.corr = MiniChart.scatter(document.getElementById('corrChart'), {
    points: usdRet.map((x,i)=>({x, y: goldRet[i]})),
    color: GOLD, xLabel: 'USD/IDR return harian (%) · Gold return harian (%) pada sumbu Y',
    tooltipFormat: p => `USD/IDR ${p.x.toFixed(2)}%, Gold ${p.y.toFixed(2)}%`
  });
  const r = pearson(usdRet, goldRet);
  const rs = spearman(usdRet, goldRet);
  document.getElementById('pearsonPill').textContent = `Pearson ${r.toFixed(2)}`;
  document.getElementById('spearmanPill').textContent = `Spearman ${rs.toFixed(2)}`;
  const label = correlationLabel(r);
  const pill = document.getElementById('corrInterpret');
  pill.textContent = label;
  pill.className = 'pill ' + (label.includes('Strong Positive')||label.includes('Moderate Positive') ? 'strong-pos' : label.includes('Negative') && !label.includes('Weak') ? 'strong-neg' : '');
}
function renderDeepInsights(rows, gS, uS){
  const vol = rollingVolatility(rows,'gold',30).map(v=>v.vol);
  const half = Math.floor(vol.length/2);
  const firstHalf = mean(vol.slice(0,half).length ? vol.slice(0,half) : [0]);
  const secondHalf = mean(vol.slice(half).length ? vol.slice(half) : [0]);
  const volTrend = secondHalf >= firstHalf ? 'meningkat' : 'menurun';
  const dd = drawdownSeries(rows,'gold');
  const currentDD = dd[dd.length-1].dd;
  const pos = (LAST.gold - gS.min)/((gS.max-gS.min)||1)*100;
  const rel = gS.pctChange - uS.pctChange;
  const items = [
    {icon:'trend', t:'MARKET TREND', d:`ANTAM Gold ${gS.pctChange>=0?'naik':'turun'} ${Math.abs(gS.pctChange).toFixed(2)}% selama periode terpilih.`},
    {icon:'rel', t:'RELATIVE PERFORMANCE', d:`Emas ${rel>=0?'mengungguli':'tertinggal dari'} USD/IDR sebesar ${Math.abs(rel).toFixed(2)} poin persentase pada periode yang sama.`},
    {icon:'vol', t:'VOLATILITY', d:`Volatilitas pasar ${volTrend} pada paruh kedua periode terpilih dibanding paruh pertama.`},
    {icon:'pos', t:'HISTORICAL POSITION', d:`Harga emas saat ini berada pada persentil ${pos.toFixed(0)}% dari kisaran harga selama periode terpilih.`},
    {icon:'dd', t:'DRAWDOWN', d:`Emas saat ini ${Math.abs(currentDD).toFixed(2)}% di bawah puncak historisnya dalam periode ini.`},
    {icon:'cagr', t:'GROWTH RATE', d:`Tingkat pertumbuhan tahunan majemuk (CAGR) emas pada periode ini sebesar ${fmtPct(gS.cagr)}.`}
  ];
  document.getElementById('deepInsights').innerHTML = items.map(it => `
    <div class="insight-card">
      <div class="ic-icon">${iconSvg(it.icon)}</div>
      <h4>${it.t}</h4><p>${it.d}</p>
    </div>`).join('');
}
function iconSvg(name){
  const stroke = '#E7D9B5';
  const paths = {
    trend:'<path d="M4 16l5-5 4 4 7-8"/>', rel:'<path d="M8 3v18M16 3v18"/><circle cx="8" cy="8" r="1.5" fill="'+stroke+'"/>',
    vol:'<path d="M3 12h3l2-7 4 14 3-9 2 5h4"/>', pos:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    dd:'<path d="M4 6l6 6-3 3 9 3"/>', cagr:'<path d="M4 18l6-9 4 5 6-9"/>'
  };
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;
}

/* ============================================================
   10. SIMULATOR
   ============================================================ */
function nearestRow(dateStr){
  const t = new Date(dateStr).getTime();
  let best = DATA[0], bestDiff = Infinity;
  for (const r of DATA){ const diff = Math.abs(r.t - t); if (diff < bestDiff){ bestDiff = diff; best = r; } }
  return best;
}
function runSimulator(){
  const capitalRaw = document.getElementById('simCapital').value.replace(/[^\d]/g,'');
  const capital = Math.max(parseFloat(capitalRaw) || 0, 0);
  const asset = document.getElementById('simAsset').value;
  const fromStr = document.getElementById('simFrom').value;
  const toStr = document.getElementById('simTo').value;
  document.getElementById('simCapDisp').textContent = fmtNum(capital);
  if (!fromStr || !toStr || capital <= 0){ return; }
  const rFrom = nearestRow(fromStr), rTo = nearestRow(toStr);
  const key = asset === 'usd' ? 'usd' : 'gold';
  const priceFrom = rFrom[key], priceTo = rTo[key];
  const units = capital / priceFrom;
  const finalVal = units * priceTo;
  const profit = finalVal - capital;
  const roi = profit/capital*100;
  const years = Math.max((rTo.t - rFrom.t)/DAY_MS/365, 1/365);
  const cagr = (Math.pow(finalVal/capital, 1/years) - 1) * 100;

  const otherKey = key === 'gold' ? 'usd' : 'gold';
  const unitsOther = capital / rFrom[otherKey];
  const finalOther = unitsOther * rTo[otherKey];
  const roiOther = (finalOther-capital)/capital*100;

  document.getElementById('simFinal').textContent = fmtIDR(finalVal);
  document.getElementById('simInit').textContent = fmtIDR(capital);
  document.getElementById('simVal').textContent = fmtIDR(finalVal);
  document.getElementById('simProfit').textContent = (profit>=0?'+':'') + fmtIDR(profit);
  document.getElementById('simRoi').textContent = fmtPct(roi);
  document.getElementById('simCagr').textContent = fmtPct(cagr);
  document.getElementById('simCompare').textContent = `${fmtPct(roiOther)} (${assetLabel(otherKey)})`;
  const chip = document.getElementById('simProfitChip');
  chip.textContent = (profit>=0?'▲ Untung ':'▼ Rugi ') + fmtPct(Math.abs(roi));
  chip.className = 'kpi-change num ' + (profit>=0?'up':'down');
  chip.style.background = profit>=0 ? 'rgba(46,125,91,0.22)' : 'rgba(184,72,58,0.22)';
  chip.style.color = profit>=0 ? '#8FE0BC' : '#F3AFA4';
}

/* ============================================================
   11. NAV / TABS / SCROLL FX
   ============================================================ */
const panels = document.querySelectorAll('.tab-panel');
const navLinks = document.querySelectorAll('.nav-link');
function setTitle(tab){
  const titles = {overview:'Market Overview', markets:'Markets', historical:'Historical Market Explorer', analytics:'Advanced Analytics', simulator:'Investment Simulator', about:'About INTELYTICS'};
  document.getElementById('tbTitle').textContent = titles[tab] || 'Dashboard';
}
function switchTab(tab){
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  panels.forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
  setTitle(tab);
  window.scrollTo(0,0);
  document.getElementById('navLinks').classList.remove('open');
  try{
    if (tab === 'overview') renderOverview();
    else if (tab === 'markets') renderMarkets();
    else if (tab === 'historical') renderHistorical();
    else if (tab === 'analytics') renderAnalytics();
  }catch(err){ console.error('Render error:', err); }
}
function goHome(){
  document.getElementById('app').style.display = 'none';
  document.getElementById('landing').style.display = 'block';
  navLinks.forEach(l => l.classList.remove('active'));
  window.scrollTo(0,0);
}
document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab)));
const homeBtn = document.querySelector('[data-nav-home]');
if (homeBtn) homeBtn.addEventListener('click', goHome);

const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => { navEl.classList.toggle('solid', window.scrollY > 30); }, {passive:true});
const burgerEl = document.getElementById('burger');
if (burgerEl) burgerEl.addEventListener('click', () => document.getElementById('navLinks').classList.toggle('open'));

if (window.IntersectionObserver){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, {threshold:0.12});
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}

/* ============================================================
   12. TOOLBAR RANGE CONTROLS
   ============================================================ */
document.querySelectorAll('#globalRange .chip[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#globalRange .chip[data-range]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.rangeMode = btn.dataset.range;
    const r = presetToRange(state.rangeMode);
    state.rangeFrom = r.from; state.rangeTo = r.to;
    document.getElementById('rangeFrom').value = toDateStr(r.from);
    document.getElementById('rangeTo').value = toDateStr(r.to);
    refreshActiveGlobalPanel();
  });
});
document.getElementById('rangeFrom').addEventListener('change', onCustomRange);
document.getElementById('rangeTo').addEventListener('change', onCustomRange);
function onCustomRange(){
  const f = document.getElementById('rangeFrom').value, t = document.getElementById('rangeTo').value;
  if (!f || !t) return;
  const from = new Date(f), to = new Date(t);
  if (from >= to) return;
  state.rangeMode = 'CUSTOM';
  state.rangeFrom = from < FIRST.date ? FIRST.date : from;
  state.rangeTo = to > LAST.date ? LAST.date : to;
  document.querySelectorAll('#globalRange .chip[data-range]').forEach(b => b.classList.remove('active'));
  refreshActiveGlobalPanel();
}
function refreshActiveGlobalPanel(){
  const active = document.querySelector('.tab-panel.active');
  if (!active) return;
  const tab = active.dataset.panel;
  if (tab === 'overview') renderOverview();
  else if (tab === 'markets') renderMarkets();
  else if (tab === 'analytics') renderAnalytics();
}
document.getElementById('resetZoom').addEventListener('click', () => {
  document.querySelectorAll('#globalRange .chip[data-range]').forEach(b => b.classList.toggle('active', b.dataset.range === '1Y'));
  state.rangeMode = '1Y';
  const r = presetToRange('1Y');
  state.rangeFrom = r.from; state.rangeTo = r.to;
  document.getElementById('rangeFrom').value = toDateStr(r.from);
  document.getElementById('rangeTo').value = toDateStr(r.to);
  renderMarkets();
});
document.getElementById('rangeFrom').value = toDateStr(state.rangeFrom);
document.getElementById('rangeTo').value = toDateStr(state.rangeTo);

document.querySelectorAll('#marketAssetSeg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#marketAssetSeg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.marketAsset = btn.dataset.asset;
    renderMarkets();
  });
});
document.querySelectorAll('#volSeg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#volSeg button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.volWindow = parseInt(btn.dataset.window,10);
    renderVolatility(filterRange(state.rangeFrom, state.rangeTo));
  });
});

/* ============================================================
   13. HISTORICAL CONTROLS
   ============================================================ */
document.getElementById('histAsset').addEventListener('change', e => { state.histAsset = e.target.value; state.histPage=1; renderHistorical(); });
document.getElementById('histFreq').addEventListener('change', e => { state.histFreq = e.target.value; state.histPage=1; renderHistorical(); });
document.getElementById('histFrom').addEventListener('change', e => { state.histFrom = e.target.value ? new Date(e.target.value) : FIRST.date; state.histPage=1; renderHistorical(); });
document.getElementById('histTo').addEventListener('change', e => { state.histTo = e.target.value ? new Date(e.target.value) : LAST.date; state.histPage=1; renderHistorical(); });
document.getElementById('histSearch').addEventListener('input', e => { state.histSearch = e.target.value; state.histPage=1; renderHistorical(); });
document.getElementById('histExport').addEventListener('click', exportCSV);
document.getElementById('histFrom').value = toDateStr(state.histFrom);
document.getElementById('histTo').value = toDateStr(state.histTo);

/* ============================================================
   14. SIMULATOR CONTROLS
   ============================================================ */
document.getElementById('simRun').addEventListener('click', runSimulator);
document.getElementById('simCapital').addEventListener('input', e => {
  const digits = e.target.value.replace(/[^\d]/g,'');
  e.target.value = digits ? Number(digits).toLocaleString('id-ID') : '';
});
{
  const defFrom = new Date(LAST.t - 365*DAY_MS);
  document.getElementById('simFrom').value = toDateStr(defFrom < FIRST.date ? FIRST.date : defFrom);
  document.getElementById('simTo').value = toDateStr(LAST.date);
  document.getElementById('simFrom').min = toDateStr(FIRST.date);
  document.getElementById('simFrom').max = toDateStr(LAST.date);
  document.getElementById('simTo').min = toDateStr(FIRST.date);
  document.getElementById('simTo').max = toDateStr(LAST.date);
}
[document.getElementById('rangeFrom'), document.getElementById('rangeTo'), document.getElementById('histFrom'), document.getElementById('histTo')].forEach(el => {
  el.min = toDateStr(FIRST.date); el.max = toDateStr(LAST.date);
});

/* ============================================================
   15. LANDING: hero stats, marquee, preview chart, loader
   ============================================================ */
function initHero(){
  document.getElementById('heroStatGold').textContent = fmtIDR(LAST.gold);
  document.getElementById('heroStatUsd').textContent = 'Rp'+fmtNum(LAST.usd);
  const ytdRows = filterRange(new Date(LAST.date.getFullYear(),0,1), LAST.date);
  const ytdStats = computeStats(ytdRows,'gold');
  document.getElementById('heroStatYtd').textContent = fmtPct(ytdStats.pctChange);
  document.getElementById('hvGold').textContent = fmtIDR(LAST.gold);
  document.getElementById('hvUsd').textContent = 'Rp'+fmtNum(LAST.usd);
  const prevIdx = DATA.indexOf(LAST)-1;
  const gChg = (LAST.gold-DATA[prevIdx].gold)/DATA[prevIdx].gold*100;
  const uChg = (LAST.usd-DATA[prevIdx].usd)/DATA[prevIdx].usd*100;
  const gEl = document.getElementById('hvGoldChg'); gEl.textContent = fmtPct(gChg); gEl.style.color = gChg>=0?GREEN:RED;
  const uEl = document.getElementById('hvUsdChg'); uEl.textContent = fmtPct(uChg); uEl.style.color = uChg>=0?GREEN:RED;
  document.getElementById('tbUpdated').textContent = `Terakhir diperbarui ${fmtDateLong(LAST.date)} • 08:30 WIB`;
}
function initMarquee(){
  const items = [
    `ANTAM Gold <b>${fmtIDR(LAST.gold)}</b>/gram`,
    `USD/IDR <b>Rp${fmtNum(LAST.usd)}</b>`,
    `Data sejak <b>${fmtDateShort(FIRST.date)}</b>`,
    `Update <b>${fmtDateShort(LAST.date)}</b>`,
    `Analitik <b>CAGR · Drawdown · Volatilitas · Korelasi</b>`,
    `Sumber data <b>Logam Mulia &amp; Bank Indonesia</b>`
  ];
  const seq = [...items, ...items].map(t => `<span>${t}</span>`).join('');
  document.getElementById('marquee').innerHTML = seq;
}
function initPreviewChart(){
  const rows = filterRange(new Date(LAST.t - 365*DAY_MS), LAST.date);
  MiniChart.line(document.getElementById('previewChart'), {
    labels: rows.map(r=>r.date),
    datasets:[
      {label:'ANTAM Gold', data: normalize(seriesOf(rows,'gold')), color: GOLD, area:true, tooltipFormat: v=>v.toFixed(1)},
      {label:'USD/IDR', data: normalize(seriesOf(rows,'usd')), color: NAVY, dashed:true, tooltipFormat: v=>v.toFixed(1)}
    ],
    xFormat: xTick, xTooltipFormat: xTooltip, yFormat: v => v.toFixed(0)
  });
}

function hideLoader(){
  const l = document.getElementById('loader');
  if (l) l.classList.add('hide');
}
function boot(){
  try { initHero(); } catch(e){ console.error(e); }
  try { initMarquee(); } catch(e){ console.error(e); }
  try { initPreviewChart(); } catch(e){ console.error(e); }
}
// Run boot immediately (DOM is already parsed since this script sits
// at the end of body), plus a hard fallback so the loader can never
// get stuck even if something above throws.
boot();
setTimeout(hideLoader, 1300);
window.addEventListener('load', () => setTimeout(hideLoader, 200));
