/* ============================================================
   PANAL ROTO · interfaz, entradas, modos y bucle principal
   ============================================================ */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage'), live = $('live'), touchBar = $('touch');
  const { SQ3, ANIM } = PR;
  const KEY_S = 'panalroto.ajustes.v1', KEY_R = 'panalroto.records.v1';
  const prefersReduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ajustes y récords ---------- */
  const DEF = { das: 135, arr: 35, soft: 20, ghost: true, touch: 'auto', level: 1, mus: 50, sfx: 70, cb: false, rm: prefersReduce };
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  let S = Object.assign({}, DEF, store.get(KEY_S, {}));
  let REC = store.get(KEY_R, { maraton: null, contrarreloj: null, diaria: {} });
  if (!REC.diaria) REC.diaria = {};
  const saveS = () => store.set(KEY_S, S), saveR = () => store.set(KEY_R, REC);
  const pad2 = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };

  /* ---------- estado ---------- */
  let G = null, mode = 'maraton', appState = 'menu', countdown = 0, L = null, last = 0, lastRes = null;
  let settingsFrom = 'menu', lastSeed = 0;
  const held = { left: false, right: false, down: false };
  const das = { dir: 0, t: 0, rep: false, acc: 0 };
  const view = { nextN: 5, hooks: null };

  function applySettings() {
    R.cfg.cb = !!S.cb; R.cfg.ghost = !!S.ghost; R.cfg.reduce = !!S.rm;
    document.body.classList.toggle('rm', !!S.rm);
    SND.setVol('sfx', S.sfx / 100); SND.setVol('mus', S.mus / 100);
    const wantTouch = S.touch === 'on' || (S.touch === 'auto' && window.matchMedia && matchMedia('(pointer: coarse)').matches);
    touchBar.classList.toggle('on', wantTouch);
    resize();
  }
  function resize() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    R.cfg.dpr = dpr; cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    L = R.computeLayout(r.width, r.height);
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------- superposiciones ---------- */
  const overlays = ['menu', 'how', 'settings', 'pause', 'over'];
  function show(id) { for (const o of overlays) $(o).classList.toggle('on', o === id); if (id) { const b = $(id).querySelector('button, input, select'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 30); } }
  const hideAll = () => show(null);
  const anyOverlay = () => overlays.some(o => $(o).classList.contains('on'));
  function announce(t) { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); }

  function refreshMenu() {
    $('best-maraton').textContent = REC.maraton ? 'Récord ' + R.fmt(REC.maraton.score) : '';
    $('best-contrarreloj').textContent = REC.contrarreloj ? 'Récord ' + R.fmt(REC.contrarreloj.score) : '';
    const d = REC.diaria[today()];
    $('best-diaria').textContent = d ? 'Hoy ' + R.fmt(d.score) : '';
    $('daily-sub').textContent = 'Mismas piezas para todos hoy (' + today() + ') · 80 líneas';
  }

  /* ---------- partida ---------- */
  function seedFor(m) { return m === 'diaria' ? PR.seedFromString('panal-roto/' + today()) : ((Math.random() * 4294967296) >>> 0) || 1; }
  function startGame(m, seed) {
    SND.init(); mode = m; lastSeed = seed || seedFor(m);
    G = PR.create({ mode: m, seed: lastSeed, startLevel: m === 'diaria' ? 1 : S.level, collapse: 'cuerpo' });
    held.left = held.right = held.down = false; das.dir = 0; R.clearFx();
    view.hooks = gameHooks; appState = 'ready'; countdown = 2700; hideAll();
    SND.musicStart(G.level); SND.sfx('ui');
    announce('Empieza ' + R.MODE_NAME[m]);
  }
  function togglePause(force) {
    if (appState === 'play' || appState === 'ready') { appState = 'pause'; held.left = held.right = held.down = false; das.dir = 0; show('pause'); SND.sfx('ui'); }
    else if (appState === 'pause' && force !== 'pause') { appState = countdown > 0 ? 'ready' : 'play'; hideAll(); SND.sfx('ui'); }
  }
  function toMenu() { SND.musicStop(); appState = 'menu'; G = null; R.clearFx(); refreshMenu(); show('menu'); startAttract(); }

  function endGame() {
    appState = 'over'; SND.musicStop(); held.left = held.right = held.down = false; das.dir = 0;
    const g = G, won = g.phase === 'won', reason = g.reason;
    let record = false;
    if (mode === 'diaria') { const k = today(), p = REC.diaria[k]; if (!p || g.score > p.score) { REC.diaria[k] = { score: g.score, lines: g.lines, won }; record = true; } }
    else { const p = REC[mode]; if (!p || g.score > p.score) { REC[mode] = { score: g.score, lines: g.lines, won }; record = true; } }
    saveR();
    lastRes = { score: g.score, lines: g.lines, level: g.level, pieces: g.pieces, chain: g.stats.maxChain, combo: g.stats.maxCombo + 1, time: g.elapsed, diag: g.stats.diagSteps, won, date: today() };
    const title = won ? '¡Panal completado!' : reason === 'tiempo' ? 'Se acabó el tiempo' : 'El panal se ha desbordado';
    $('t-over').innerHTML = title + (record ? ' <span class="badge">Récord</span>' : '');
    $('over-sub').textContent = R.MODE_NAME[mode] + (mode === 'diaria' ? ' · ' + today() : '');
    const rows = [['Puntos', R.fmt(g.score)], ['Líneas', String(g.lines)], ['Nivel', String(g.level)], ['Piezas', String(g.pieces)], ['Mejor cadena', '×' + Math.max(1, g.stats.maxChain)], ['Mejor combo', g.stats.maxCombo >= 1 ? '×' + (g.stats.maxCombo + 1) : '—'], ['Limpiezas en diagonal', String(g.stats.diagSteps)], ['Tiempo', R.fmtTe(g.elapsed)]];
    $('over-stats').innerHTML = rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('');
    $('o-share').hidden = mode !== 'diaria';
    SND.sfx(won ? 'won' : 'over'); announce(title + '. ' + R.fmt(g.score) + ' puntos.');
    setTimeout(() => { if (appState === 'over') show('over'); }, won ? 600 : 900);
  }

  /* ---------- eventos del motor y efectos ---------- */
  const LINE_NAMES = ['', 'LÍNEA', 'DOBLE', 'TRIPLE', 'CUÁDRUPLE', 'ENJAMBRE', 'ENJAMBRE'];
  const gameHooks = {
    shatter(st, idx, res) {
      const n = st.lines.length, cross = st.kinds.length > 1;
      SND.sfx('clear', { lines: n, chain: st.chain, cross });
      if (st.falls.length) setTimeout(() => SND.sfx('fall'), 120);
      R.addShake(Math.min(1.6, 0.35 + n * 0.28 + (st.chain - 1) * 0.3));
      const names = st.kinds.map(k => ['franja', 'diagonal /', 'diagonal \\'][k]);
      const main = st.chain > 1 ? 'CADENA ×' + st.chain : LINE_NAMES[Math.min(6, n)] + (cross ? ' CRUZADA' : '');
      R.popup(L, main, '+' + R.fmt(st.points), st.chain > 1 ? '#ff9f6b' : cross ? '#8ae6ff' : '#ffd166', st.chain > 1 || n >= 3);
      if (idx === res.steps.length - 1) {
        if (res.perfect) { R.popup(L, 'PANAL LIMPIO', '+' + R.fmt(3000 * (G ? G.level : 1)), '#b6f2a0', true); SND.sfx('perfect'); R.addShake(1.4); }
        if (G && G.combo >= 1) R.popup(L, 'COMBO ×' + (G.combo + 1), null, '#ffb0d0', false);
      }
    },
  };
  function consume() {
    for (const e of PR.drain(G)) {
      switch (e.type) {
        case 'move': SND.sfx('move'); break;
        case 'rotate': SND.sfx('rotate', { kick: e.kick }); break;
        case 'hold': SND.sfx('hold'); break;
        case 'lock': SND.sfx('land'); R.addShake(0.18); break;
        case 'harddrop': SND.sfx('harddrop'); R.addShake(Math.min(0.9, 0.25 + e.rows * 0.05)); break;
        case 'clear': announce(e.lines + (e.lines === 1 ? ' línea' : ' líneas') + (e.steps > 1 ? ', cadena de ' + e.steps : '') + ', ' + R.fmt(e.points) + ' puntos'); break;
        case 'levelup': SND.sfx('levelup'); SND.musicSetLevel(e.level); R.popup(L, 'NIVEL ' + e.level, null, '#ffe08a', true); announce('Nivel ' + e.level); break;
        case 'over': case 'won': break;
      }
    }
  }

  /* ---------- entradas ---------- */
  const canPlay = () => appState === 'play' && G && G.phase === 'play' && !anyOverlay();
  function doMove(d) { return PR.move(G, d); }
  function press(act) {
    if (!canPlay()) { if (appState === 'play' && G && G.phase === 'resolve') { if (act === 'left') { held.left = true; das.dir = -1; das.t = 0; das.rep = false; } else if (act === 'right') { held.right = true; das.dir = 1; das.t = 0; das.rep = false; } else if (act === 'down') held.down = true; } return; }
    switch (act) {
      case 'left': held.left = true; das.dir = -1; das.t = 0; das.rep = false; das.acc = 0; doMove(-1); break;
      case 'right': held.right = true; das.dir = 1; das.t = 0; das.rep = false; das.acc = 0; doMove(1); break;
      case 'down': held.down = true; break;
      case 'cw': PR.rotate(G, 1); break;
      case 'ccw': PR.rotate(G, -1); break;
      case 'hold': PR.holdPiece(G); break;
      case 'drop': hardDrop(); break;
    }
  }
  function release(act) {
    if (act === 'left') { held.left = false; if (das.dir === -1) { das.dir = held.right ? 1 : 0; das.t = 0; das.rep = false; } }
    else if (act === 'right') { held.right = false; if (das.dir === 1) { das.dir = held.left ? -1 : 0; das.t = 0; das.rep = false; } }
    else if (act === 'down') held.down = false;
  }
  function hardDrop() {
    const c = G.cur, d = PR.dropDistance(G), cells = [];
    for (const [dq, dr] of PR.ROT[c.t][c.rot]) { const [x, y] = R.axialXY(L, c.q + dq, c.r + dr); cells.push({ x, y0: y, y1: y + d * SQ3 * L.s }); }
    if (d > 0) R.addTrail(L, cells, c.t);
    PR.hardDrop(G);
  }
  function repeatMove(dt) {
    if (!das.dir || !G || appState !== 'play') return;
    if (!das.rep) das.t += dt;
    if (G.phase !== 'play') return;
    if (!das.rep) {
      if (das.t < S.das) return;
      das.rep = true; das.acc = 0;
      if (S.arr === 0) { for (let i = 0; i < 20 && doMove(das.dir); i++); return; }
      doMove(das.dir); return;
    }
    if (S.arr === 0) { for (let i = 0; i < 20 && doMove(das.dir); i++); return; }
    das.acc += dt;
    while (das.acc >= S.arr) { das.acc -= S.arr; if (!doMove(das.dir)) { das.acc = 0; break; } }
  }

  /* silencio y pantalla completa (también dentro de un iframe, como en itch.io) */
  function toggleMute() { SND.setMuted(!SND.isMuted()); syncMuteBtn(); announce(SND.isMuted() ? 'Sonido silenciado' : 'Sonido activado'); }
  function syncMuteBtn() { const b = $('p-mute'); if (b) b.textContent = SND.isMuted() ? 'Activar sonido (M)' : 'Silenciar (M)'; }
  const fsRoot = document.documentElement;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsCan = () => { try { return !!((document.fullscreenEnabled || document.webkitFullscreenEnabled) && (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen)); } catch (e) { return false; } };
  function toggleFs() {
    if (!fsCan()) return;
    try {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const r = (fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen).call(fsRoot); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* sin pantalla completa */ }
  }
  function syncFsBtn() {
    const can = fsCan();
    $('b-fs').hidden = !can; $('p-fs').hidden = !can;
    $('b-fs').textContent = fsEl() ? 'Salir de pantalla completa' : 'Pantalla completa';
    $('p-fs').textContent = fsEl() ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)';
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, syncFsBtn));
  $('b-fs').addEventListener('click', toggleFs); $('p-fs').addEventListener('click', toggleFs); $('p-mute').addEventListener('click', toggleMute);
  syncFsBtn(); syncMuteBtn();

  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowUp: 'cw', KeyW: 'cw', KeyX: 'cw', KeyZ: 'ccw', ControlLeft: 'ccw', Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold' };
  window.addEventListener('keydown', e => {
    SND.init();
    if (e.metaKey || e.altKey) return;
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (e.code === 'KeyF' && !e.ctrlKey) { toggleFs(); e.preventDefault(); return; }
    if ($('settings').classList.contains('on') || $('how').classList.contains('on')) { if (e.code === 'Escape') { closeAux(); e.preventDefault(); } return; }
    if (appState === 'play' || appState === 'ready') {
      if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); e.preventDefault(); return; }
      const a = KEYS[e.code]; if (a) { e.preventDefault(); if (!e.repeat && appState === 'play') press(a); }
    } else if (appState === 'pause') {
      if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); e.preventDefault(); }
      else if (e.code === 'KeyR' && !e.repeat) startGame(mode);
    } else if (appState === 'over') {
      if (e.code === 'KeyR' && !e.repeat) startGame(mode);
    }
  });
  window.addEventListener('keyup', e => { const a = KEYS[e.code]; if (a) release(a); });
  window.addEventListener('blur', () => { held.left = held.right = held.down = false; das.dir = 0; if (appState === 'play' || appState === 'ready') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (appState === 'play' || appState === 'ready')) togglePause(); });
  window.addEventListener('pointerdown', () => SND.init(), { passive: true });

  /* táctil: botones */
  touchBar.querySelectorAll('button').forEach(b => {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', e => { e.preventDefault(); SND.init(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ } press(act); });
    const up = e => { release(act); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  /* táctil: gestos sobre el tablero */
  let gp = null;
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || appState !== 'play') return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }
    gp = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), ax: 0, lx: e.clientX, moved: false, soft: false };
  });
  cv.addEventListener('pointermove', e => {
    if (!gp || e.pointerId !== gp.id || !L) return;
    const step = L.s * 1.45; gp.ax += e.clientX - gp.lx; gp.lx = e.clientX;
    if (Math.abs(e.clientX - gp.x0) > 12 || Math.abs(e.clientY - gp.y0) > 12) gp.moved = true;
    while (gp.ax >= step) { gp.ax -= step; if (canPlay()) doMove(1); }
    while (gp.ax <= -step) { gp.ax += step; if (canPlay()) doMove(-1); }
    const dy = e.clientY - gp.y0, wantSoft = dy > L.s * 2.4 && Math.abs(dy) > Math.abs(e.clientX - gp.x0);
    if (wantSoft !== gp.soft) { gp.soft = wantSoft; held.down = wantSoft; }
  });
  const gEnd = e => {
    if (!gp || e.pointerId !== gp.id) return;
    const dt = performance.now() - gp.t0, dx = e.clientX - gp.x0, dy = e.clientY - gp.y0, vy = dy / Math.max(1, dt);
    if (gp.soft) held.down = false;
    if (canPlay() && e.type === 'pointerup') {
      if (!gp.moved && dt < 300) { const r = cv.getBoundingClientRect(); press(e.clientX - r.left < L.ox + L.bw / 2 ? 'ccw' : 'cw'); }
      else if (dy > L.s * 3 && vy > 0.9 && Math.abs(dy) > Math.abs(dx)) press('drop');
      else if (dy < -L.s * 3 && vy < -0.9 && Math.abs(dy) > Math.abs(dx)) press('hold');
    }
    gp = null;
  };
  cv.addEventListener('pointerup', gEnd); cv.addEventListener('pointercancel', gEnd);

  /* mando */
  const gpPrev = {};
  function padAct(name, on, pressFn, releaseFn) { if (on && !gpPrev[name]) pressFn(); else if (!on && gpPrev[name]) releaseFn && releaseFn(); gpPrev[name] = on; }
  let menuIdx = 0;
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null; for (const x of pads) if (x && x.connected) { p = x; break; }
    if (!p) return;
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
    const left = b(14) || ax[0] < -0.5, right = b(15) || ax[0] > 0.5, down = b(13) || ax[1] > 0.6;
    if (appState === 'play') {
      padAct('left', left, () => press('left'), () => release('left'));
      padAct('right', right, () => press('right'), () => release('right'));
      padAct('down', down, () => press('down'), () => release('down'));
      padAct('cw', b(0) || b(5), () => press('cw')); padAct('ccw', b(1) || b(4), () => press('ccw'));
      padAct('hold', b(2) || b(6), () => press('hold')); padAct('drop', b(3) || b(7) || b(12), () => press('drop'));
      padAct('start', b(9), () => togglePause());
    } else {
      padAct('start', b(9), () => { if (appState === 'pause') togglePause(); });
      const btns = [...document.querySelectorAll('.overlay.on button')];
      padAct('mu', up(p), () => { if (btns.length) { menuIdx = (menuIdx - 1 + btns.length) % btns.length; btns[menuIdx].focus(); } });
      padAct('md', down, () => { if (btns.length) { menuIdx = (menuIdx + 1) % btns.length; btns[menuIdx].focus(); } });
      padAct('ma', b(0), () => { const f = document.activeElement; if (f && f.tagName === 'BUTTON') f.click(); else if (btns[0]) btns[0].click(); });
    }
  }
  const up = p => (p.buttons[12] && p.buttons[12].pressed) || (p.axes[1] < -0.6);

  /* ---------- ajustes (interfaz) ---------- */
  function closeAux() { show(settingsFrom === 'pause' ? 'pause' : 'menu'); }
  function openSettings(from) { settingsFrom = from; show('settings'); }
  function syncSettingsUI() {
    $('s-das').value = S.das; $('s-arr').value = S.arr; $('s-soft').value = S.soft; $('s-touch').value = S.touch; $('s-ghost').checked = !!S.ghost; $('s-level').value = S.level;
    $('s-mus').value = S.mus; $('s-sfx').value = S.sfx; $('s-cb').checked = !!S.cb; $('s-rm').checked = !!S.rm;
    $('v-das').textContent = S.das + ' ms'; $('v-arr').textContent = S.arr === 0 ? 'instantánea' : S.arr + ' ms'; $('v-soft').textContent = '×' + S.soft; $('v-mus').textContent = S.mus + '%'; $('v-sfx').textContent = S.sfx + '%';
  }
  (function bindSettings() {
    const lv = $('s-level'); for (let i = 1; i <= 10; i++) { const o = document.createElement('option'); o.value = i; o.textContent = 'Nivel ' + i; lv.appendChild(o); }
    const num = (id, key) => $(id).addEventListener('input', e => { S[key] = +e.target.value; saveS(); syncSettingsUI(); applySettings(); });
    num('s-das', 'das'); num('s-arr', 'arr'); num('s-soft', 'soft'); num('s-mus', 'mus'); num('s-sfx', 'sfx');
    $('s-level').addEventListener('change', e => { S.level = +e.target.value; saveS(); });
    $('s-touch').addEventListener('change', e => { S.touch = e.target.value; saveS(); applySettings(); });
    const chk = (id, key) => $(id).addEventListener('change', e => { S[key] = e.target.checked; saveS(); applySettings(); if (key === 'cb' || key === 'rm') redrawHow(); });
    chk('s-ghost', 'ghost'); chk('s-cb', 'cb'); chk('s-rm', 'rm');
    $('s-sfx').addEventListener('change', () => SND.sfx('ui'));
    $('b-reset').addEventListener('click', () => { S = Object.assign({}, DEF); saveS(); syncSettingsUI(); applySettings(); });
  })();
  const redrawHow = () => { R.drawHowLines($('how-lines')); R.drawHowPieces($('how-pieces')); };

  /* ---------- botones de menú ---------- */
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.mode)));
  $('b-how').addEventListener('click', () => { settingsFrom = 'menu'; show('how'); redrawHow(); });
  $('b-set').addEventListener('click', () => { syncSettingsUI(); openSettings('menu'); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeAux));
  $('p-resume').addEventListener('click', () => togglePause());
  $('p-restart').addEventListener('click', () => startGame(mode));
  $('p-set').addEventListener('click', () => { syncSettingsUI(); openSettings('pause'); });
  $('p-menu').addEventListener('click', toMenu);
  $('o-again').addEventListener('click', () => startGame(mode));
  $('o-menu').addEventListener('click', toMenu);
  $('o-share').addEventListener('click', () => {
    if (!lastRes) return;
    const t = 'Panal Roto · ' + lastRes.date + ' · ' + R.fmt(lastRes.score) + ' pts · ' + lastRes.lines + ' líneas · cadena ×' + Math.max(1, lastRes.chain) + ' · ' + R.fmtTe(lastRes.time);
    const done = () => { $('o-share').textContent = 'Copiado'; setTimeout(() => { $('o-share').textContent = 'Copiar resultado'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => { prompt('Copia tu resultado:', t); });
    else prompt('Copia tu resultado:', t);
  });

  /* ---------- demostración de fondo en el menú ---------- */
  let D = null, plan = [], planT = 0;
  function heights(grid) { const h = []; for (let c = 0; c < PR.W; c++) { let r = 0; while (r < PR.H && !grid[r * PR.W + c]) r++; h.push(PR.H - r); } return h; }
  function evalB(c, gained, steps) {
    if (c.phase === 'over') return -1e6;
    const h = heights(c.grid); let agg = 0, bump = 0, mx = 0; for (let i = 0; i < h.length; i++) { agg += h[i]; mx = Math.max(mx, h[i]); if (i) bump += Math.abs(h[i] - h[i - 1]); }
    return gained * 3 + (steps > 1 ? steps * 1.5 : 0) - agg * 0.3 - PR.holes(c.grid) * 1 - bump * 0.18 - (mx > 11 ? (mx - 11) * 2.5 : 0);
  }
  function bestPlan(g) {
    let best = null;
    const tryPos = (b, rots, dir, k) => { const c = PR.clone(b); c.rec = false; c.keep = false; const l0 = c.lines; PR.hardDrop(c); const sc = evalB(c, c.lines - l0, c.anim ? c.anim.steps.length : 0) + Math.random() * 0.6; if (!best || sc > best.sc) best = { sc, rots, dir, k }; };
    for (let rots = 0; rots < 6; rots++) {
      const a = PR.clone(g); a.rec = false; a.keep = false; let ok = true; for (let i = 0; i < rots; i++) if (!PR.rotate(a, 1)) { ok = false; break; } if (!ok) continue;
      tryPos(a, rots, 0, 0);
      for (const dir of [-1, 1]) { const b = PR.clone(a); for (let k = 1; k <= 9; k++) { if (!PR.move(b, dir)) break; tryPos(b, rots, dir, k); } }
    }
    return best;
  }
  function startAttract() { D = PR.create({ mode: 'libre', seed: ((Math.random() * 4294967296) >>> 0) || 7, rec: false, collapse: 'cuerpo' }); plan = []; planT = 0; R.clearFx(); }
  const attractHooks = { shatter(st) { R.addShake(0.2); } };
  function stepAttract(dt) {
    if (!D) startAttract();
    PR.tick(D, dt);
    if (D.phase === 'over') { setTimeout(startAttract, 900); D.phase = 'wait'; return; }
    if (D.phase !== 'play' || !D.cur) return;
    if (!plan.length) { const m = bestPlan(D); if (!m) return; for (let i = 0; i < m.rots; i++) plan.push('cw'); for (let k = 0; k < m.k; k++) plan.push(m.dir > 0 ? 'r' : 'l'); plan.push('drop'); planT = 0; }
    planT += dt; if (planT < 120) return; planT = 0;
    const a = plan.shift(); if (a === 'cw') PR.rotate(D, 1); else if (a === 'r') PR.move(D, 1); else if (a === 'l') PR.move(D, -1); else if (a === 'drop') PR.hardDrop(D);
  }

  /* ---------- bucle ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(50, last ? now - last : 16); last = now;
    if (!L) return;
    pollPad();
    let g = G, hooks = view.hooks;
    if (appState === 'ready') { countdown -= dt; if (countdown <= 0) { appState = 'play'; countdown = 0; } }
    if (appState === 'play' && G) {
      repeatMove(dt); PR.setSoft(G, held.down); PR.tick(G, dt); consume();
      if (G.phase === 'over' || G.phase === 'won') endGame();
    } else if (!G) { stepAttract(dt); g = D; hooks = attractHooks; }
    view.hooks = G ? gameHooks : attractHooks; view.nextN = L.hud.land ? 5 : 3;
    R.draw(ctx, L, g, now, dt, view);
    if (appState === 'ready' && G) {
      const n = Math.ceil(countdown / 900), txt = countdown > 0 ? (n > 0 ? String(Math.min(3, n)) : '¡Ya!') : '';
      ctx.save(); ctx.setTransform(R.cfg.dpr, 0, 0, R.cfg.dpr, 0, 0); ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = L.s * 0.5; ctx.strokeStyle = 'rgba(12,5,24,.9)';
      const ph = (countdown % 900) / 900; ctx.font = '900 ' + L.s * (3.2 + ph * 0.8) + 'px ' + "'Trebuchet MS',system-ui,sans-serif"; ctx.globalAlpha = 0.35 + 0.65 * ph;
      ctx.strokeText(txt, L.ox + L.bw / 2, L.oy + L.bh * 0.45); ctx.fillStyle = '#ffd166'; ctx.fillText(txt, L.ox + L.bw / 2, L.oy + L.bh * 0.45); ctx.restore();
    }
  }

  /* ---------- arranque ---------- */
  syncSettingsUI(); applySettings(); refreshMenu(); startAttract();
  requestAnimationFrame(frame);
  window.__panal = { get G() { return G; }, get D() { return D; }, get state() { return appState; }, PR, R, start: startGame, press, release, get L() { return L; }, get S() { return S; }, set S(v) { S = v; }, apply: applySettings, toMenu, pause: togglePause, bestPlan };
})();
