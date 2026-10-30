import fs from 'node:fs'; import { loadEngine } from './motor.test.mjs';
const PR = loadEngine(); const code = fs.readFileSync(new URL('./accion-script.js', import.meta.url), 'utf8');
const run = new Function('PR', 'seed', 'mode', code + '; return jugarScript(PR, seed, mode);');
const out = {}; for (let s = 1; s <= 40; s++) out[s] = run(PR, s, ['maraton', 'contrarreloj', 'diaria', 'libre'][s % 4]);
fs.writeFileSync(new URL('./hash-node.json', import.meta.url), JSON.stringify(out)); console.log('hashes de Node escritos:', Object.keys(out).length);
