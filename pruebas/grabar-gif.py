# Reproduce en Chromium la partida de la semilla con cadena larga (las mismas jugadas, con teclado real) y la graba para el README.
import os, json, time, subprocess, shutil, glob
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath('index.html'); data = json.load(open('pruebas/cadena.json')); acts = data['acts']; TAIL = 4
shutil.rmtree('/tmp/video', ignore_errors=True)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 820, 'height': 700}, record_video_dir='/tmp/video', record_video_size={'width': 820, 'height': 700}); pg = ctx.new_page()
    t_start = time.time(); pg.goto(URL); pg.wait_for_timeout(500)
    pg.evaluate(f"window.__panal.start('maraton', {data['seed']})"); pg.wait_for_timeout(3000)
    # avance rápido por el motor (sin tiempo) hasta unas piezas antes de la cadena
    pre = acts[:-TAIL]
    pg.evaluate("""(acts) => { const P = window.__panal, PR = P.PR, G = P.G; for (const [rots, dir, k] of acts) { for (let i = 0; i < rots; i++) PR.rotate(G, 1); for (let i = 0; i < k; i++) PR.move(G, dir); PR.hardDrop(G); PR.settle(G); } PR.drain(G); }""", pre)
    pg.wait_for_timeout(300); t_cut = time.time() - t_start
    for rots, dir, k in acts[-TAIL:]:
        for _ in range(rots): pg.keyboard.press('KeyX', delay=8)
        for _ in range(k): pg.keyboard.press('ArrowRight' if dir > 0 else 'ArrowLeft', delay=8)
        pg.wait_for_timeout(240); pg.keyboard.press('Space', delay=8)
        while pg.evaluate("window.__panal.G.phase") == 'resolve': pg.wait_for_timeout(30)
        pg.wait_for_timeout(200)
    pg.wait_for_timeout(1300)
    h = pg.evaluate("(() => { const g = window.__panal.G; return [Array.from(g.grid).join(''), g.score, g.lines, g.pieces, g.queue.join(''), g.hold].join('|'); })()")
    a, b = h.split('|'), data['hash'].split('|')
    print('tablero, líneas, piezas, cola y reserva finales idénticos a los de Node:', [a[i] for i in (0, 2, 3, 4, 5)] == [b[i] for i in (0, 2, 3, 4, 5)], '· puntos (navegador/Node):', a[1], b[1], '(la diferencia son los puntos de caída directa: en tiempo real la gravedad baja alguna fila antes)')
    ctx.close(); br.close()
vid = glob.glob('/tmp/video/*.webm')[0]
os.makedirs('capturas', exist_ok=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t_cut + 0.2:.2f}', '-i', vid, '-vf', 'fps=9,crop=660:700:80:0,scale=440:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=56[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5', 'capturas/cadena.gif'], check=True)
print('GIF:', round(os.path.getsize('capturas/cadena.gif') / 1024), 'KB')
