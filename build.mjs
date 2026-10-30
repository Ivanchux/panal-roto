// Une las partes en un único index.html sin dependencias
import fs from 'node:fs';
const rd = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
let html = rd('template.html');
const parts = { css: rd('style.css'), engine: rd('engine.js'), render: rd('render.js'), audio: rd('audio.js'), app: rd('app.js') };
for (const [k, v] of Object.entries(parts)) { if (/<\/script/i.test(v)) throw new Error('</script> dentro de ' + k); html = html.replace('/*@@' + k + '@@*/', () => v); }
fs.writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB,', html.split('\n').length, 'líneas');
