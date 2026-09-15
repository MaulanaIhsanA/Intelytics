/* ============================================================
   1. MOCK DATA LAYER  (isolated — swap generateData() for a
      real API/fetch layer later; nothing else needs to change)
   ============================================================ */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeNormal(rng){
  return function(){
    let u = 0, v = 0;
    while(u === 0) u = rng();
    while(v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}
function interpWaypoints(points, t){
  if (t <= points[0][0]) return points[0][1];
  if (t >= points[points.length-1][0]) return points[points.length-1][1];
  for (let i = 0; i < points.length-1; i++){
    const [t0,v0] = points[i], [t1,v1] = points[i+1];
    if (t >= t0 && t <= t1){
      const f = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * f;
    }
  }
  return points[points.length-1][1];
}
function generateData(){
  const goldWp = [
    ['2019-01-01',630000],['2019-06-01',670000],['2019-12-01',750000],
    ['2020-03-01',790000],['2020-08-01',1015000],['2020-12-01',965000],
    ['2021-06-01',932000],['2021-12-01',945000],['2022-06-01',978000],
    ['2022-12-01',1002000],['2023-06-01',1058000],['2023-12-01',1120000],
    ['2024-06-01',1250000],['2024-12-01',1450000],['2025-03-20',1732000],
    ['2025-06-01',1850000],['2025-10-01',2010000],['2026-03-04',3100000],
    ['2026-06-01',2850000],['2026-09-15',2650000]
  ].map(([d,v]) => [new Date(d).getTime(), v]);
  const usdWp = [
    ['2019-01-01',14100],['2019-06-01',14300],['2019-12-01',13900],
    ['2020-04-01',16500],['2020-08-01',14600],['2020-12-01',14050],
    ['2021-06-01',14350],['2021-12-01',14300],['2022-06-01',14850],
    ['2022-12-01',15600],['2023-06-01',14950],['2023-12-01',15400],
    ['2024-06-01',16250],['2024-12-01',16100],['2025-06-01',16300],
    ['2025-12-01',16700],['2026-03-01',17000],['2026-09-15',17600]
  ].map(([d,v]) => [new Date(d).getTime(), v]);

  const rng = mulberry32(20260915);
  const normal = makeNormal(rng);
  const start = new Date('2019-01-01').getTime();
  const end = new Date('2026-09-15').getTime();
  const DAY = 86400000;
  const out = [];
  let goldVal = goldWp[0][1], usdVal = usdWp[0][1];
  for (let t = start; t <= end; t += DAY){
    const goldBase = interpWaypoints(goldWp, t);
    const usdBase = interpWaypoints(usdWp, t);
    goldVal = goldVal + (goldBase - goldVal) * 0.055 + goldBase * 0.0062 * normal();
    usdVal = usdVal + (usdBase - usdVal) * 0.05 + usdBase * 0.0028 * normal();
    goldVal = Math.max(goldVal, 50000);
    usdVal = Math.max(usdVal, 5000);
    out.push({
      t, date: new Date(t),
      gold: Math.round(goldVal / 1000) * 1000,
      usd: Math.round(usdVal)
    });
  }
  return out;
}
const DATA = generateData();
const LAST = DATA[DATA.length - 1];
const FIRST = DATA[0];
const DAY_MS = 86400000;

/* ============================================================
   2. FORMAT HELPERS
   ============================================================ */
function toDateStr(d){ return d.toISOString().slice(0,10); }
function fmtIDR(n){ return 'Rp' + Math.round(n).toLocaleString('id-ID'); }
function fmtNum(n, dec=0){ return n.toLocaleString('id-ID', {minimumFractionDigits:dec, maximumFractionDigits:dec}); }
function fmtPct(n, dec=2){ const s = n>=0?'+':''; return s + n.toFixed(dec) + '%'; }
function fmtDateShort(d){ return d.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}); }
function fmtDateLong(d){ return d.toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'}); }
function assetLabel(a){ return a === 'gold' ? 'ANTAM Gold' : 'USD/IDR'; }
function assetUnit(a){ return a === 'gold' ? '/gram' : '/USD'; }
function fmtAsset(a,n){ return a === 'gold' ? fmtIDR(n) : 'Rp' + fmtNum(n); }

/* ============================================================
   3. ANALYTICS ENGINE
   ============================================================ */
function filterRange(from, to){
  const f = from.getTime(), t = to.getTime();
  return DATA.filter(d => d.t >= f && d.t <= t);
}
function seriesOf(rows, key){ return rows.map(r => r[key]); }
function dailyReturns(values){
  const out = [];
  for (let i = 1; i < values.length; i++) out.push(values[i]/values[i-1] - 1);
  return out;
}
function mean(arr){ return arr.reduce((a,b)=>a+b,0) / (arr.length || 1); }
function median(arr){
  const s = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length % 2 ? s[mid] : (s[mid-1]+s[mid])/2;
}
function stddev(arr){
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x-m)**2)));
}
function computeStats(rows, key){
  const vals = seriesOf(rows, key);
  const first = vals[0], last = vals[vals.length-1];
  const change = last - first;
  const pctChange = (change/first) * 100;
  const days = (rows[rows.length-1].t - rows[0].t) / DAY_MS;
  const years = Math.max(days/365, 1/365);
  const cagr = (Math.pow(last/first, 1/years) - 1) * 100;
  const rets = dailyReturns(vals);
  const dailyStd = stddev(rets);
  const volatility = dailyStd * Math.sqrt(252) * 100;
  let peak = vals[0], maxDD = 0;
  vals.forEach(v => { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v-peak)/peak*100); });
  return {
    first, last, change, pctChange,
    avg: mean(vals), median: median(vals),
    max: Math.max(...vals), min: Math.min(...vals),
    cagr, volatility, maxDrawdown: maxDD, stdDev: dailyStd * last
  };
}
function rollingVolatility(rows, key, window){
  const vals = seriesOf(rows, key);
  const rets = dailyReturns(vals);
  const out = [];
  for (let i = window; i <= rets.length; i++){
    const slice = rets.slice(i-window, i);
    out.push({ date: rows[i].date, vol: stddev(slice) * Math.sqrt(252) * 100 });
  }
  return out;
}
function drawdownSeries(rows, key){
  const vals = seriesOf(rows, key);
  let peak = vals[0];
  return rows.map((r,i) => {
    peak = Math.max(peak, vals[i]);
    return { date: r.date, dd: (vals[i]-peak)/peak*100 };
  });
}
function pearson(x, y){
  const n = x.length; const mx = mean(x), my = mean(y);
  let num=0, dx=0, dy=0;
  for (let i=0;i<n;i++){ num += (x[i]-mx)*(y[i]-my); dx += (x[i]-mx)**2; dy += (y[i]-my)**2; }
  return num / (Math.sqrt(dx*dy) || 1);
}
function ranks(arr){
  const idx = arr.map((v,i)=>[v,i]).sort((a,b)=>a[0]-b[0]);
  const r = new Array(arr.length);
  idx.forEach((pair,rank) => { r[pair[1]] = rank+1; });
  return r;
}
function spearman(x,y){ return pearson(ranks(x), ranks(y)); }
function correlationLabel(r){
  if (r >= 0.7) return 'Strong Positive';
  if (r >= 0.4) return 'Moderate Positive';
  if (r >= 0.1) return 'Weak Positive';
  if (r > -0.1) return 'Neutral';
  if (r > -0.4) return 'Weak Negative';
  if (r > -0.7) return 'Moderate Negative';
  return 'Strong Negative';
}
function normalize(vals){ const b = vals[0]; return vals.map(v => v/b*100); }
