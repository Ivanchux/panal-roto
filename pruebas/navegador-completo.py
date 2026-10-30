# Batería de pruebas en Chromium sin interfaz: modos, ajustes, entradas, accesibilidad, fin de partida, mando, táctil, rendimiento.
import os, json, time, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath('index.html'); OUT = 'capturas'; os.makedirs(OUT, exist_ok=True)
fails = []; oks = 0; errors = []
def check(c, m):
    global oks
    if c: oks += 1
    else: fails.append(m); print('  FALLA:', m)
PAD = """window.__pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.__pad];"""
def newpage(br, vp=None, touch=False, pad=False, store=None):
    ctx = br.new_context(viewport=vp or {'width': 1280, 'height': 800}, has_touch=touch, is_mobile=touch)
    if pad: ctx.add_init_script(PAD)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
    pg.goto(URL); pg.wait_for_timeout(600); return pg
def start(pg, mode, wait=3000):
    pg.click(f'button[data-mode={mode}]'); pg.wait_for_timeout(wait)
ev = lambda pg, js: pg.evaluate(js)
G = lambda pg, expr: pg.evaluate(f'() => {{ const G = window.__panal.G; return {expr}; }}')
def bot_until(pg, cond_js, limit=90):
    t0 = time.time()
    while time.time() - t0 < limit:
        info = pg.evaluate('() => { const P = window.__panal, G = P.G; return { st: P.state, ph: G && G.phase, done: !!(G && (' + cond_js + ')) }; }')
        if info['done'] or info['st'] not in ('play', 'ready'): return info
        if info['ph'] != 'play': pg.wait_for_timeout(30); continue
        m = pg.evaluate('() => { const P = window.__panal; return P.bestPlan(P.G); }')
        if not m: break
        for _ in range(m['rots']): pg.keyboard.press('KeyX', delay=6)
        for _ in range(m['k']): pg.keyboard.press('ArrowRight' if m['dir'] > 0 else 'ArrowLeft', delay=6)
        pg.keyboard.press('Space', delay=6); pg.wait_for_timeout(20)
    return pg.evaluate('() => ({ st: window.__panal.state })')

