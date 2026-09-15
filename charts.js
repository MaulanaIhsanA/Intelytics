/* ============================================================
   MiniChart — tiny dependency-free canvas charting engine
   Used instead of an external charting library so the site
   works fully offline / with no CDN access.
   ============================================================ */
(function(){
  const GRID = '#EEEBE2';
  const TICK = '#9296A0';
  const LEGEND_TXT = '#5C6270';
  const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  let tooltipEl = null;
  function getTooltip(){
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = 'position:fixed; z-index:9998; pointer-events:none; background:#151D2B; color:#fff; padding:9px 12px; border-radius:8px; font-size:12px; line-height:1.5; font-family:' + FONT + '; box-shadow:0 8px 24px rgba(0,0,0,.25); opacity:0; transition:opacity .12s ease; max-width:220px;';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }
  function showTooltip(x, y, html){
    const t = getTooltip();
    t.innerHTML = html;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = x + 16, top = y + 16;
    if (left + 230 > vw) left = x - 230;
    if (top + 90 > vh) top = y - 90;
    t.style.left = left + 'px'; t.style.top = top + 'px';
    t.style.opacity = '1';
  }
  function hideTooltip(){ if (tooltipEl) tooltipEl.style.opacity = '0'; }

  function niceMinMax(vals){
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max){ min -= Math.abs(min)*0.05 || 1; max += Math.abs(max)*0.05 || 1; }
    const pad = (max-min) * 0.1;
    return { min: min - pad, max: max + pad };
  }

  function setupCanvas(canvas){
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 10), h = Math.max(rect.height, 10);
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return { ctx, w, h };
  }

  function lineChart(canvas, opts){
    let destroyed = false;
    let hoverIdx = null;
    const pad = { l: 54, r: 16, t: opts.legend === false ? 14 : 34, b: 26 };

    function draw(){
      if (destroyed) return;
      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0,0,w,h);
      const labels = opts.labels;
      const allVals = opts.datasets.flatMap(d => d.data);
      const { min, max } = niceMinMax(allVals);
      const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
      const n = labels.length;
      const xAt = i => pad.l + (n <= 1 ? 0 : (i/(n-1)) * plotW);
      const yAt = v => pad.t + plotH - ((v-min)/(max-min || 1)) * plotH;

      // y gridlines
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      ctx.font = '10.5px ' + FONT; ctx.fillStyle = TICK;
      const gridCount = 4;
      for (let g = 0; g <= gridCount; g++){
        const v = min + (max-min) * g/gridCount;
        const y = yAt(v);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w-pad.r, y); ctx.stroke();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(opts.yFormat ? opts.yFormat(v) : Math.round(v).toLocaleString('id-ID'), pad.l-8, y);
      }
      // x ticks
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const tickCount = Math.min(6, n);
      for (let i = 0; i < tickCount; i++){
        const idx = Math.round(i * (n-1) / Math.max(tickCount-1,1));
        ctx.fillText(opts.xFormat ? opts.xFormat(labels[idx]) : String(labels[idx]), xAt(idx), h-pad.b+8);
      }
      // datasets: area fill first
      opts.datasets.forEach(ds => {
        if (ds.area){
          ctx.beginPath();
          ds.data.forEach((v,i) => { const x=xAt(i), y=yAt(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
          ctx.lineTo(xAt(n-1), pad.t+plotH); ctx.lineTo(xAt(0), pad.t+plotH); ctx.closePath();
          ctx.fillStyle = ds.fillColor || (ds.color + '1F');
          ctx.fill();
        }
      });
      // datasets: lines
      opts.datasets.forEach(ds => {
        ctx.beginPath();
        ds.data.forEach((v,i) => { const x=xAt(i), y=yAt(v); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
        ctx.strokeStyle = ds.color; ctx.lineWidth = ds.width || 2;
        ctx.setLineDash(ds.dashed ? [5,4] : []);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
        ctx.setLineDash([]);
      });
      // legend
      if (opts.legend !== false){
        let lx = pad.l; const ly = 14;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '600 11.5px ' + FONT;
        opts.datasets.forEach(ds => {
          ctx.fillStyle = ds.color;
          ctx.beginPath(); ctx.arc(lx+4, ly, 4, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = LEGEND_TXT;
          ctx.fillText(ds.label, lx+14, ly);
          lx += ctx.measureText(ds.label).width + 38;
        });
      }
      // hover crosshair + points
      if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n){
        const x = xAt(hoverIdx);
        ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t+plotH);
        ctx.strokeStyle = '#D8D3C4'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
        opts.datasets.forEach(ds => {
          const y = yAt(ds.data[hoverIdx]);
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2);
          ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = ds.color; ctx.stroke();
        });
      }
      canvas._xAt = xAt; canvas._n = n; canvas._padL = pad.l; canvas._padR = pad.r;
    }

    function indexFromX(px){
      const n = canvas._n || opts.labels.length;
      const plotW = canvas.clientWidth - (canvas._padL||54) - (canvas._padR||16);
      const rel = (px - (canvas._padL||54)) / (plotW || 1);
      return Math.round(Math.max(0, Math.min(1, rel)) * (n-1));
    }
    function onMove(e){
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const idx = indexFromX(px);
      if (idx === hoverIdx) { showTooltip(e.clientX, e.clientY, tooltipHtml(idx)); return; }
      hoverIdx = idx; draw();
      showTooltip(e.clientX, e.clientY, tooltipHtml(idx));
    }
    function tooltipHtml(idx){
      const label = opts.labels[idx];
      const title = opts.xTooltipFormat ? opts.xTooltipFormat(label) : String(label);
      const rows = opts.datasets.map(ds => {
        const v = ds.data[idx];
        const val = ds.tooltipFormat ? ds.tooltipFormat(v) : v;
        return `<div style="display:flex; align-items:center; gap:6px; margin-top:3px;"><span style="width:7px;height:7px;border-radius:50%;background:${ds.color};display:inline-block;"></span>${ds.label}: <b>${val}</b></div>`;
      }).join('');
      return `<div style="font-weight:600; margin-bottom:2px;">${title}</div>${rows}`;
    }
    function onLeave(){ hoverIdx = null; hideTooltip(); draw(); }

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', (e) => { if (e.touches[0]) onMove(e.touches[0]); }, {passive:true});
    canvas.addEventListener('touchend', onLeave);

    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    requestAnimationFrame(draw);

    return {
      destroy(){
        destroyed = true; ro.disconnect(); hideTooltip();
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', onLeave);
      }
    };
  }

  function scatterChart(canvas, opts){
    let destroyed = false;
    const pad = { l: 54, r: 16, t: 14, b: 34 };

    function draw(){
      if (destroyed) return;
      const { ctx, w, h } = setupCanvas(canvas);
      ctx.clearRect(0,0,w,h);
      const xs = opts.points.map(p=>p.x), ys = opts.points.map(p=>p.y);
      const xr = niceMinMax(xs), yr = niceMinMax(ys);
      const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
      const xAt = v => pad.l + ((v-xr.min)/((xr.max-xr.min)||1)) * plotW;
      const yAt = v => pad.t + plotH - ((v-yr.min)/((yr.max-yr.min)||1)) * plotH;

      ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.font = '10.5px ' + FONT; ctx.fillStyle = TICK;
      for (let g=0; g<=4; g++){
        const yv = yr.min + (yr.max-yr.min)*g/4, y = yAt(yv);
        ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
        ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillText(yv.toFixed(1), pad.l-8, y);
        const xv = xr.min + (xr.max-xr.min)*g/4, x = xAt(xv);
        ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(xv.toFixed(1), x, h-pad.b+8);
      }
      // zero axes
      ctx.strokeStyle = '#D8D3C4';
      if (xr.min < 0 && xr.max > 0){ const x0 = xAt(0); ctx.beginPath(); ctx.moveTo(x0,pad.t); ctx.lineTo(x0,pad.t+plotH); ctx.stroke(); }
      if (yr.min < 0 && yr.max > 0){ const y0 = yAt(0); ctx.beginPath(); ctx.moveTo(pad.l,y0); ctx.lineTo(w-pad.r,y0); ctx.stroke(); }

      ctx.fillStyle = opts.color || '#AD8A42';
      opts.points.forEach(p => {
        ctx.beginPath(); ctx.arc(xAt(p.x), yAt(p.y), 3, 0, Math.PI*2); ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
      });
      if (opts.xLabel){ ctx.textAlign='center'; ctx.fillStyle=TICK; ctx.font='10.5px '+FONT; ctx.fillText(opts.xLabel, pad.l+plotW/2, h-4); }
      canvas._xAt = xAt; canvas._yAt = yAt; canvas._xr = xr; canvas._yr = yr;
    }

    function onMove(e){
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      let nearest = null, nearestD = Infinity;
      opts.points.forEach(p => {
        const dx = canvas._xAt(p.x) - px, dy = canvas._yAt(p.y) - py;
        const d = dx*dx + dy*dy;
        if (d < nearestD){ nearestD = d; nearest = p; }
      });
      if (nearest && nearestD < 400){
        showTooltip(e.clientX, e.clientY, opts.tooltipFormat ? opts.tooltipFormat(nearest) : `${nearest.x.toFixed(2)}, ${nearest.y.toFixed(2)}`);
      } else hideTooltip();
    }
    function onLeave(){ hideTooltip(); }
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    requestAnimationFrame(draw);

    return {
      destroy(){ destroyed = true; ro.disconnect(); hideTooltip(); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); }
    };
  }

  window.MiniChart = { line: lineChart, scatter: scatterChart };
})();
