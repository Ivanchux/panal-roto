// Busca una semilla en la que el bot listo provoque una cadena larga y guarda sus jugadas para reproducirlas en el navegador.
import fs from 'node:fs'; import { loadEngine } from './motor.test.mjs';
const PR = loadEngine();
function heights(grid) { const h = []; for (let c = 0; c < 9; c++) { let r = 0; while (r < 16 && !grid[r * 9 + c]) r++; h.push(16 - r); } return h; }
function evalBoard(c, gained, steps) { if (c.phase === 'over') return -1e6; const h = heights(c.grid); let agg = 0, bump = 0, mx = 0; for (let i = 0; i < 9; i++) { agg += h[i]; mx = Math.max(mx, h[i]); if (i) bump += Math.abs(h[i] - h[i - 1]); }
  return gained * 3 + (steps > 1 ? steps * 1.5 : 0) - agg * 0.3 - PR.holes(c.grid) - bump * 0.18 - (mx > 11 ? (mx - 11) * 2.5 : 0); }
function plan(g) { let best = null; const tryPos = (b, rots, dir, k) => { const c = PR.clone(b); c.rec = false; c.keep = false; const l0 = c.lines; PR.hardDrop(c); const sc = evalBoard(c, c.lines - l0, c.anim ? c.anim.steps.length : 0); if (!best || sc > best.sc) best = { sc, rots, dir, k }; };
  for (let rots = 0; rots < 6; rots++) { const a = PR.clone(g); a.rec = false; a.keep = false; let ok = true; for (let i = 0; i < rots; i++) if (!PR.rotate(a, 1)) { ok = false; break; } if (!ok) continue; tryPos(a, rots, 0, 0);
    for (const dir of [-1, 1]) { const b = PR.clone(a); for (let k = 1; k <= 9; k++) { if (!PR.move(b, dir)) break; tryPos(b, rots, dir, k); } } } return best; }
const want = +(process.argv[2] || 4); let found = null;
for (let seed = 1; seed < 4000 && !found; seed++) {
  const g = PR.create({ mode: 'maraton', seed, rec: false }); const acts = [], trace = [];
  for (let i = 0; i < 70 && g.phase === 'play'; i++) {
    const m = plan(g); if (!m) break; acts.push([m.rots, m.dir, m.k]);
    for (let r = 0; r < m.rots; r++) PR.rotate(g, 1); for (let k = 0; k < m.k; k++) PR.move(g, m.dir); PR.hardDrop(g);
    if (g.anim && g.anim.steps.length >= want) { found = { seed, acts, trace, chain: g.anim.steps.length, lines: g.anim.totalLines, score: g.score, hash: null }; PR.settle(g); found.trace = trace.concat([0]); found.hash = [Array.from(g.grid).join(''), g.score, g.lines, g.pieces, g.queue.join(''), g.hold].join('|'); break; }
    PR.settle(g); trace.push([Array.from(g.grid).join(''), g.score, g.lines, g.pieces, g.queue.join(''), g.hold].join('|'));
  }
}
console.log(found ? 'semilla ' + found.seed + ' · cadena ' + found.chain + ' tras ' + found.acts.length + ' piezas' : 'sin resultado');
if (found) fs.writeFileSync(new URL('./cadena.json', import.meta.url), JSON.stringify(found));