with sync_playwright() as p:
    br = p.chromium.launch()

    print('1) Modos y semilla diaria')
    pg = newpage(br)
    for mode, goal, tl in [('maraton', 150, 0), ('contrarreloj', 0, 180000), ('diaria', 80, 0)]:
        pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); start(pg, mode, 2900)
        check(G(pg, 'G.mode') == mode and G(pg, 'G.goal') == goal and G(pg, 'G.timeLimit') == tl, f'modo {mode} con meta {goal} y límite {tl}')
        check(ev(pg, 'window.__panal.state') == 'play', f'{mode}: tras la cuenta atrás se juega')
    seq1 = G(pg, '[G.cur.t, ...G.queue.slice(0, 12)]'); seed1 = G(pg, 'G.seed')
    pg.close(); pg2 = newpage(br); start(pg2, 'diaria', 2900)
    check(G(pg2, '[G.cur.t, ...G.queue.slice(0, 12)]') == seq1 and G(pg2, 'G.seed') == seed1, 'partida diaria: misma semilla y mismas piezas en cargas distintas')
    pg2.close()

    print('2) Ajustes: persistencia, DAS/ARR, accesibilidad')
    pg = newpage(br); pg.click('#b-set'); pg.wait_for_timeout(200)
    pg.evaluate("() => { const e = document.getElementById('s-das'); e.value = 200; e.dispatchEvent(new Event('input', {bubbles: true})); const c = document.getElementById('s-cb'); c.checked = true; c.dispatchEvent(new Event('change', {bubbles: true})); }")
    pg.screenshot(path=f'{OUT}/ajustes.png')
    pg.reload(); pg.wait_for_timeout(500)
    check(ev(pg, 'window.__panal.S.das') == 200 and ev(pg, 'window.__panal.S.cb') is True, 'los ajustes sobreviven a recargar')
    pg.evaluate('window.__panal.S = Object.assign(window.__panal.S, {cb:false, das:135})'); pg.evaluate('window.__panal.apply()')

    print('3) Entradas: DAS/ARR, giro, reserva, pausa')
    start(pg, 'libre' if False else 'maraton', 2900)
    q0 = G(pg, 'G.cur.q'); pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(900); pg.keyboard.up('ArrowRight')
    cols = G(pg, 'window.__panal.PR.ROT[G.cur.t][G.cur.rot].map(c => G.cur.q + c[0])')
    check(max(cols) == 8, f'DAS/ARR lleva la pieza hasta la pared derecha (columnas {cols})')
    rot0 = G(pg, 'G.cur.rot'); pg.keyboard.press('KeyX'); check(G(pg, 'G.cur.rot') == (rot0 + 1) % 6, 'X gira en sentido horario')
    pg.keyboard.press('KeyZ'); check(G(pg, 'G.cur.rot') == rot0, 'Z gira al revés')
    t0 = G(pg, 'G.cur.t'); pg.keyboard.press('KeyC'); check(G(pg, 'G.hold') == t0 and G(pg, 'G.holdUsed') is True, 'C guarda la pieza en reserva')
    cur = G(pg, 'G.cur.t'); pg.keyboard.press('KeyC'); check(G(pg, 'G.cur.t') == cur and G(pg, 'G.hold') == t0, 'no se puede reservar dos veces seguidas')
    pg.keyboard.press('KeyP'); pg.wait_for_timeout(150); el = G(pg, 'G.elapsed'); pg.wait_for_timeout(600)
    check(ev(pg, 'window.__panal.state') == 'pause' and G(pg, 'G.elapsed') == el, 'pausa detiene el reloj')
    pg.screenshot(path=f'{OUT}/pausa.png'); pg.keyboard.press('KeyP'); pg.wait_for_timeout(300)
    check(ev(pg, 'window.__panal.state') == 'play', 'P reanuda')
    pg.evaluate('window.__panal.S.arr = 0'); r0 = G(pg, 'G.cur.q'); pg.keyboard.down('ArrowLeft'); pg.wait_for_timeout(450); pg.keyboard.up('ArrowLeft')
    cols = G(pg, 'window.__panal.PR.ROT[G.cur.t][G.cur.rot].map(c => G.cur.q + c[0])'); check(min(cols) == 0, 'ARR 0 va a la pared de golpe (izquierda)')
    pg.evaluate('window.__panal.S.arr = 35')

    print('4) Partida con bot hasta una limpieza; reducir movimiento sin fragmentos; modo daltónico')
    pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); start(pg, 'maraton', 2900)
    pg.evaluate("() => { window.__panal.S.rm = true; window.__panal.apply(); }")
    maxparts = 0
    bot_until(pg, 'G.lines >= 3', 60); 
    maxparts = ev(pg, 'window.__panal.R.fx.parts.length')
    check(maxparts == 0, f'con "reducir movimiento" no hay fragmentos ({maxparts})')
    pg.evaluate("() => { window.__panal.S.rm = false; window.__panal.S.cb = true; window.__panal.apply(); }")
    bot_until(pg, 'G.pieces >= 14', 40); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/daltonico.png')
    pg.evaluate("() => { window.__panal.S.cb = false; window.__panal.apply(); }")

    print('5) Fin de partida: desbordamiento, meta y tiempo')
    pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); start(pg, 'maraton', 2900)
    for _ in range(30):
        pg.keyboard.press('Space', delay=4)
        if ev(pg, 'window.__panal.state') == 'over': break
    pg.wait_for_timeout(1300)
    check(ev(pg, 'window.__panal.state') == 'over' and 'desbordado' in pg.inner_text('#t-over').lower(), 'el panal se desborda y sale el cierre')
    pg.screenshot(path=f'{OUT}/fin.png')
    pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); start(pg, 'maraton', 2900)
    pg.evaluate('window.__panal.G.goal = 2'); bot_until(pg, "G.phase === 'won'", 60); pg.wait_for_timeout(1000)
    check('completado' in pg.inner_text('#t-over').lower() and ev(pg, 'window.__panal.state') == 'over', 'al llegar a la meta se completa el panal')
    pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); start(pg, 'contrarreloj', 2900)
    pg.evaluate('window.__panal.G.elapsed = 179900'); pg.wait_for_timeout(1500)
    check('tiempo' in pg.inner_text('#t-over').lower(), 'contrarreloj termina al agotarse el tiempo')
    pg.evaluate('window.__panal.toMenu()'); pg.wait_for_timeout(200); pg.click('#b-how'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/como-se-juega.png', full_page=False)
    pg.close()

    print('6) Mando (Gamepad API simulada)')
    pg = newpage(br, pad=True); start(pg, 'maraton', 2900)
    setb = lambda i, v: pg.evaluate(f'window.__pad.buttons[{i}].pressed = {str(v).lower()}')
    q0 = G(pg, 'G.cur.q'); setb(15, True); pg.wait_for_timeout(500); setb(15, False)
    check(G(pg, 'G.cur.q') > q0 + 1, 'cruceta derecha mueve la pieza con repetición')
    r0 = G(pg, 'G.cur.rot'); setb(0, True); pg.wait_for_timeout(120); setb(0, False); pg.wait_for_timeout(80); check(G(pg, 'G.cur.rot') == (r0 + 1) % 6, 'A gira')
    n0 = G(pg, 'G.pieces'); setb(3, True); pg.wait_for_timeout(120); setb(3, False); pg.wait_for_timeout(80); check(G(pg, 'G.pieces') == n0 + 1, 'Y hace caída directa')
    setb(9, True); pg.wait_for_timeout(120); setb(9, False); pg.wait_for_timeout(150); check(ev(pg, 'window.__panal.state') == 'pause', 'Start pausa')
    pg.close()

    print('7) Táctil: botones y gestos')
    pg = newpage(br, {'width': 390, 'height': 780}, touch=True); start(pg, 'maraton', 2900)
    check(pg.evaluate("document.getElementById('touch').classList.contains('on')"), 'la barra táctil aparece en pantallas táctiles')
    q0 = G(pg, 'G.cur.q')
    pg.evaluate("() => { const b = document.querySelector('#touch [data-act=right]'); b.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 5, bubbles: true})); }"); pg.wait_for_timeout(450)
    pg.evaluate("() => { const b = document.querySelector('#touch [data-act=right]'); b.dispatchEvent(new PointerEvent('pointerup', {pointerId: 5, bubbles: true})); }")
    check(G(pg, 'G.cur.q') > q0 + 1, 'botón táctil derecha mueve y repite')
    r0 = G(pg, 'G.cur.rot'); pg.evaluate("() => { const c = document.getElementById('cv'), r = c.getBoundingClientRect(); const o = {pointerId: 7, pointerType: 'touch', bubbles: true, clientX: r.left + r.width * 0.75, clientY: r.top + r.height * 0.5}; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); }")
    pg.wait_for_timeout(100); check(G(pg, 'G.cur.rot') == (r0 + 1) % 6, 'toque en la mitad derecha gira en horario')
    n0 = G(pg, 'G.pieces'); pg.evaluate("() => { const c = document.getElementById('cv'), r = c.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + 200; c.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 9, pointerType: 'touch', bubbles: true, clientX: x, clientY: y})); c.dispatchEvent(new PointerEvent('pointermove', {pointerId: 9, pointerType: 'touch', bubbles: true, clientX: x, clientY: y + 160})); c.dispatchEvent(new PointerEvent('pointerup', {pointerId: 9, pointerType: 'touch', bubbles: true, clientX: x, clientY: y + 160})); }")
    pg.wait_for_timeout(100); check(G(pg, 'G.pieces') == n0 + 1, 'deslizar rápido hacia abajo hace caída directa')
    pg.close()

    print('8) Determinismo cruzado Node ↔ navegador')
    code = open('pruebas/accion-script.js').read(); node = json.load(open('pruebas/hash-node.json'))
    pg = newpage(br); mism = 0
    for s in range(1, 41):
        h = pg.evaluate("([code, seed, mode]) => new Function('PR', 'seed', 'mode', code + '; return jugarScript(PR, seed, mode);')(window.__panal.PR, seed, mode)", [code, s, ['maraton', 'contrarreloj', 'diaria', 'libre'][s % 4]])
        if h != node[str(s)]: mism += 1
    check(mism == 0, f'40 partidas con semilla fija dan el mismo estado final en Node y en Chromium (diferencias: {mism})')

    print('9) Rendimiento durante la partida')
    start(pg, 'maraton', 2900)
    pg.evaluate("() => { window.__dts = []; let l = performance.now(); const f = n => { window.__dts.push(n - l); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); }")
    bot_until(pg, 'G.pieces >= 25', 30)
    d = pg.evaluate("() => { const a = window.__dts.slice(5).sort((x, y) => x - y); return { n: a.length, med: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1] }; }")
    print('  fotogramas (ms):', d); check(d['p95'] < 50, f'p95 de fotograma < 50 ms en CPU sin GPU ({d})')
    br.close()
print('\nCOMPROBACIONES CORRECTAS:', oks, '· FALLOS:', len(fails)); [print(' -', f) for f in fails]
print('CONSOLA:', 'sin errores ni avisos' if not errors else json.dumps(errors, ensure_ascii=False))
sys.exit(1 if fails or errors else 0)
