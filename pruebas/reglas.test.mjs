// Pruebas de reglas del juego: gravedad, retardo de bloqueo, empujes de pared, fantasma, puntuación y combos.
import { loadEngine } from './motor.test.mjs';
const PR = loadEngine(); let fails = 0, oks = 0;
const ok = (c, m) => { if (c) oks++; else { fails++; console.log('FALLA:', m); } };

// niveles de velocidad
ok(PR.gravityMs(1) === 850, 'nivel 1 = 850 ms por fila');
let mono = true; for (let l = 2; l <= 20; l++) if (PR.gravityMs(l) > PR.gravityMs(l - 1)) mono = false; ok(mono, 'la velocidad nunca baja al subir de nivel');
ok(PR.gravityMs(20) === 45, 'suelo de 45 ms');

// gravedad
{ const g = PR.create({ seed: 11, mode: 'libre' }); const r0 = g.cur.r; PR.tick(g, 849); ok(g.cur.r === r0, 'no baja antes de tiempo'); PR.tick(g, 2); ok(g.cur.r === r0 + 1, 'baja una fila a los 850 ms'); }

// retardo de bloqueo
{ const g = PR.create({ seed: 11, mode: 'libre' }); const d = PR.dropDistance(g); g.cur.r += d; g.cur.ref += 2 * d;
  PR.tick(g, 1); PR.tick(g, 497); ok(g.cur && g.pieces === 0, 'apoyada, sigue libre a los 498 ms'); PR.tick(g, 3); ok(g.pieces === 1, 'se bloquea a los 500 ms'); }
// límite de reinicios del retardo
{ const g = PR.create({ seed: 12, mode: 'libre' }); const d = PR.dropDistance(g); g.cur.r += d; g.cur.ref += 2 * d; PR.tick(g, 1);
  let i = 0; for (; i < 60 && g.pieces === 0; i++) { PR.tick(g, 400); if (g.pieces) break; PR.move(g, i % 2 ? 1 : -1); }
  ok(g.pieces === 1 && i <= 20, 'tras 15 reinicios la pieza se bloquea aunque se siga moviendo (bloqueó en la vuelta ' + i + ')'); }
// un movimiento reinicia el retardo
{ const g = PR.create({ seed: 13, mode: 'libre' }); const d = PR.dropDistance(g); g.cur.r += d; g.cur.ref += 2 * d; PR.tick(g, 450); const moved = PR.move(g, 1); PR.tick(g, 450); ok(!moved || g.pieces === 0, 'mover reinicia el retardo de bloqueo'); }
// caída suave más rápida
{ const g = PR.create({ seed: 14, mode: 'libre' }); const r0 = g.cur.r; PR.setSoft(g, true); PR.tick(g, 200); ok(g.cur.r - r0 >= 4 && g.score >= 4, 'la caída suave baja varias filas y suma puntos'); }
// empujes de pared: girar seis veces seguidas pegada a cada pared en tablero vacío
for (const col of [0, 1, 7, 8]) for (let t = 0; t < PR.NP; t++) {
  const g = PR.create({ seed: 15, mode: 'libre' }); g.queue.unshift(t); PR.holdPiece(g); // fuerza otra pieza no necesario; usamos cur directo
  g.cur = { t, rot: 0, q: 4, r: 4, ref: 12 }; g.holdUsed = false;
  while (PR.move(g, col < 4 ? -1 : 1) && (col < 4 ? Math.min(...PR.ROT[t][g.cur.rot].map(c => g.cur.q + c[0])) > col : Math.max(...PR.ROT[t][g.cur.rot].map(c => g.cur.q + c[0])) < col)) { /* a la pared */ }
  let all = true; for (let k = 0; k < 6; k++) if (!PR.rotate(g, 1)) all = false; ok(all, `seis giros seguidos junto a la pared (pieza ${t}, columna ${col})`);
  ok(PR.fits(g.grid, g.cur.t, g.cur.rot, g.cur.q, g.cur.r), 'pieza válida tras los empujes');
}
// el fantasma coincide con donde cae la pieza
{ let bad = 0, n = 0; for (let s = 1; s <= 300; s++) { const g = PR.create({ seed: s, mode: 'libre' }); const R = PR.rnd; for (let k = 0; k < 4; k++) { if (R(g) < 0.5) PR.rotate(g, 1); PR.move(g, R(g) < 0.5 ? -1 : 1); }
    const c = g.cur, d = PR.dropDistance(g), expected = PR.ROT[c.t][c.rot].map(([dq, dr]) => { const q = c.q + dq, r = c.r + dr + d; return r + (q >> 1) + ',' + q; });
    const lines0 = g.lines; PR.hardDrop(g); if (g.anim) { PR.settle(g); continue; } n++;
    for (const e of expected) { const [row, col] = e.split(',').map(Number); if (row < 0 || g.grid[row * 9 + col] !== c.t + 1) { bad++; break; } } }
  ok(bad === 0 && n > 100, 'el fantasma marca exactamente dónde se posa la pieza (' + n + ' casos, ' + bad + ' fallos)'); }
