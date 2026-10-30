// Enumera los tetrahexes (4 celdas hexagonales) en coordenadas axiales y los reduce a clases "de un solo lado"
const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const rotCW = ([q,r]) => [-r, q+r];
const norm = cells => { const mq=Math.min(...cells.map(c=>c[0])), mr=Math.min(...cells.map(c=>c[1]));
  return cells.map(([q,r])=>[q-mq,r-mr]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]); };
const key = cells => norm(cells).map(c=>c.join(',')).join(';');
let fixed = new Map(); fixed.set(key([[0,0]]), [[0,0]]);
for (let n=1;n<4;n++){ const nx=new Map();
  for (const cells of fixed.values()) for (const [q,r] of cells) for (const [dq,dr] of DIRS){
    const c=[q+dq,r+dr]; if (cells.some(x=>x[0]===c[0]&&x[1]===c[1])) continue;
    const nc=norm([...cells,c]); nx.set(key(nc), nc); }
  fixed=nx; }
console.log('fijos:', fixed.size);
const classes = new Map();
for (const cells of fixed.values()){
  let best=null, c=cells;
  for (let i=0;i<6;i++){ const k=key(c); if(best===null||k<best) best=k; c=c.map(rotCW); }
  if(!classes.has(best)) classes.set(best, cells);
}
console.log('un solo lado:', classes.size);
const mirror = ([q,r]) => [q+r, -r];
const free = new Set();
for (const cells of classes.values()){ let b=null; for (const m of [false,true]){ let c=m?cells.map(mirror):cells; for(let i=0;i<6;i++){const k=key(c); if(b===null||k<b)b=k; c=c.map(rotCW);} } free.add(b); }
console.log('libres:', free.size);
// dibujo ASCII (hex de punta plana): x = 2*q, y = 2*r + q
for (const [k,cells] of classes){
  const pts = cells.map(([q,r])=>[3*q, 2*r+q]); const mx=Math.min(...pts.map(p=>p[0])), my=Math.min(...pts.map(p=>p[1]));
  const W=Math.max(...pts.map(p=>p[0]))-mx+3, Hh=Math.max(...pts.map(p=>p[1]))-my+1;
  const g=Array.from({length:Hh},()=>Array(W).fill(' '));
  pts.forEach(([x,y])=>{ g[y-my][x-mx]='['; g[y-my][x-mx+1]=']'; });
  console.log(k); console.log(g.map(r=>r.join('')).join('\n')); console.log();
}
