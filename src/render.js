/* ============================================================
   PANAL ROTO · dibujado (Canvas 2D)
   ============================================================ */
const R = (() => {
  const { W, H, SQ3, ANIM } = PR;
  const cfg = { cb: false, ghost: true, reduce: false, dpr: 1 };

  /* ---- paletas ---- */
  const PAL = {
    normal: ['#ff6b4a', '#ff9f1c', '#ffd166', '#e63e8d', '#efe6c8', '#2ec4b6', '#8e6bff', '#ff8fb8', '#8ae6ff', '#8bd450'],
    cb:     ['#D55E00', '#F0E442', '#88CCEE', '#B07AA1', '#F5F5F5', '#009E73', '#7570B3', '#A65628', '#FF9DA7', '#B2DF8A'],
  };
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
  const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function colorsOf(t) {
    const rgb = hex2rgb((cfg.cb ? PAL.cb : PAL.normal)[t]);
    return { rgb, base: mix(rgb, rgb, 0), hi: mix(rgb, [255, 255, 255], 0.38), lo: mix(rgb, [20, 8, 40], 0.42), dark: lum(rgb) > 0.6 };
  }

  /* ---- geometría ---- */
  function hexPath(ctx, x, y, s) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k, px = x + s * Math.cos(a), py = y + s * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }
  const cellXY = (L, col, row) => [L.ox + L.s + 1.5 * L.s * col, L.oy + SQ3 * L.s / 2 + SQ3 * L.s * (row + 0.5 * (col & 1))];
  const axialXY = (L, q, r) => cellXY(L, q, r + Math.floor(q / 2));
  const idxXY = (L, i) => cellXY(L, i % W, (i / W) | 0);

  /* ---- sprites de celda (se dibujan una vez por tamaño y paleta) ---- */
  const sprites = new Map();
  function drawPattern(ctx, p, x, y, s, ink) {
    ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1.4, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const u = s * 0.5;
    switch (p) {
      case 0: ctx.beginPath(); ctx.arc(x, y, u * 0.42, 0, 7); ctx.fill(); break;
      case 1: ctx.beginPath(); ctx.arc(x, y, u * 0.62, 0, 7); ctx.stroke(); break;
      case 2: for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x - u + k * u * 0.62, y + u * 0.8); ctx.lineTo(x + u * 0.5 + k * u * 0.62, y - u * 0.8); ctx.stroke(); } break;
      case 3: ctx.beginPath(); ctx.moveTo(x - u * 0.7, y); ctx.lineTo(x + u * 0.7, y); ctx.moveTo(x, y - u * 0.7); ctx.lineTo(x, y + u * 0.7); ctx.stroke(); break;
      case 4: ctx.beginPath(); ctx.moveTo(x - u * 0.75, y - u * 0.45); ctx.lineTo(x, y + u * 0.5); ctx.lineTo(x + u * 0.75, y - u * 0.45); ctx.stroke(); break;
      case 5: ctx.beginPath(); ctx.moveTo(x, y - u * 0.72); ctx.lineTo(x + u * 0.62, y); ctx.lineTo(x, y + u * 0.72); ctx.lineTo(x - u * 0.62, y); ctx.closePath(); ctx.stroke(); break;
      case 6: ctx.beginPath(); ctx.moveTo(x, y - u * 0.7); ctx.lineTo(x + u * 0.65, y + u * 0.5); ctx.lineTo(x - u * 0.65, y + u * 0.5); ctx.closePath(); ctx.fill(); break;
      case 7: ctx.beginPath(); ctx.moveTo(x - u * 0.8, y); ctx.lineTo(x + u * 0.8, y); ctx.lineTo(x + u * 0.45, y - u * 0.7); ctx.lineTo(x - u * 0.45, y - u * 0.7); ctx.closePath(); ctx.fill(); break;
      case 8: ctx.beginPath(); ctx.moveTo(x - u * 0.8, y + u * 0.3); ctx.lineTo(x - u * 0.27, y - u * 0.3); ctx.lineTo(x + u * 0.27, y + u * 0.3); ctx.lineTo(x + u * 0.8, y - u * 0.3); ctx.stroke(); break;
      case 9: hexPath(ctx, x, y, u * 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, u * 0.16, 0, 7); ctx.fill(); break;
    }
    ctx.restore();
  }
  function getSprite(t, s) {
    const key = t + '|' + Math.round(s * 4) + '|' + (cfg.cb ? 1 : 0) + '|' + cfg.dpr;
    let sp = sprites.get(key); if (sp) return sp;
    const d = cfg.dpr, size = Math.ceil(2.2 * s * d), cv = document.createElement('canvas'); cv.width = cv.height = size;
    const ctx = cv.getContext('2d'); ctx.scale(d, d);
    const c = colorsOf(t), x = size / d / 2, y = size / d / 2, rs = s * 0.94;
    hexPath(ctx, x, y, rs);
    const g = ctx.createLinearGradient(x - rs, y - rs, x + rs, y + rs); g.addColorStop(0, c.hi); g.addColorStop(0.5, c.base); g.addColorStop(1, c.lo);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.2, s * 0.08); ctx.strokeStyle = 'rgba(12,5,24,.6)'; ctx.stroke();
    hexPath(ctx, x, y, rs * 0.74); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
    ctx.beginPath(); // reflejo en el borde superior izquierdo
    for (let k = 3; k <= 5; k++) { const a = Math.PI / 3 * k, px = x + rs * 0.74 * Math.cos(a), py = y + rs * 0.74 * Math.sin(a); k === 3 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.stroke();
    if (cfg.cb) drawPattern(ctx, t, x, y, s, c.dark ? 'rgba(20,8,40,.82)' : 'rgba(255,255,255,.9)');
    sp = { cv, half: size / d / 2 }; sprites.set(key, sp); return sp;
  }
  function drawCell(ctx, x, y, s, t, alpha = 1, white = 0) {
    const sp = getSprite(t, s);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(sp.cv, x - sp.half, y - sp.half, sp.half * 2, sp.half * 2);
    if (white > 0) { hexPath(ctx, x, y, s * 0.94); ctx.fillStyle = 'rgba(255,248,225,' + white + ')'; ctx.fill(); }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  function drawGhostCell(ctx, x, y, s, t) {
    const c = colorsOf(t);
    hexPath(ctx, x, y, s * 0.9); ctx.fillStyle = 'rgba(' + c.rgb.join(',') + ',.13)'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.09); ctx.strokeStyle = 'rgba(' + c.rgb.join(',') + ',.85)'; ctx.setLineDash(cfg.cb ? [s * 0.35, s * 0.2] : []); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ---- diseño de pantalla ---- */
  function computeLayout(w, h) {
    const pad = Math.max(8, Math.min(w, h) * 0.02), land = w / h >= 0.82;
    let s, ox, oy, hud;
    if (land) {
      s = Math.min((h - 2 * pad) / (SQ3 * (H + 2.2)), (w - 2 * pad) / 30);
      const bw = 14 * s, bh = SQ3 * s * (H + 0.5);
      ox = (w - bw) / 2; oy = (h - bh) / 2 + SQ3 * s * 0.6;
      const pw = Math.min(7.2 * s, (w - bw) / 2 - pad * 1.5);
      hud = { land: true, lx: ox - pw - pad, lw: pw, rx: ox + bw + pad, rw: pw, top: oy };
    } else {
      s = Math.min((h - 2 * pad) / (4.6 + SQ3 * (H + 2.1)), (w - 2 * pad) / 14.4);
      const bw = 14 * s, bh = SQ3 * s * (H + 0.5), used = 4.6 * s + SQ3 * s * 1.6 + bh;
      ox = (w - bw) / 2; oy = pad + Math.max(0, (h - 2 * pad - used) / 2) + 4.6 * s + SQ3 * s * 1.6;
      hud = { land: false, top: oy - SQ3 * s * 1.6 - 4.4 * s, x: pad, w: w - 2 * pad, h: 4.2 * s };
    }
    return { w, h, s, ox, oy, bw: 14 * s, bh: SQ3 * s * (H + 0.5), hud };
  }

  /* ---- fondo ---- */
  let bgCv = null, bgKey = '';
  function bgCanvas(w, h) {
    const key = w + 'x' + h + '@' + cfg.dpr; if (bgCv && bgKey === key) return bgCv;
    bgKey = key; bgCv = document.createElement('canvas'); bgCv.width = Math.ceil(w * cfg.dpr); bgCv.height = Math.ceil(h * cfg.dpr);
    const c = bgCv.getContext('2d'); c.scale(cfg.dpr, cfg.dpr);
    const g = c.createRadialGradient(w / 2, h * 0.25, 10, w / 2, h * 0.4, Math.max(w, h) * 0.8); g.addColorStop(0, '#2a1c42'); g.addColorStop(1, '#0f0a17');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const s = Math.max(26, Math.min(w, h) / 9); c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 1.2;
    for (let col = -1; col * 1.5 * s < w + s; col++) for (let row = -1; row * SQ3 * s < h + s; row++) { hexPath(c, col * 1.5 * s, row * SQ3 * s + (col & 1 ? SQ3 * s / 2 : 0), s * 0.96); c.stroke(); }
    return bgCv;
  }
  const motes = []; for (let i = 0; i < 34; i++) motes.push({ x: Math.random(), y: Math.random(), v: 0.004 + Math.random() * 0.012, r: 0.6 + Math.random() * 1.8, p: Math.random() * 6.3 });

  /* ---- efectos ---- */
  const fx = { parts: [], pops: [], trails: [], shake: 0, shakeT: 0, flashLevel: 0 };
  function spawnShards(L, x, y, t) {
    if (cfg.reduce) return;
    const c = colorsOf(t), s = L.s * 0.94;
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI / 3 * k, a1 = Math.PI / 3 * (k + 1);
      const v0 = [Math.cos(a0) * s, Math.sin(a0) * s], v1 = [Math.cos(a1) * s, Math.sin(a1) * s];
      const cx = (v0[0] + v1[0]) / 3, cy = (v0[1] + v1[1]) / 3, d = Math.hypot(cx, cy) || 1;
      const sp = L.s * (4 + Math.random() * 7);
      fx.parts.push({ k: 'shard', x: x + cx, y: y + cy, vx: cx / d * sp + (Math.random() - 0.5) * L.s * 3, vy: cy / d * sp - L.s * (3 + Math.random() * 5), rot: 0, vr: (Math.random() - 0.5) * 14,
        life: 0, max: 650 + Math.random() * 450, tri: [[-cx, -cy], [v0[0] - cx, v0[1] - cy], [v1[0] - cx, v1[1] - cy]], c: c.rgb, hi: c.hi });
    }
    for (let k = 0; k < 2; k++) fx.parts.push({ k: 'spark', x, y, vx: (Math.random() - 0.5) * L.s * 9, vy: -Math.random() * L.s * 8, life: 0, max: 380 + Math.random() * 300, r: L.s * (0.07 + Math.random() * 0.1) });
  }
  function popup(L, text, sub, color, big) { fx.pops.push({ text, sub, color, big, life: 0, max: cfg.reduce ? 1500 : 1300, y: 0 }); if (fx.pops.length > 5) fx.pops.shift(); }
  function addShake(a) { if (cfg.reduce) return; fx.shake = Math.max(fx.shake, a); fx.shakeT = 0; }
  function addTrail(L, cells, color, rows) { if (cfg.reduce) return; fx.trails.push({ cells, color, life: 0, max: 240 }); }
  function updateFx(dt) {
    for (const p of fx.parts) { p.life += dt; const d = dt / 1000; p.x += p.vx * d; p.y += p.vy * d; if (p.k === 'shard') { p.vy += 1500 * d * (cfg.dpr ? 1 : 1); p.rot += p.vr * d; } else p.vy += 700 * d; }
    fx.parts = fx.parts.filter(p => p.life < p.max);
    for (const p of fx.pops) p.life += dt; fx.pops = fx.pops.filter(p => p.life < p.max);
    for (const t of fx.trails) t.life += dt; fx.trails = fx.trails.filter(t => t.life < t.max);
    fx.shakeT += dt; fx.shake *= Math.pow(0.0009, dt / 1000);
    if (fx.shake < 0.05) fx.shake = 0;
  }
  function clearFx() { fx.parts.length = 0; fx.pops.length = 0; fx.trails.length = 0; fx.shake = 0; }

  /* ---- partes del tablero ---- */
  let frameCache = null, frameKey = '';
  function drawBoardBackdrop(ctx, L) {
    const s = L.s;
    // cámara de aparición (filas -2 y -1)
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.setLineDash([s * 0.25, s * 0.25]);
    for (let col = 0; col < W; col++) for (let row = -2; row < 0; row++) { const [x, y] = cellXY(L, col, row); hexPath(ctx, x, y, s * 0.94); ctx.stroke(); }
    ctx.setLineDash([]);
    for (let col = 0; col < W; col++) for (let row = 0; row < H; row++) {
      const [x, y] = cellXY(L, col, row);
      hexPath(ctx, x, y, s * 0.94);
      ctx.fillStyle = ((col + row) & 1) ? '#1c1429' : '#1a1226'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = '#2d2240'; ctx.stroke();
    }
  }
  function drawBoardFrame(ctx, L, danger, now) {
    const s = L.s, D = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
    const pulse = danger ? (cfg.reduce ? 1 : 0.5 + 0.5 * Math.sin(now / 160)) : 0;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, s * 0.14);
    ctx.strokeStyle = danger ? 'rgb(255,' + Math.round(120 - 40 * pulse) + ',' + Math.round(100 - 30 * pulse) + ')' : '#8a6fc0';
    ctx.shadowColor = danger ? 'rgba(255,90,70,' + (0.45 + 0.35 * pulse) + ')' : 'rgba(160,120,255,.6)'; ctx.shadowBlur = s * 0.6;
    ctx.beginPath();
    for (let col = 0; col < W; col++) for (let row = 0; row < H; row++) {
      const q = col, r = row - (col >> 1), [x, y] = cellXY(L, col, row);
      for (let k = 0; k < 6; k++) {
        const nq = q + D[k][0], nr = r + D[k][1], nc = nq, nrow = nr + (nq >> 1);
        if (nc >= 0 && nc < W && nrow >= 0 && nrow < H) continue;
        const a0 = Math.PI / 3 * k, a1 = Math.PI / 3 * (k + 1), rs = s * 0.94;
        ctx.moveTo(x + rs * Math.cos(a0), y + rs * Math.sin(a0)); ctx.lineTo(x + rs * Math.cos(a1), y + rs * Math.sin(a1));
      }
    }
    ctx.stroke(); ctx.restore();
  }
  function drawGrid(ctx, L, grid, skip, glowSet, glow) {
    for (let i = 0; i < PR.N; i++) {
      const v = grid[i]; if (!v) continue; if (skip && skip.has(i)) continue;
      const [x, y] = idxXY(L, i);
      drawCell(ctx, x, y, L.s, v - 1, 1, glowSet && glowSet.has(i) ? glow : 0);
    }
  }
  function drawPieceCells(ctx, L, g, c, mode, white) {
    for (const [dq, dr] of PR.ROT[c.t][c.rot]) {
      const [x, y] = axialXY(L, c.q + dq, c.r + dr);
      if (mode === 'ghost') drawGhostCell(ctx, x, y, L.s, c.t); else drawCell(ctx, x, y, L.s, c.t, 1, white || 0);
    }
  }
  function lineFlash(ctx, L, step, lt, now) {
    const pulse = cfg.reduce ? 0.8 : 0.55 + 0.45 * Math.sin(now / 38);
    const prog = Math.min(1, lt / (ANIM.flash * 0.5));
    for (const ln of step.lines) {
      const pts = ln.idx.map(i => idxXY(L, i));
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,236,170,' + (0.35 * pulse) + ')'; ctx.lineWidth = L.s * 1.5;
      ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * pulse) + ')'; ctx.lineWidth = L.s * 0.32;
      const n = Math.max(2, Math.round(pts.length * (cfg.reduce ? 1 : prog)));
      ctx.beginPath(); for (let k = 0; k < n; k++) k ? ctx.lineTo(pts[k][0], pts[k][1]) : ctx.moveTo(pts[k][0], pts[k][1]); ctx.stroke();
      ctx.restore();
    }
  }
  function drawResolving(ctx, L, g, now, hooks) {
    const res = g.anim; let acc = 0, idx = 0;
    for (; idx < res.steps.length; idx++) { const st = res.steps[idx], dur = ANIM.flash + st.fallMs + ANIM.gap; if (g.animT < acc + dur) break; acc += dur; }
    if (idx >= res.steps.length) { drawGrid(ctx, L, g.grid); return; }
    const st = res.steps[idx], lt = g.animT - acc;
    if (lt < ANIM.flash) {
      const set = new Set(st.cleared.map(c => c.i)), w = cfg.reduce ? 0.5 : 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(now / 40));
      drawGrid(ctx, L, st.before, null, set, w); lineFlash(ctx, L, st, lt, now);
    } else {
      if (!st._shat) { st._shat = true; if (hooks && hooks.shatter) hooks.shatter(st, idx, res); for (const c of st.cleared) { const [x, y] = idxXY(L, c.i); spawnShards(L, x, y, c.t); } }
      const p = st.fallMs ? Math.min(1, (lt - ANIM.flash) / st.fallMs) : 1;
      if (p >= 1) drawGrid(ctx, L, st.after);
      else {
        const e = p * p, from = new Set(st.falls.map(f => f.from)); drawGrid(ctx, L, st.mid, from);
        for (const f of st.falls) { const [x0, y0] = idxXY(L, f.from), [x1, y1] = idxXY(L, f.to); drawCell(ctx, x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, L.s, f.t); }
      }
    }
  }

  /* ---- paneles (reserva, siguientes, textos) ---- */
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function pieceBounds(t, s) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [q, r] of PR.PIECES[t].cells) { const x = s * 1.5 * q, y = s * SQ3 * (r + q / 2); x0 = Math.min(x0, x - s); x1 = Math.max(x1, x + s); y0 = Math.min(y0, y - s * SQ3 / 2); y1 = Math.max(y1, y + s * SQ3 / 2); }
    return { x0, x1, y0, y1 };
  }
  function drawMini(ctx, t, cx, cy, s, alpha = 1) {
    const b = pieceBounds(t, s), ox = cx - (b.x0 + b.x1) / 2, oy = cy - (b.y0 + b.y1) / 2;
    for (const [q, r] of PR.PIECES[t].cells) drawCell(ctx, ox + s * 1.5 * q, oy + s * SQ3 * (r + q / 2), s, t, alpha);
  }
  function box(ctx, x, y, w, h, label, s) {
    roundRect(ctx, x, y, w, h, s * 0.5); ctx.fillStyle = 'rgba(20,12,32,.82)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#3d2f58'; ctx.stroke();
    ctx.fillStyle = '#a99bc4'; ctx.font = '700 ' + Math.max(10, s * 0.5) + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + s * 0.55, y + s * 0.95);
  }
  const FONT = "'Trebuchet MS','Segoe UI',Roboto,system-ui,sans-serif", MONO = "ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace";
  const fmt = n => Math.round(n).toLocaleString('es-ES');
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  const fmtTe = ms => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  const MODE_NAME = { maraton: 'Maratón', contrarreloj: 'Contrarreloj', diaria: 'Partida diaria', libre: 'Libre' };

  function fit(ctx, text, maxW, px, weight, fam) {
    let f = px; ctx.font = weight + ' ' + f + 'px ' + fam;
    while (f > 9 && ctx.measureText(text).width > maxW) { f -= 0.5; ctx.font = weight + ' ' + f + 'px ' + fam; }
  }
  function statLines(g) {
    const rows = [['PUNTOS', fmt(g.score), 1.5], ['NIVEL', String(g.level), 1], ['LÍNEAS', g.goal ? g.lines + ' / ' + g.goal : String(g.lines), 1]];
    rows.push(g.timeLimit ? ['TIEMPO', fmtT(g.timeLimit - g.elapsed), 1] : ['TIEMPO', fmtTe(g.elapsed), 1]);
    rows.push(['COMBO', g.combo >= 1 ? '×' + (g.combo + 1) : '—', 1]);
    return rows;
  }
  function drawHud(ctx, L, g, nextN) {
    const s = L.s, h = L.hud;
    if (h.land) {
      const hh = Math.max(4.6 * s, 0);
      box(ctx, h.lx, h.top, h.lw, hh, 'RESERVA', s);
      if (g.hold >= 0) drawMini(ctx, g.hold, h.lx + h.lw / 2, h.top + hh * 0.6, s * 0.62, g.holdUsed ? 0.4 : 1);
      let y = h.top + hh + s * 1.4;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffb627'; ctx.font = '800 ' + Math.max(11, s * 0.55) + 'px ' + FONT; ctx.fillText(MODE_NAME[g.mode].toUpperCase(), h.lx + s * 0.2, y); y += s * 1.5;
      for (const [lab, val, k] of statLines(g)) {
        ctx.fillStyle = '#a99bc4'; ctx.font = '700 ' + Math.max(10, s * 0.48) + 'px ' + FONT; ctx.fillText(lab, h.lx + s * 0.2, y); y += s * (k > 1 ? 1.75 : 1.4);
        ctx.fillStyle = '#f3ebff'; fit(ctx, val, h.lw - s * 0.4, Math.max(14, s * (k > 1 ? 1.35 : 1.05)), '700', MONO); ctx.fillText(val, h.lx + s * 0.2, y); y += s * 1.45;
      }
      // siguientes
      const nh = 3.3 * s;
      box(ctx, h.rx, h.top, h.rw, nh * nextN + s * 0.6, 'SIGUIENTES', s);
      for (let i = 0; i < nextN; i++) drawMini(ctx, g.queue[i], h.rx + h.rw / 2, h.top + s * 1.3 + nh * (i + 0.5), s * (i === 0 ? 0.6 : 0.46), i === 0 ? 1 : 0.9);
    } else {
      const bx = h.x, by = h.top, bw = h.w, bh = h.h, gap = s * 0.4, hw = bw * 0.2, mw = bw * 0.33, nw = bw - hw - mw - 2 * gap;
      box(ctx, bx, by, hw, bh, 'RESERVA', s * 0.62);
      if (g.hold >= 0) drawMini(ctx, g.hold, bx + hw / 2, by + bh * 0.64, s * 0.4, g.holdUsed ? 0.4 : 1);
      const cx = bx + hw + gap + s * 0.2, tw = mw - s * 0.2; ctx.textAlign = 'left';
      ctx.fillStyle = '#a99bc4'; fit(ctx, MODE_NAME[g.mode].toUpperCase() + ' · NIVEL ' + g.level, tw, Math.max(10, s * 0.5), '700', FONT); ctx.fillText(MODE_NAME[g.mode].toUpperCase() + ' · NIVEL ' + g.level, cx, by + s * 0.95);
      ctx.fillStyle = '#f3ebff'; fit(ctx, fmt(g.score), tw, Math.max(16, s * 1.35), '700', MONO); ctx.fillText(fmt(g.score), cx, by + s * 2.5);
      const l3 = (g.goal ? g.lines + '/' + g.goal : g.lines) + ' lín · ' + (g.timeLimit ? fmtT(g.timeLimit - g.elapsed) : fmtTe(g.elapsed));
      ctx.fillStyle = '#a99bc4'; fit(ctx, l3, tw, Math.max(10, s * 0.55), '600', MONO); ctx.fillText(l3, cx, by + s * 3.55);
      if (g.combo >= 1) { ctx.fillStyle = '#ffb0d0'; ctx.fillText('COMBO ×' + (g.combo + 1), cx, by + s * 4.3); }
      const nx = bx + bw - nw;
      box(ctx, nx, by, nw, bh, 'SIGUIENTES', s * 0.62);
      const n = Math.min(nextN, 3), cw = nw / n;
      for (let i = 0; i < n; i++) drawMini(ctx, g.queue[i], nx + cw * (i + 0.5), by + bh * 0.64, s * (i === 0 ? 0.4 : 0.32));
    }
  }

  /* ---- ventanas auxiliares (cómo se juega) ---- */
  function drawStrip(ctx, x, y, s, cols, cells, color, kind) {
    for (let c = 0; c < cols; c++) for (let r = -3; r <= 3; r++) {
      const px = x + s * 1.5 * c, py = y + s * SQ3 * (r + 0.5 * (c & 1)); hexPath(ctx, px, py, s * 0.9); ctx.fillStyle = '#1a1226'; ctx.fill(); ctx.strokeStyle = '#2d2240'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const [c, r] of cells) { const px = x + s * 1.5 * c, py = y + s * SQ3 * (r + 0.5 * (c & 1)); drawCell(ctx, px, py, s * 0.97, color); }
  }
  function drawHowLines(cv) {
    const ctx = cv.getContext('2d'), w = cv.width, s = 17; ctx.clearRect(0, 0, w, cv.height);
    const cols = 9, wStrip = s * 1.5 * (cols - 1) + 2 * s, gap = (w - 3 * wStrip) / 4, labels = ['Franja', 'Diagonal /', 'Diagonal \\'];
    const sets = [
      Array.from({ length: cols }, (_, c) => [c, 0]),
      Array.from({ length: cols }, (_, c) => [c, -Math.ceil(c / 2) + 2]),
      Array.from({ length: cols }, (_, c) => [c, Math.floor(c / 2) - 2]),
    ];
    for (let k = 0; k < 3; k++) {
      const x = gap + k * (wStrip + gap) + s;
      drawStrip(ctx, x, 128, s, cols, sets[k], [0, 1, 3][k], k);
      ctx.fillStyle = '#ffb627'; ctx.font = '700 15px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(labels[k], x + (wStrip - 2 * s) / 2, 20);
    }
  }
  function drawHowPieces(cv) {
    const ctx = cv.getContext('2d'), w = cv.width; ctx.clearRect(0, 0, w, cv.height);
    for (let t = 0; t < PR.NP; t++) { const cx = w / PR.NP * (t + 0.5); drawMini(ctx, t, cx, 62, 13); ctx.fillStyle = '#a99bc4'; ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(PR.PIECES[t].name, cx, 132); }
  }

  /* ---- fotograma completo ---- */
  function draw(ctx, L, g, now, dt, view) {
    ctx.setTransform(cfg.dpr, 0, 0, cfg.dpr, 0, 0);
    ctx.drawImage(bgCanvas(L.w, L.h), 0, 0, L.w, L.h);
    if (!cfg.reduce) { ctx.fillStyle = 'rgba(255,214,120,.5)'; for (const m of motes) { m.y -= m.v * dt / 1000; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } const x = (m.x + Math.sin(now / 2500 + m.p) * 0.01) * L.w, y = m.y * L.h; ctx.globalAlpha = 0.25 + 0.25 * Math.sin(now / 900 + m.p); ctx.beginPath(); ctx.arc(x, y, m.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
    if (!g) return;
    updateFx(dt);
    ctx.save();
    if (fx.shake > 0) { const a = fx.shake * L.s * 0.35; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    drawBoardBackdrop(ctx, L);
    if (g.phase === 'resolve' && g.anim) drawResolving(ctx, L, g, now, view.hooks);
    else drawGrid(ctx, L, g.grid);
    if (g.cur && g.phase === 'play') {
      if (cfg.ghost) { const d = PR.dropDistance(g); if (d > 0) drawPieceCells(ctx, L, g, { t: g.cur.t, rot: g.cur.rot, q: g.cur.q, r: g.cur.r + d }, 'ghost'); }
      const lockW = g.lockT > 0 ? Math.min(0.5, g.lockT / PR.LOCK_MS * 0.5) : 0;
      drawPieceCells(ctx, L, g, g.cur, 'solid', lockW);
    }
    // estelas de caída directa
    for (const t of fx.trails) {
      const a = 1 - t.life / t.max;
      for (const c of t.cells) { const gr = ctx.createLinearGradient(0, c.y0, 0, c.y1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,240,200,' + (0.26 * a) + ')'); ctx.fillStyle = gr; ctx.fillRect(c.x - L.s * 0.22, c.y0, L.s * 0.44, Math.max(0, c.y1 - c.y0)); }
    }
    let danger = false; for (let i = 0; i < 4 * W; i++) if (g.grid[i]) { danger = true; break; }
    drawBoardFrame(ctx, L, danger && g.phase !== 'over', now);
    // partículas
    for (const p of fx.parts) {
      const a = 1 - p.life / p.max;
      if (p.k === 'shard') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.beginPath(); ctx.moveTo(p.tri[0][0], p.tri[0][1]); ctx.lineTo(p.tri[1][0], p.tri[1][1]); ctx.lineTo(p.tri[2][0], p.tri[2][1]); ctx.closePath(); ctx.fillStyle = p.hi; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(12,5,24,.5)'; ctx.stroke(); ctx.restore(); }
      else { ctx.globalAlpha = a; ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
    drawHud(ctx, L, g, view.nextN || 5);
    // avisos
    let py = L.oy + L.bh * 0.34;
    for (const p of fx.pops) {
      const t = p.life / p.max, a = t < 0.12 ? t / 0.12 : Math.min(1, (1 - t) / 0.35), rise = cfg.reduce ? 0 : -t * L.s * 2.2, sc = cfg.reduce ? 1 : (t < 0.12 ? 0.8 + t / 0.12 * 0.3 : 1.1 - Math.min(0.1, (t - 0.12)));
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(L.ox + L.bw / 2, py + rise); ctx.scale(sc, sc);
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, L.s * 0.28); ctx.strokeStyle = 'rgba(12,5,24,.9)';
      const fs = L.s * (p.big ? 1.55 : 1.15); ctx.font = '900 ' + fs + 'px ' + FONT; ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      if (p.sub) { ctx.font = '700 ' + L.s * 0.8 + 'px ' + MONO; ctx.strokeText(p.sub, 0, L.s * 1.1); ctx.fillStyle = '#fff2c4'; ctx.fillText(p.sub, 0, L.s * 1.1); }
      ctx.restore(); py += L.s * 2.7;
    }
  }

  return { cfg, PAL, computeLayout, draw, popup, addShake, addTrail, clearFx, spawnShards, axialXY, cellXY, drawHowLines, drawHowPieces, fmt, fmtT, fmtTe, MODE_NAME, fx, colorsOf };
})();