// niveles por líneas
{ const g = PR.create({ seed: 1, mode: 'libre', startLevel: 3 }); ok(g.level === 3, 'nivel inicial'); }

// puntuación: recalculada de forma independiente en partidas del bot
const pts = [0, 100, 300, 500, 800, 1200, 1800], mult = [1, 1, 1.5, 2];
function heights(grid) { const h = []; for (let c = 0; c < 9; c++) { let r = 0; while (r < 16 && !grid[r * 9 + c]) r++; h.push(16 - r); } return h; }
function plan(g) { let best = null; const tryPos = (b, rots, dir, k) => { const c = PR.clone(b); c.rec = false; c.keep = false; const l0 = c.lines; PR.hardDrop(c); const h = heights(c.grid); let a = 0; for (const x of h) a += x; const sc = (c.lines - l0) * 3 - a * 0.3 - PR.holes(c.grid); if (!best || sc > best.sc) best = { sc, rots, dir, k }; };
  for (let rots = 0; rots < 6; rots++) { const a = PR.clone(g); a.rec = false; a.keep = false; let ok2 = true; for (let i = 0; i < rots; i++) if (!PR.rotate(a, 1)) { ok2 = false; break; } if (!ok2) continue; tryPos(a, rots, 0, 0);
    for (const dir of [-1, 1]) { const b = PR.clone(a); for (let k = 1; k <= 9; k++) { if (!PR.move(b, dir)) break; tryPos(b, rots, dir, k); } } } return best; }
let checked = 0, scoreBad = 0, comboBad = 0, clearsSeen = 0;
for (let s = 1; s <= 25; s++) {
  const g = PR.create({ seed: 500 + s, mode: 'libre', rec: false }); let combo = -1;
  for (let i = 0; i < 160 && g.phase === 'play'; i++) {
    const m = plan(g); if (!m) break; for (let r = 0; r < m.rots; r++) PR.rotate(g, 1); for (let k = 0; k < m.k; k++) PR.move(g, m.dir);
    const s0 = g.score, lv = g.level, d = PR.dropDistance(g), l0 = g.lines;
    PR.hardDrop(g);
    let exp = 2 * d;
    if (g.anim && g.anim.steps.length) {
      clearsSeen++; combo++; let ln = 0;
      g.anim.steps.forEach((st, idx) => { const n = st.lines.length, kinds = new Set(st.lines.map(l => l.kind)).size; const base = n <= 6 ? pts[n] : 1800 + (n - 6) * 600; exp += Math.round(base * mult[kinds] * (idx + 1) * lv); ln += n; });
      if (combo >= 1) exp += 50 * combo * lv; if (g.anim.perfect) exp += 3000 * lv;
      if (g.lines - l0 !== ln) comboBad++;
    } else combo = -1;
    if (g.score - s0 !== exp) { scoreBad++; if (scoreBad < 3) console.log('  puntos reales', g.score - s0, 'esperados', exp); }
    if (g.combo !== combo) comboBad++;
    if (g.level !== Math.min(20, 1 + Math.floor(g.lines / 10))) comboBad++;
    checked++; PR.settle(g);
  }
}
ok(scoreBad === 0 && checked > 500, `la puntuación coincide con el cálculo independiente en ${checked} bloqueos (${clearsSeen} limpiezas, ${scoreBad} fallos)`);
ok(comboBad === 0, 'combos, líneas y niveles coherentes (' + comboBad + ' fallos)');
console.log(fails ? 'FALLOS: ' + fails : 'reglas.test: ' + oks + ' comprobaciones correctas'); process.exit(fails ? 1 : 0);
