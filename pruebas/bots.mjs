// Bots de prueba: aleatorio (fuzz de acciones) y heurístico (juega "bien"), con semilla fija e invariantes.
import { loadEngine } from './motor.test.mjs';
const PR = loadEngine();
const W = PR.W, H = PR.H;
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const NFUZZ = +(args.fuzz ?? 3000), NSMART = +(args.smart ?? 300), MAXP = +(args.maxp ?? 500), COLL = args.collapse ?? 'cuerpo';
function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const problems = new Map();
const bad = (kind, info) => { const k = kind; if (!problems.has(k)) problems.set(k, { n: 0, ex: info }); problems.get(k).n++; };

function complete(grid) { for (const L of PR.LINES) { let ok = true; for (const i of L.idx) if (!grid[i]) { ok = false; break; } if (ok) return true; } return false; }
const count = grid => { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i]) n++; return n; };
function invariants(g, prev, ctx) {
  for (let i = 0; i < PR.N; i++) if (g.grid[i] < 0 || g.grid[i] > 10) { bad('celda fuera de rango', ctx); break; }
  if (g.cur && g.phase === 'play' && !PR.fits(g.grid, g.cur.t, g.cur.rot, g.cur.q, g.cur.r)) bad('pieza activa solapada o fuera del tablero', ctx + JSON.stringify(g.cur));
  if (g.phase !== 'over' && complete(g.grid)) bad('queda una línea completa sin resolver', ctx);
  if (g.score < prev.score) bad('la puntuación baja', ctx);
  if (g.lines < prev.lines) bad('las líneas bajan', ctx);
  if (g.level !== Math.min(20, g.startLevel + Math.floor(g.lines / 10))) bad('nivel incoherente', ctx);
  if (g.queue.length < 7) bad('cola corta', ctx);
  if (g.phase === 'play' && !g.cur) bad('fase play sin pieza', ctx);
  if (g.cur && g.cur.ref === undefined) bad('ref indefinido', ctx);
  if (g.phase === 'play' && g.cur) { const d = PR.dropDistance(g); const c = g.cur; if (PR.fits(g.grid, c.t, c.rot, c.q, c.r + d + 1)) bad('fantasma no apoya', ctx); }
}

/* ---------- Bot aleatorio ---------- */
const fuzzStats = { games: 0, over: 0, won: 0, locks: 0, clears: 0, maxChain: 0, kicks: 0, rot: 0, holds: 0 };
function fuzzGame(seed, mode) {
  const R = prng(seed * 7919 + 13), g = PR.create({ seed, mode, rec: true, collapse: COLL });
  let steps = 0;
  while (g.phase !== 'over' && g.phase !== 'won' && steps < 1500) {
    const before = { score: g.score, lines: g.lines, cnt: count(g.grid), ph: g.phase };
    const x = R(); let act;
    if (g.phase === 'resolve') { PR.tick(g, 16 + R() * 400); act = 'tick-res'; }
    else if (x < 0.22) { PR.move(g, -1); act = 'L'; }
    else if (x < 0.44) { PR.move(g, 1); act = 'R'; }
    else if (x < 0.60) { PR.rotate(g, 1); act = 'cw'; }
    else if (x < 0.70) { PR.rotate(g, -1); act = 'ccw'; }
    else if (x < 0.75) { PR.holdPiece(g); act = 'hold'; }
    else if (x < 0.80) { PR.setSoft(g, R() < 0.5); act = 'soft'; }
    else if (x < 0.88) { PR.hardDrop(g); act = 'hard'; }
    else { PR.tick(g, R() * 700); act = 'tick'; }
    for (const e of PR.drain(g)) { if (e.type === 'rotate') { fuzzStats.rot++; if (e.kick) fuzzStats.kicks++; } if (e.type === 'hold') fuzzStats.holds++; }
    invariants(g, before, `fuzz seed=${seed} modo=${mode} paso=${steps} acción=${act} `);
    // conservación de celdas: tras bloqueo sin cambio de pieza no se pierden celdas salvo por limpieza
    const cnt = count(g.grid);
    if (g.phase === 'resolve' && g.anim && before.ph !== 'resolve') { const cl = g.anim.steps.reduce((a, s) => a + s.cleared.length, 0); if (cnt !== before.cnt + 4 - cl) bad('no se conservan las celdas al derrumbar', `${cnt} vs ${before.cnt}+4-${cl}`); if (COLL === 'celda' ? PR.holes(g.grid) !== 0 : PR.unstable(g.grid, g.gid)) bad('el derrumbe no ha terminado de asentarse', ctxStr(seed, steps)); }
    steps++;
  }
  fuzzStats.games++; fuzzStats.locks += g.stats.locks; fuzzStats.clears += g.stats.chainSteps; fuzzStats.maxChain = Math.max(fuzzStats.maxChain, g.stats.maxChain);
  if (g.phase === 'over') fuzzStats.over++; if (g.phase === 'won') fuzzStats.won++;
  return PR.hashState(g);
}
const ctxStr = (s, i) => `semilla=${s} paso=${i}`;

