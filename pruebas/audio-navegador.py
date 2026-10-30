# Comprueba que el sonido sintetizado suena (no es silencio), no satura y la música no se corta. Mide la salida real con un AnalyserNode.
import os, json, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath('index.html')
TAP = """(() => { const Base = window.AudioContext; window.__tap = { samples: [], ctxState: '' };
  window.AudioContext = class extends Base { constructor() { super(); const an = this.createAnalyser(); an.fftSize = 2048; an.connect(super.destination); this.__an = an; const buf = new Float32Array(2048);
    setInterval(() => { an.getFloatTimeDomainData(buf); let pk = 0, s = 0; for (const v of buf) { pk = Math.max(pk, Math.abs(v)); s += v * v; } window.__tap.samples.push([pk, Math.sqrt(s / buf.length)]); window.__tap.ctxState = this.state; }, 40); }
    get destination() { return this.__an; } }; })();"""
fails = []
def check(c, m):
    if not c: fails.append(m); print('  FALLA:', m)
    else: print('  ok:', m)
with sync_playwright() as p:
    br = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); ctx = br.new_context(); ctx.add_init_script(TAP); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(400); pg.click('button[data-mode=maraton]'); pg.wait_for_timeout(500)
    mark = lambda: pg.evaluate('window.__tap.samples.length')
    def window_stats(a, b):
        s = pg.evaluate(f'window.__tap.samples.slice({a}, {b})'); pk = max([x[0] for x in s] or [0]); rms = sum(x[1] for x in s) / max(1, len(s)); live = sum(1 for x in s if x[0] > 0.004) / max(1, len(s)); return pk, rms, live, len(s)
    print('estado del contexto de audio:', pg.evaluate('window.__tap.ctxState'))
    a = mark(); pg.wait_for_timeout(6000); b = mark(); pk, rms, live, n = window_stats(a, b)
    print(f'  música nivel 1 · pico {pk:.3f} · RMS medio {rms:.4f} · fracción con señal {live:.2f} · {n} muestras')
    check(pk > 0.02 and pk < 0.98, 'la música suena (pico entre 0,02 y 0,98) en el nivel 1'); check(live > 0.6, 'la música no se corta durante 6 s')
    pg.evaluate('SND.musicSetLevel(12)'); a = mark(); pg.wait_for_timeout(6000); b = mark(); pk, rms, live, n = window_stats(a, b)
    print(f'  música nivel 12 · pico {pk:.3f} · RMS medio {rms:.4f} · fracción con señal {live:.2f}')
    check(pk < 0.98 and rms > 0.003, 'con todas las capas no satura y tiene cuerpo')
    pg.evaluate('SND.musicStop()'); pg.wait_for_timeout(800)
    for name, arg in [('move', {}), ('rotate', {}), ('rotate', {'kick': True}), ('hold', {}), ('land', {}), ('harddrop', {}), ('clear', {'lines': 1, 'chain': 1}), ('clear', {'lines': 4, 'chain': 3, 'cross': True}), ('fall', {}), ('levelup', {}), ('perfect', {}), ('over', {}), ('won', {}), ('ui', {})]:
        pg.wait_for_timeout(700); a = mark(); pg.evaluate(f'SND.sfx({json.dumps(name)}, {json.dumps(arg)})'); pg.wait_for_timeout(900); b = mark(); pk, rms, live, n = window_stats(a, b)
        print(f'  efecto {name} {json.dumps(arg)} · pico {pk:.3f}'); check(0.01 < pk < 0.98, f'efecto {name} audible y sin saturar')
    check(not errs, 'sin errores de página durante el audio: ' + str(errs)); br.close()
print('\nAUDIO:', 'todo correcto' if not fails else 'FALLOS ' + str(len(fails))); sys.exit(1 if fails else 0)
