// Mide cuánto se parecen entre sí los colores de las piezas con visión normal y con simulación de daltonismo (Machado 2009, severidad 1,0).
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const MAT = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
function lab(rgbLin) {
  const [r, g, b] = rgbLin.map(v => Math.min(1, Math.max(0, v)));
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116, fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const sim = (hex, m) => { const c = hex2(hex).map(lin); return MAT[m].map(row => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]); };
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function minDist(pal) {
  const out = {};
  for (const m of Object.keys(MAT)) {
    const L = pal.map(h => lab(sim(h, m))); let best = 1e9, pair = '';
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const d = dE(L[i], L[j]); if (d < best) { best = d; pair = i + '-' + j; } }
    out[m] = { min: +best.toFixed(1), par: pair };
  }
  return out;
}
if (process.argv[1].endsWith('paleta-daltonismo.mjs')) {
  const normal = ['#ff6b4a', '#ff9f1c', '#ffd166', '#e63e8d', '#efe6c8', '#2ec4b6', '#8e6bff', '#ff8fb8', '#8ae6ff', '#8bd450'];
  const cb = ['#D55E00', '#F0E442', '#88CCEE', '#B07AA1', '#F5F5F5', '#009E73', '#7570B3', '#A65628', '#FF9DA7', '#B2DF8A'];
  console.log('normal', JSON.stringify(minDist(normal))); console.log('modo daltónico', JSON.stringify(minDist(cb)));
  // búsqueda: elegir 10 de un grupo de candidatos maximizando la distancia mínima en las cuatro visiones
  const pool = ['#D55E00', '#E69F00', '#F0E442', '#CC79A7', '#FFFFFF', '#009E73', '#0072B2', '#9A9A9A', '#56B4E9', '#44AA99', '#332288', '#882255', '#DDCC77', '#88CCEE', '#AA4499', '#117733', '#999933', '#CC6677', '#6A3D9A', '#FB9A99', '#B2DF8A', '#FDBF6F', '#1F78B4', '#A6CEE3', '#FF7F00', '#CAB2D6', '#B15928', '#33A02C', '#E31A1C', '#7FC97F', '#BEAED4', '#F5F5F5', '#6E6E6E', '#1B9E77', '#7570B3', '#E7298A'];
  const score = pal => { const r = minDist(pal); return Math.min(...Object.values(r).map(v => v.min)); };
  let best = null, bestS = 0, rnd = 12345; const R = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
  for (let it = 0; it < 60000; it++) { const idx = new Set(); while (idx.size < 10) idx.add(Math.floor(R() * pool.length)); const pal = [...idx].map(i => pool[i]); const s = score(pal); if (s > bestS) { bestS = s; best = pal; } }
  console.log('mejor conjunto encontrado (mín. ΔE entre dos piezas, en el peor tipo de visión):', bestS.toFixed(1), JSON.stringify(best)); console.log(JSON.stringify(minDist(best)));
}