/* ---------- Bot heurístico ---------- */
function heights(grid) { const h = []; for (let c = 0; c < W; c++) { let r = 0; while (r < H && !grid[r * W + c]) r++; h.push(H - r); } return h; }
function evalBoard(c, linesGained, steps) {
  if (c.phase === 'over') return -1e6;
  const h = heights(c.grid); let agg = 0, bump = 0, mx = 0; for (let i = 0; i < W; i++) { agg += h[i]; mx = Math.max(mx, h[i]); if (i) bump += Math.abs(h[i] - h[i - 1]); }
  return linesGained * 3.0 + (steps > 1 ? steps * 1.5 : 0) - agg * 0.30 - PR.holes(c.grid) * 1.0 - bump * 0.18 - (mx > 11 ? (mx - 11) * 2.5 : 0);
}
function bestPlacement(g) {
  let best = null;
  const tryPos = (b, rots, dir, k) => {
    const c = PR.clone(b); c.rec = false; c.keep = false; const l0 = c.lines;
    PR.hardDrop(c);
    const gained = c.lines - l0; const steps = c.anim ? c.anim.steps.length : 0;
    const sc = evalBoard(c, gained, steps);
    if (!best || sc > best.sc) best = { sc, rots, dir, k };
  };
  for (let rots = 0; rots < 6; rots++) {
    const a = PR.clone(g); a.rec = false; a.keep = false; let ok = true;
    for (let i = 0; i < rots; i++) if (!PR.rotate(a, 1)) { ok = false; break; }
    if (!ok) continue;
    tryPos(a, rots, 0, 0);
    for (const dir of [-1, 1]) { const b = PR.clone(a); for (let k = 1; k <= 9; k++) { if (!PR.move(b, dir)) break; tryPos(b, rots, dir, k); } }
  }
  return best;
}
function smartGame(seed, mode, usesHold) {
  const g = PR.create({ seed, mode, rec: false, keep: false, collapse: COLL });
  let guard = 0;
  while (g.phase !== 'over' && g.phase !== 'won' && g.pieces < MAXP && guard++ < MAXP * 4) {
    if (g.phase === 'resolve') { PR.settle(g); continue; }
    const before = { score: g.score, lines: g.lines }, cnt0 = count(g.grid);
    const m = bestPlacement(g); if (!m) break;
    for (let i = 0; i < m.rots; i++) PR.rotate(g, 1);
    for (let k = 0; k < m.k; k++) PR.move(g, m.dir);
    PR.hardDrop(g);
    if (g.phase === 'resolve') { const cl = g.anim.steps.reduce((a, st) => a + st.cleared.length, 0); if (count(g.grid) !== cnt0 + 4 - cl) bad('(bot listo) no se conservan las celdas al derrumbar', ctxStr(seed, g.pieces)); if (PR.unstable(g.grid, g.gid)) bad('(bot listo) derrumbe sin asentar', ctxStr(seed, g.pieces)); }
    PR.settle(g);
    invariants(g, before, `listo seed=${seed} pieza=${g.pieces} `);
  }
  return g;
}

console.time('fuzz');
const modes = ['maraton', 'contrarreloj', 'diaria', 'libre'];
let det = 0;
for (let s = 1; s <= NFUZZ; s++) { const mode = modes[s % 4]; const h1 = fuzzGame(s, mode); if (s % 50 === 0) { const h2 = fuzzGame(s, mode); if (h1 !== h2) bad('partida no determinista', 'semilla ' + s); det++; } }
console.timeEnd('fuzz');
console.log('derrumbe:', COLL); console.log('FUZZ', JSON.stringify(fuzzStats), 'comprobaciones de determinismo:', det);

console.time('listo');
const agg = { games: 0, pieces: 0, lines: 0, score: 0, maxLines: 0, maxScore: 0, maxChain: 0, diagSteps: 0, crossSteps: 0, steps: 0, perfect: 0, over: 0, won: 0, capped: 0, clears: [0,0,0,0,0,0,0], levelMax: 0, combo: 0 };
const chainHist = {};
for (let s = 1; s <= NSMART; s++) {
  const g = smartGame(1000 + s, s % 2 ? 'maraton' : 'libre');
  agg.games++; agg.pieces += g.pieces; agg.lines += g.lines; agg.score += g.score; agg.maxLines = Math.max(agg.maxLines, g.lines); agg.maxScore = Math.max(agg.maxScore, g.score);
  agg.maxChain = Math.max(agg.maxChain, g.stats.maxChain); agg.diagSteps += g.stats.diagSteps; agg.crossSteps += g.stats.crossSteps; agg.steps += g.stats.chainSteps; agg.perfect += g.stats.perfect;
  agg.levelMax = Math.max(agg.levelMax, g.level); agg.combo = Math.max(agg.combo, g.stats.maxCombo);
  g.stats.clears.forEach((n, i) => agg.clears[i] += n);
  chainHist[g.stats.maxChain] = (chainHist[g.stats.maxChain] || 0) + 1;
  if (g.phase === 'over') agg.over++; else if (g.phase === 'won') agg.won++; else agg.capped++;
}
console.timeEnd('listo');
console.log('LISTO', JSON.stringify(agg));
console.log('mejor cadena por partida (histograma):', JSON.stringify(chainHist));
console.log('media piezas/partida', (agg.pieces / agg.games).toFixed(1), '· líneas/partida', (agg.lines / agg.games).toFixed(1), '· líneas por pieza', (agg.lines / agg.pieces).toFixed(3));
console.log('proporción de pasos de limpieza con diagonal:', (agg.diagSteps / Math.max(1, agg.steps)).toFixed(3), '· con cruce de 2+ direcciones:', (agg.crossSteps / Math.max(1, agg.steps)).toFixed(3));
if (problems.size) { console.log('\nPROBLEMAS DETECTADOS:'); for (const [k, v] of problems) console.log(' -', k, '×' + v.n, '· ejemplo:', v.ex); process.exit(1); }
else console.log('\nSin estados imposibles ni fallos de colisión en', fuzzStats.games, 'partidas aleatorias y', agg.games, 'partidas del bot listo.');
