// Genera los datos de piezas (orientación de aparición y pivote) a partir de la enumeración
const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const rotCW = ([q,r]) => [-r, q+r];
const mirror = ([q,r]) => [q+r, -r];
const norm = cells => { const mq=Math.min(...cells.map(c=>c[0])), mr=Math.min(...cells.map(c=>c[1]));
  return cells.map(([q,r])=>[q-mq,r-mr]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]); };
const key = cells => norm(cells).map(c=>c.join(',')).join(';');
let fixed = new Map(); fixed.set('0,0', [[0,0]]);
for (let n=1;n<4;n++){ const nx=new Map();
  for (const cells of fixed.values()) for (const [q,r] of cells) for (const [dq,dr] of DIRS){
    const c=[q+dq,r+dr]; if (cells.some(x=>x[0]===c[0]&&x[1]===c[1])) continue;
    const nc=norm([...cells,c]); nx.set(key(nc), nc); } fixed=nx; }
const classes = new Map();
for (const cells of fixed.values()){ let best=null, c=cells;
  for (let i=0;i<6;i++){ const k=key(c); if(best===null||k<best) best=k; c=c.map(rotCW); }
  if(!classes.has(best)) classes.set(best, cells); }
const keys=[...classes.keys()].sort();
const canon = cells => { let best=null,c=cells; for(let i=0;i<6;i++){const k=key(c); if(best===null||k<best)best=k; c=c.map(rotCW);} return best; };
const dist=(a,b)=>{const dq=a[0]-b[0],dr=a[1]-b[1];return (Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2;};
const out=[];
for (const k of keys){
  const cells=classes.get(k);
  const mk=canon(cells.map(mirror)); const chiral = mk!==k;
  // orientación de aparición: menor alto, luego menor ancho
  let best=null, c=cells;
  for (let i=0;i<6;i++){
    const ys=c.map(([q,r])=>r+q/2), qs=c.map(x=>x[0]);
    const h=Math.max(...ys)-Math.min(...ys), w=Math.max(...qs)-Math.min(...qs);
    const sc=[h,w,key(c)];
    if(!best||sc[0]<best.sc[0]-1e-9||(Math.abs(sc[0]-best.sc[0])<1e-9&&(sc[1]<best.sc[1]||(sc[1]===best.sc[1]&&sc[2]<best.sc[2])))) best={sc,c};
    c=c.map(rotCW);
  }
  // pivote
  let pv=best.c[0],bs=1e9; for(const a of best.c){const s=best.c.reduce((t,b)=>t+dist(a,b),0); if(s<bs){bs=s;pv=a;}}
  out.push({key:k, chiral, mirrorKey:mk, cells:best.c.map(([q,r])=>[q-pv[0],r-pv[1]]), h:best.sc[0], w:best.sc[1]});
}
out.forEach((p,i)=>console.log(i, p.key, p.chiral?'quiral->'+keys.indexOf(p.mirrorKey):'simétrica', JSON.stringify(p.cells), 'h',p.h,'w',p.w));
