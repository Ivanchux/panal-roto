// Pruebas unitarias del motor. Se extrae el código real de index.html (o de src/engine.js si no existe aún).
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
export function loadEngine() {
  const html = path.join(dir, '..', 'index.html');
  let code;
  if (fs.existsSync(html)) { const m = fs.readFileSync(html, 'utf8').match(/<script id="engine">([\s\S]*?)<\/script>/); code = m[1]; }
  else code = fs.readFileSync(path.join(dir, '..', 'src', 'engine.js'), 'utf8');
  return new vm.Script(code + '\nPR;').runInNewContext({ Math, Uint8Array, Set, Object, Array, JSON });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PR = loadEngine(); let fails = 0;
  const ok = (c, m) => { if (!c) { fails++; console.log('FALLA:', m); } };
  // piezas
  ok(PR.NP === 10, '10 piezas');
  const norm = cells => { const mq = Math.min(...cells.map(c => c[0])), mr = Math.min(...cells.map(c => c[1])); return cells.map(([q, r]) => [q - mq, r - mr]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).join(';'); };
  const canon = cells => { let b = null, c = cells; for (let i = 0; i < 6; i++) { const k = norm(c); if (b === null || k < b) b = k; c = c.map(PR.rotCW); } return b; };
  const set = new Set(PR.PIECES.map(p => canon(p.cells)));
  ok(set.size === 10, 'las 10 piezas son clases distintas bajo rotación');
  const conn = cells => { const s = new Set(cells.map(c => c.join(','))); const seen = new Set([cells[0].join(',')]); const st = [cells[0]]; const D = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
    while (st.length) { const [q, r] = st.pop(); for (const [a, b] of D) { const k = (q + a) + ',' + (r + b); if (s.has(k) && !seen.has(k)) { seen.add(k); st.push([q + a, r + b]); } } } return seen.size === 4; };
  PR.PIECES.forEach((p, i) => { ok(p.cells.length === 4 && conn(p.cells), 'pieza conexa de 4: ' + p.name);
    ok(p.cells.some(c => c[0] === 0 && c[1] === 0), 'pivote en el origen: ' + p.name);
    for (let k = 0; k < 6; k++) ok(conn(PR.ROT[i][k]) && canon(PR.ROT[i][k]) === canon(p.cells), 'rotación ' + k + ' conserva forma: ' + p.name);
    // seis rotaciones horarias = identidad
    let c = p.cells; for (let k = 0; k < 6; k++) c = c.map(PR.rotCW); ok(JSON.stringify(c) === JSON.stringify(p.cells), 'seis giros = identidad: ' + p.name);
    if (p.mirror >= 0) ok(PR.PIECES[p.mirror].mirror === i, 'espejo recíproco: ' + p.name); });
  // líneas
  ok(PR.LINES.length === 40, 'hay 40 líneas, hay ' + PR.LINES.length);
  const byKind = [0, 0, 0]; PR.LINES.forEach(L => { byKind[L.kind]++; ok(L.idx.length === 9, 'línea de 9'); ok(new Set(L.idx.map(i => i % PR.W)).size === 9, 'una celda por columna');
    // continuidad: celdas consecutivas son vecinas hexagonales
    for (let c = 0; c < 8; c++) { const a = L.idx[c], b = L.idx[c + 1]; const qa = a % 9, ra = Math.floor(a / 9) - (qa >> 1), qb = b % 9, rb = Math.floor(b / 9) - (qb >> 1); const dq = qb - qa, dr = rb - ra; ok(Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr) === 2, 'celdas consecutivas vecinas'); } });
  ok(byKind[0] === 16 && byKind[1] === 12 && byKind[2] === 12, 'franjas 16, "/" 12, "\\" 12: ' + byKind);
  // aparición dentro del tablero y sin chocar en tablero vacío
  const g0 = PR.create({ seed: 5 });
  for (let t = 0; t < PR.NP; t++) for (let rot = 0; rot < 6; rot++) { const p = PR.spawnPos(t, rot); ok(PR.fits(g0.grid, t, rot, p.q, p.r), 'aparición válida ' + t + '/' + rot); }
  // bolsa justa
  for (const seed of [1, 7, 99, 12345, 4000000000]) { const g1 = PR.create({ seed }); const seq = [g1.cur.t, ...g1.queue].slice(0, 20);
    for (const b of [0, 10]) ok(new Set(seq.slice(b, b + 10)).size === 10, 'bolsa justa (cada 10 piezas, las 10) semilla ' + seed); }
  // misma semilla, misma secuencia; semillas distintas, secuencias distintas
  const sa = PR.create({ seed: 42 }), sb = PR.create({ seed: 42 }), sc = PR.create({ seed: 43 });
  ok(PR.hashState(sa) === PR.hashState(sb), 'misma semilla = mismo estado'); ok(PR.hashState(sa) !== PR.hashState(sc), 'semilla distinta = estado distinto');
  ok(PR.seedFromString('2026-10-20') === PR.seedFromString('2026-10-20') && PR.seedFromString('2026-10-20') !== PR.seedFromString('2026-10-21'), 'semilla del día estable');
  // derrumbe: rellenar una franja salvo una celda y completar con la pieza -> comprobar limpieza y caída
  const gg = PR.create({ seed: 3, mode: 'libre' });
  for (let c = 0; c < 9; c++) if (c !== 4) gg.grid[15 * 9 + c] = 1;
  gg.grid[14 * 9 + 2] = 2; gg.grid[13 * 9 + 2] = 2; // una columna apilada encima
  const before = Array.from(gg.grid).filter(Boolean).length;
  gg.grid[15 * 9 + 4] = 3; // celda que completa la franja inferior
  gg.gid[14 * 9 + 2] = 7; gg.gid[13 * 9 + 2] = 7; gg.gid[15 * 9 + 4] = 8;
  const res = PR.resolveGrid(gg.grid, gg.gid, 1, true, 'cuerpo');
  ok(res.steps.length >= 1 && res.totalLines >= 1, 'se limpia la franja inferior');
  ok(Array.from(gg.grid).filter(Boolean).length === before + 1 - res.steps.reduce((a, s) => a + s.cleared.length, 0), 'las celdas se conservan al derrumbar');
  ok(gg.grid[15 * 9 + 2] === 2 && gg.grid[14 * 9 + 2] === 2 && gg.grid[13 * 9 + 2] === 0, 'la columna cae una fila');
  // un cuerpo apoyado en otro NO cae; un cuerpo sin apoyo SÍ cae hasta apoyarse y deja hueco bajo el voladizo
  const h = PR.create({ seed: 4, mode: 'libre' });
  const put = (c, r, t, id) => { h.grid[r * 9 + c] = t; h.gid[r * 9 + c] = id; };
  for (let c = 0; c < 9; c++) if (c !== 0) put(c, 15, 1, 100 + c);   // franja inferior casi completa
  put(0, 15, 3, 200);                                                   // celda que la completa (pieza 200)
  put(0, 14, 3, 200);                                                   // resto de la pieza 200 sobre ella
  put(1, 14, 4, 300); put(1, 13, 4, 300);                               // cuerpo 300 apoyado sobre la franja
  put(5, 12, 5, 400);                                                   // cuerpo 400 flotando (sin apoyo)
  const r2 = PR.resolveGrid(h.grid, h.gid, 1, true, 'cuerpo');
  ok(r2.steps.length >= 1, 'franja limpia (cuerpos)');
  ok(!PR.unstable(h.grid, h.gid), 'tras derrumbar no queda nada que pueda caer');
  ok(h.grid[15 * 9 + 5] === 5, 'la celda flotante cae hasta el suelo');
  ok(h.grid[15 * 9 + 0] === 3 && h.grid[15 * 9 + 1] === 4 && h.grid[14 * 9 + 1] === 4, 'los restos caen como cuerpos');
  console.log(fails ? 'FALLOS: ' + fails : 'motor.test: todo correcto');
  process.exit(fails ? 1 : 0);
}
