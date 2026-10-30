# Prueba en navegador sin interfaz (Chromium): errores de consola, capturas y una partida real con teclado.
import sys, time, json, os
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath('index.html')
OUT = 'capturas'; os.makedirs(OUT, exist_ok=True)
errors = []

def run(p, name, viewport, mobile=False, pieces=40, seed=None):
    ctx = p.chromium.launch().new_context(viewport=viewport, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append((name, m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append((name, 'pageerror', str(e))))
    page.goto(URL); page.wait_for_timeout(2500)
    page.screenshot(path=f'{OUT}/{name}-menu.png')
    page.click('button[data-mode=maraton]'); page.wait_for_timeout(3000)
    st = page.evaluate('window.__panal.state'); print(name, 'estado tras iniciar:', st)
    page.screenshot(path=f'{OUT}/{name}-inicio.png')
    shots = 0; placed = 0; t0 = time.time(); maxChain = 0
    while placed < pieces and time.time() - t0 < 120:
        info = page.evaluate('''() => { const P = window.__panal, G = P.G; if (!G) return null; return { phase: G.phase, pieces: G.pieces, score: G.score, lines: G.lines, animT: G.animT, steps: G.anim ? G.anim.steps.length : 0, state: P.state }; }''')
        if not info or info['state'] != 'play' and info['state'] != 'ready': break
        if info['phase'] == 'resolve':
            if shots < 3 and info['animT'] > 120 and info['steps'] >= 1:
                page.screenshot(path=f'{OUT}/{name}-limpieza-{shots}.png'); shots += 1
            page.wait_for_timeout(40); continue
        if info['phase'] != 'play': break
        m = page.evaluate('() => { const P = window.__panal; return P.bestPlan(P.G); }')
        if not m: break
        for _ in range(m['rots']): page.keyboard.press('KeyX', delay=8)
        for _ in range(m['k']): page.keyboard.press('ArrowRight' if m['dir'] > 0 else 'ArrowLeft', delay=8)
        page.keyboard.press('Space', delay=8); placed += 1
        page.wait_for_timeout(30)
    fin = page.evaluate('() => { const G = window.__panal.G; return G && { score: G.score, lines: G.lines, pieces: G.pieces, phase: G.phase, level: G.level, maxChain: G.stats.maxChain, diag: G.stats.diagSteps }; }')
    print(name, 'partida real con teclado:', json.dumps(fin))
    page.screenshot(path=f'{OUT}/{name}-partida.png')
    ctx.close(); return fin

with sync_playwright() as p:
    run(p, 'escritorio', {'width': 1280, 'height': 800}, pieces=int(sys.argv[1]) if len(sys.argv) > 1 else 40)
    run(p, 'movil', {'width': 390, 'height': 780}, mobile=True, pieces=25)
print('ERRORES/AVISOS DE CONSOLA:', json.dumps(errors, ensure_ascii=False, indent=1) if errors else 'ninguno')
