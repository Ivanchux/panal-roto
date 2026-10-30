/* ============================================================
   PANAL ROTO · motor de reglas (puro, sin DOM, determinista)
   Rejilla hexagonal de punta plana, 9 columnas x 16 filas.
   Coordenadas axiales (q, r) para las piezas; (col, fila) para el tablero.
   Columna impar = medio hexágono más baja.
   ============================================================ */
const PR = (() => {
  'use strict';
  const W = 9, H = 16, TOP = 4, N = W * H;
  const SQ3 = Math.sqrt(3);

  /* ---- Piezas: los 10 tetrahexes "de un solo lado" (7 libres + 3 reflejos) ----
     Celdas relativas al pivote, ya en su orientación de aparición. */
  const PIECES = [
    { name: 'Aguijón',  mirror: -1, cells: [[-1,0],[0,0],[1,0],[2,0]] },
    { name: 'Garra I',  mirror: 2,  cells: [[1,-1],[0,0],[-1,0],[-1,1]] },
    { name: 'Garra D',  mirror: 1,  cells: [[1,0],[0,0],[-1,0],[-1,1]] },
    { name: 'Hoz I',    mirror: 7,  cells: [[-1,1],[0,0],[1,0],[2,0]] },
    { name: 'Gota',     mirror: -1, cells: [[-1,1],[0,0],[0,1],[1,0]] },
    { name: 'Ola I',    mirror: 8,  cells: [[-1,0],[0,0],[1,-1],[2,-1]] },
    { name: 'Antena',   mirror: -1, cells: [[0,0],[1,-1],[-1,0],[-1,-1]] },
    { name: 'Hoz D',    mirror: 3,  cells: [[-1,1],[0,0],[1,-1],[2,-1]] },
    { name: 'Ola D',    mirror: 5,  cells: [[-1,1],[0,0],[1,0],[2,-1]] },
    { name: 'Hélice',   mirror: -1, cells: [[-1,0],[1,-1],[0,0],[0,1]] },
  ];
  const NP = PIECES.length;
  const rotCW = ([q, r]) => [-r, q + r];
  const ROT = PIECES.map(p => {
    const out = []; let c = p.cells;
    for (let k = 0; k < 6; k++) { out.push(c); c = c.map(rotCW); }
    return out;
  });

  /* ---- Líneas: cadenas de 9 celdas de pared a pared en tres direcciones ----
     kind 0 = franja (fila en zigzag), 1 = diagonal "/", 2 = diagonal "\" */
  const LINES = [];
  for (let R = 0; R < H; R++) { const idx = []; for (let c = 0; c < W; c++) idx.push(R * W + c); LINES.push({ kind: 0, idx }); }
  for (let k = 0; k < H + W; k++) {            // "/" : axial (c, k-c)
    const idx = []; let ok = true;
    for (let c = 0; c < W; c++) { const row = k - c + (c >> 1); if (row < 0 || row >= H) { ok = false; break; } idx.push(row * W + c); }
    if (ok) LINES.push({ kind: 1, idx });
  }
  for (let k = -W; k < H; k++) {               // "\" : axial (c, k)
    const idx = []; let ok = true;
    for (let c = 0; c < W; c++) { const row = k + (c >> 1); if (row < 0 || row >= H) { ok = false; break; } idx.push(row * W + c); }
    if (ok) LINES.push({ kind: 2, idx });
  }

  /* ---- Constantes de ritmo ---- */
  const LOCK_MS = 500, MAX_RESETS = 15;
  const ANIM = { flash: 360, fall: 280, gap: 70 };
  const LINE_PTS = [0, 100, 300, 500, 800, 1200, 1800];
  const DIR_MULT = [1, 1, 1.5, 2];
  const MODES = {
    maraton:      { goal: 150, timeLimit: 0 },
    contrarreloj: { goal: 0,   timeLimit: 180000 },
    diaria:       { goal: 80,  timeLimit: 0 },
    libre:        { goal: 0,   timeLimit: 0 },
  };
  const gravityMs = level => Math.max(45, Math.round(850 * Math.pow(0.835, level - 1)));

  /* ---- Aleatoriedad con semilla (mulberry32) ---- */
  function rnd(g) {
    g.rs = (g.rs + 0x6D2B79F5) >>> 0;
    let t = g.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function seedFromString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function refillBag(g) {
    const b = []; for (let i = 0; i < NP; i++) b.push(i);
    for (let i = NP - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
    for (const x of b) g.queue.push(x);
  }

  /* ---- Geometría y colisión ---- */
  function fits(grid, t, rot, q, r) {
    const rc = ROT[t][rot];
    for (let i = 0; i < 4; i++) {
      const cq = q + rc[i][0], cr = r + rc[i][1];
      if (cq < 0 || cq >= W) return false;
      const row = cr + (cq >> 1);
      if (row >= H || row < -TOP) return false;
      if (row >= 0 && grid[row * W + cq] !== 0) return false;
    }
    return true;
  }
  const cellsOf = (t, rot, q, r) => ROT[t][rot].map(([dq, dr]) => [q + dq, r + dr]);
  const lowestY2 = c => { let m = -1e9; for (const [dq, dr] of ROT[c.t][c.rot]) m = Math.max(m, 2 * (c.r + dr) + (c.q + dq)); return m; };
  function spawnPos(t, rot = 0) {
    const q = (W - 1) >> 1; let m = 1e9;
    for (const [dq, dr] of ROT[t][rot]) m = Math.min(m, dr + ((q + dq) >> 1));
    return { q, r: -1 - m };
  }

  /* ---- Partida ---- */
  function create(opts = {}) {
    const mode = MODES[opts.mode] ? opts.mode : 'maraton';
    const g = {
      mode, seed: (opts.seed >>> 0) || 1, rs: 0,
      grid: new Uint8Array(N), gid: new Uint16Array(N), nextId: 1,
      collapse: opts.collapse === 'celda' ? 'celda' : 'cuerpo',
      queue: [], hold: -1, holdUsed: false, cur: null,
      phase: 'play', reason: '',
      score: 0, lines: 0, level: Math.max(1, Math.min(15, opts.startLevel | 0 || 1)), startLevel: Math.max(1, Math.min(15, opts.startLevel | 0 || 1)),
      combo: -1, pieces: 0, elapsed: 0,
      goal: MODES[mode].goal, timeLimit: MODES[mode].timeLimit,
      gravAcc: 0, lockT: 0, lockResets: 0, lowY: -1e9, soft: false,
      resolveT: 0, animT: 0, anim: null,
      rec: opts.rec !== false, keep: opts.keep !== false, events: [],
      stats: { locks: 0, clears: [0, 0, 0, 0, 0, 0, 0], diagSteps: 0, crossSteps: 0, maxChain: 0, chainSteps: 0, perfect: 0, maxCombo: 0 },
    };
    g.rs = g.seed;
    refillBag(g); refillBag(g);
    spawnNext(g);
    return g;
  }
  function emit(g, type, d) {
    if (!g.rec) return;
    if (g.events.length > 200) g.events.shift();
    g.events.push(d ? Object.assign({ type }, d) : { type });
  }
  const drain = g => { const e = g.events; g.events = []; return e; };

  function takeNext(g) {
    while (g.queue.length < 8) refillBag(g);
    return g.queue.shift();
  }
  function place(g, t) {
    const p = spawnPos(t, 0);
    g.cur = { t, rot: 0, q: p.q, r: p.r, ref: 2 * p.r + p.q };
    g.gravAcc = 0; g.lockT = 0; g.lockResets = 0; g.lowY = lowestY2(g.cur);
    if (!fits(g.grid, t, 0, p.q, p.r)) { g.phase = 'over'; g.reason = 'cima'; emit(g, 'over', { reason: 'cima' }); return false; }
    return true;
  }
  function spawnNext(g) {
    g.holdUsed = false;
    if (g.timeLimit && g.elapsed >= g.timeLimit) { g.cur = null; g.phase = 'over'; g.reason = 'tiempo'; emit(g, 'over', { reason: 'tiempo' }); return; }
    place(g, takeNext(g));
  }

  const grounded = g => !fits(g.grid, g.cur.t, g.cur.rot, g.cur.q, g.cur.r + 1);
  function touch(g) {
    const y = lowestY2(g.cur);
    if (y > g.lowY) { g.lowY = y; g.lockResets = 0; }
    if (grounded(g)) { if (g.lockResets < MAX_RESETS) { g.lockT = 0; g.lockResets++; } }
    else g.lockT = 0;
  }

  /* ---- Acciones del jugador ---- */
  function move(g, dir) {
    if (g.phase !== 'play' || !g.cur) return false;
    const c = g.cur;
    const down = dir > 0 ? [1, 0] : [-1, 1], up = dir > 0 ? [1, -1] : [-1, 0];
    const vy = 2 * c.r + c.q;
    const order = Math.abs(vy - 1 - c.ref) < Math.abs(vy + 1 - c.ref) ? [up, down] : [down, up];
    for (const [dq, dr] of order) {
      if (fits(g.grid, c.t, c.rot, c.q + dq, c.r + dr)) { c.q += dq; c.r += dr; touch(g); emit(g, 'move'); return true; }
    }
    return false;
  }
  const KICK_CW  = [[0,0],[-1,1],[-1,0],[1,0],[1,-1],[0,-1],[-2,1],[2,-1],[0,-2],[-1,-1],[1,-2]];
  const KICK_CCW = [[0,0],[1,0],[1,-1],[-1,1],[-1,0],[0,-1],[2,-1],[-2,1],[0,-2],[1,-2],[-1,-1]];
  function rotate(g, dir) {
    if (g.phase !== 'play' || !g.cur) return false;
    const c = g.cur, nr = (c.rot + (dir > 0 ? 1 : 5)) % 6;
    const list = dir > 0 ? KICK_CW : KICK_CCW;
    for (let i = 0; i < list.length; i++) {
      const [dq, dr] = list[i];
      if (fits(g.grid, c.t, nr, c.q + dq, c.r + dr)) {
        c.rot = nr; c.q += dq; c.r += dr; c.ref = 2 * c.r + c.q;
        touch(g); emit(g, 'rotate', { kick: i > 0 }); return true;
      }
    }
    return false;
  }
  function setSoft(g, on) { g.soft = !!on; }
  function stepDown(g) {
    const c = g.cur;
    if (!fits(g.grid, c.t, c.rot, c.q, c.r + 1)) return false;
    c.r += 1; c.ref += 2; return true;
  }
  function dropDistance(g) {
    const c = g.cur; let d = 0;
    while (fits(g.grid, c.t, c.rot, c.q, c.r + d + 1)) d++;
    return d;
  }
  function hardDrop(g) {
    if (g.phase !== 'play' || !g.cur) return false;
    const d = dropDistance(g);
    g.cur.r += d; g.cur.ref += 2 * d; g.score += 2 * d;
    emit(g, 'harddrop', { rows: d });
    lockCur(g);
    return true;
  }
  function holdPiece(g) {
    if (g.phase !== 'play' || !g.cur || g.holdUsed) return false;
    const t = g.cur.t;
    if (g.hold < 0) { g.hold = t; place(g, takeNext(g)); }
    else { const h = g.hold; g.hold = t; place(g, h); }
    g.holdUsed = true; emit(g, 'hold');
    return true;
  }

  /* ---- Resolución: líneas en tres direcciones + derrumbe en cadena ----
     Tras limpiar, lo que queda se derrumba. Modo 'cuerpo' (por defecto): los restos de
     cada pieza que siguen unidos caen juntos hasta apoyarse. Modo 'celda': cada columna se
     compacta celda a celda (más fácil, borra todos los huecos). */
  const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  function collapseBodies(grid, gid, falls) {
    const body = new Int16Array(N).fill(-1), bodies = [];
    for (let i = 0; i < N; i++) {
      if (!grid[i] || body[i] >= 0) continue;
      const id = bodies.length, cells = [i]; body[i] = id;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k], col = c % W, q = col, r = ((c / W) | 0) - (col >> 1);
        for (const [dq, dr] of DIRS) {
          const nq = q + dq; if (nq < 0 || nq >= W) continue;
          const nrow = r + dr + (nq >> 1); if (nrow < 0 || nrow >= H) continue;
          const nb = nrow * W + nq;
          if (grid[nb] && body[nb] < 0 && gid[nb] === gid[i]) { body[nb] = id; cells.push(nb); }
        }
      }
      bodies.push({ id, cells, orig: cells.slice(), dy: 0 });
    }
    const lowest = b => { let m = -1; for (const c of b.cells) { const y = ((c / W) | 0) * 2 + ((c % W) & 1); if (y > m) m = y; } return m; };
    let moved = true, guard = 0;
    while (moved && guard++ < 64) {
      moved = false;
      const order = bodies.slice().sort((a, b) => lowest(b) - lowest(a));
      for (const b of order) {
        let can = true;
        for (const c of b.cells) { if (c + W >= N) { can = false; break; } const nb = c + W; if (grid[nb] !== 0 && body[nb] !== b.id) { can = false; break; } }
        if (!can) continue;
        const cs = b.cells.slice().sort((x, y) => y - x);
        for (const c of cs) { const nb = c + W; grid[nb] = grid[c]; gid[nb] = gid[c]; body[nb] = b.id; grid[c] = 0; gid[c] = 0; body[c] = -1; }
        b.cells = b.cells.map(c => c + W); b.dy++; moved = true;
      }
    }
    for (const b of bodies) if (b.dy > 0) for (let k = 0; k < b.cells.length; k++) falls.push({ from: b.orig[k], to: b.cells[k], t: grid[b.cells[k]] - 1 });
  }
  function collapseColumns(grid, gid, falls) {
    for (let c = 0; c < W; c++) {
      let w = H - 1;
      for (let row = H - 1; row >= 0; row--) {
        const v = grid[row * W + c];
        if (v !== 0) {
          if (row !== w) { falls.push({ from: row * W + c, to: w * W + c, t: v - 1 }); grid[w * W + c] = v; gid[w * W + c] = gid[row * W + c]; grid[row * W + c] = 0; gid[row * W + c] = 0; }
          w--;
        }
      }
    }
  }
  function resolveGrid(grid, gid, level, keep, collapse) {
    const steps = []; let points = 0, totalLines = 0, chain = 0;
    for (;;) {
      const done = [];
      for (const L of LINES) { let ok = true; for (let i = 0; i < W; i++) if (grid[L.idx[i]] === 0) { ok = false; break; } if (ok) done.push(L); }
      if (!done.length) break;
      chain++;
      const kinds = new Set(done.map(l => l.kind));
      const set = new Set(); for (const L of done) for (const i of L.idx) set.add(i);
      const step = { chain, kinds: [...kinds], lines: done.map(l => ({ kind: l.kind, idx: l.idx })), cleared: [], falls: [], before: keep ? grid.slice() : null, mid: null, after: null, points: 0, fallMs: 0 };
      for (const i of set) { step.cleared.push({ i, t: grid[i] - 1 }); grid[i] = 0; gid[i] = 0; }
      if (keep) step.mid = grid.slice();
      if (collapse === 'celda') collapseColumns(grid, gid, step.falls); else collapseBodies(grid, gid, step.falls);
      let maxD = 0; for (const f of step.falls) maxD = Math.max(maxD, ((f.to / W) | 0) - ((f.from / W) | 0));
      step.fallMs = step.falls.length ? Math.min(ANIM.fall + 140, 150 + 60 * maxD) : 0;
      if (keep) step.after = grid.slice();
      const n = done.length;
      const base = n <= 6 ? LINE_PTS[n] : LINE_PTS[6] + (n - 6) * 600;
      step.points = Math.round(base * DIR_MULT[kinds.size] * chain * level);
      points += step.points; totalLines += n;
      steps.push(step);
    }
    let perfect = false;
    if (steps.length) { perfect = true; for (let i = 0; i < N; i++) if (grid[i] !== 0) { perfect = false; break; } }
    let duration = 0;
    for (const s of steps) duration += ANIM.flash + s.fallMs + ANIM.gap;
    return { steps, points, totalLines, perfect, duration };
  }

  function lockCur(g) {
    const c = g.cur, idx = []; let out = false;
    for (const [dq, dr] of ROT[c.t][c.rot]) {
      const cq = c.q + dq, row = c.r + dr + (cq >> 1);
      if (row < 0) out = true; else idx.push(row * W + cq);
    }
    const id = g.nextId++; if (g.nextId > 65000) g.nextId = 1;
    for (const i of idx) { g.grid[i] = c.t + 1; g.gid[i] = id; }
    g.cur = null; g.soft = false;
    if (out) { g.phase = 'over'; g.reason = 'cima'; emit(g, 'lock'); emit(g, 'over', { reason: 'cima' }); return; }
    g.pieces++; g.stats.locks++;
    emit(g, 'lock');
    const res = resolveGrid(g.grid, g.gid, g.level, g.keep, g.collapse);
    if (!res.steps.length) { g.combo = -1; spawnNext(g); return; }
    g.combo++;
    let pts = res.points;
    if (g.combo >= 1) pts += 50 * g.combo * g.level;
    if (res.perfect) { pts += 3000 * g.level; g.stats.perfect++; }
    g.score += pts;
    g.lines += res.totalLines;
    const st = g.stats;
    st.maxCombo = Math.max(st.maxCombo, g.combo);
    st.maxChain = Math.max(st.maxChain, res.steps.length);
    for (const s of res.steps) {
      st.chainSteps++;
      st.clears[Math.min(6, s.lines.length)]++;
      if (s.kinds.some(k => k !== 0)) st.diagSteps++;
      if (s.kinds.length >= 2) st.crossSteps++;
    }
    const oldLevel = g.level;
    g.level = Math.min(20, g.startLevel + Math.floor(g.lines / 10));
    g.phase = 'resolve'; g.anim = res; g.animT = 0; g.resolveT = res.duration;
    emit(g, 'clear', { steps: res.steps.length, lines: res.totalLines, kinds: [...new Set(res.steps.flatMap(s => s.kinds))], points: pts, combo: g.combo, perfect: res.perfect, bestStep: res.steps.reduce((m, s) => Math.max(m, s.lines.length), 0) });
    if (g.level > oldLevel) emit(g, 'levelup', { level: g.level });
  }

  function finishResolve(g) {
    g.anim = null; g.animT = 0; g.resolveT = 0;
    if (g.goal && g.lines >= g.goal) { g.phase = 'won'; g.reason = 'meta'; emit(g, 'won'); return; }
    g.phase = 'play';
    spawnNext(g);
  }

  /* ---- Avance del tiempo ---- */
  function tick(g, dt) {
    if (g.phase === 'resolve') {
      g.elapsed += dt; g.animT += dt; g.resolveT -= dt;
      if (g.resolveT <= 0) finishResolve(g);
      return;
    }
    if (g.phase !== 'play' || !g.cur) return;
    g.elapsed += dt;
    if (g.timeLimit && g.elapsed >= g.timeLimit) { g.phase = 'over'; g.reason = 'tiempo'; g.cur = null; emit(g, 'over', { reason: 'tiempo' }); return; }
    const gMs = gravityMs(g.level);
    const interval = g.soft ? Math.max(28, Math.floor(gMs / 20)) : gMs;
    let left = dt, guard = 0;
    while (left > 0 && g.phase === 'play' && g.cur && guard++ < 400) {
      if (grounded(g)) {
        const need = LOCK_MS - g.lockT;
        if (left >= need) { left -= need; g.lockT = LOCK_MS; lockCur(g); }
        else { g.lockT += left; left = 0; }
      } else {
        const need = interval - g.gravAcc;
        if (left >= need) {
          left -= need; g.gravAcc = 0;
          stepDown(g);
          if (g.soft) g.score += 1;
          if (grounded(g)) { g.lockT = 0; }
        } else { g.gravAcc += left; left = 0; }
      }
    }
  }
  function settle(g) { if (g.phase === 'resolve') { g.resolveT = 0; finishResolve(g); } }

  /* ---- Utilidades para pruebas y bots ---- */
  function clone(g) {
    const n = Object.assign({}, g);
    n.grid = g.grid.slice(); n.gid = g.gid.slice(); n.queue = g.queue.slice(); n.events = [];
    n.cur = g.cur ? Object.assign({}, g.cur) : null;
    n.stats = Object.assign({}, g.stats, { clears: g.stats.clears.slice() });
    n.anim = null;
    return n;
  }
  function hashState(g) {
    return [g.mode, g.seed, g.rs, g.phase, g.score, g.lines, g.level, g.combo, g.hold, g.holdUsed ? 1 : 0, g.pieces,
      g.cur ? [g.cur.t, g.cur.rot, g.cur.q, g.cur.r].join(',') : '-', g.queue.join(''), Array.from(g.grid).join('')].join('|');
  }
  function unstable(grid, gid) { // ¿hay algún cuerpo que aún pudiera caer? (para pruebas)
    const g2 = grid.slice(), id2 = gid.slice(), falls = [];
    collapseBodies(g2, id2, falls); return falls.length > 0;
  }
  function holes(grid) { let n = 0; for (let c = 0; c < W; c++) { let seen = false; for (let r = 0; r < H; r++) { const v = grid[r * W + c]; if (v) seen = true; else if (seen) n++; } } return n; }

  return { W, H, TOP, N, SQ3, PIECES, NP, ROT, LINES, LOCK_MS, MAX_RESETS, ANIM, MODES, LINE_PTS,
    gravityMs, rnd, seedFromString, create, tick, move, rotate, setSoft, hardDrop, holdPiece, drain, settle,
    fits, cellsOf, spawnPos, dropDistance, resolveGrid, clone, hashState, holes, unstable, lowestY2, rotCW };
})();
