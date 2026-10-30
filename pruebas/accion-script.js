// Juega una partida determinista (acciones elegidas con un PRNG propio) y devuelve el hash del estado final.
function jugarScript(PR, seed, mode) {
  let s = (seed * 7919 + 13) >>> 0;
  const R = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = PR.create({ seed, mode, rec: true, collapse: 'cuerpo' });
  for (let i = 0; i < 1500 && g.phase !== 'over' && g.phase !== 'won'; i++) {
    const x = R();
    if (g.phase === 'resolve') PR.tick(g, 16 + R() * 400);
    else if (x < 0.22) PR.move(g, -1); else if (x < 0.44) PR.move(g, 1); else if (x < 0.60) PR.rotate(g, 1); else if (x < 0.70) PR.rotate(g, -1);
    else if (x < 0.75) PR.holdPiece(g); else if (x < 0.80) PR.setSoft(g, R() < 0.5); else if (x < 0.88) PR.hardDrop(g); else PR.tick(g, R() * 700);
    PR.drain(g);
  }
  return PR.hashState(g);
}
