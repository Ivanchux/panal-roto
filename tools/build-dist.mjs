#!/usr/bin/env node
// Genera dist/ y un .zip listo para subir a itch.io como juego HTML5.
// Uso: node tools/build-dist.mjs   (Node 22 o superior; necesita el comando `zip` para el .zip)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILES = ['index.html', 'favicon.ico', 'favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'];
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(dist, f));

// Las etiquetas para compartir el enlace apuntan a GitHub Pages: fuera del paquete de itch.io.
const htmlPath = path.join(dist, 'index.html');
fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').split('\n').filter(l => !/property="og:image"|name="twitter:card"/.test(l)).join('\n'));

// Comprobaciones: nada de terceros y rutas relativas.
const html = fs.readFileSync(htmlPath, 'utf8');
const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(m => m[0]).filter(u => !u.startsWith('http://www.w3.org/'));
if (urls.length) { console.error('Hay direcciones externas en index.html:', urls); process.exit(1); }
if (/(src|href)=["']\//.test(html)) { console.error('Hay rutas absolutas en index.html'); process.exit(1); }

const name = path.basename(root) + '-html5.zip';
const zip = path.join(root, name);
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-9', '-r', zip, '.'], { cwd: dist });
let total = 0;
for (const f of fs.readdirSync(dist)) total += fs.statSync(path.join(dist, f)).size;
console.log(`dist/: ${fs.readdirSync(dist).length} archivos, ${(total / 1024).toFixed(1)} KB`);
console.log(`${name}: ${(fs.statSync(zip).size / 1024).toFixed(1)} KB`);
