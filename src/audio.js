/* ============================================================
   PANAL ROTO · sonido y música sintetizados con Web Audio
   ============================================================ */
const SND = (() => {
  let ctx = null, master, sfxG, musG, comp, noiseBuf;
  const vol = { sfx: 0.7, mus: 0.5 }, mus = { on: false, step: 0, next: 0, timer: null, level: 1, bpm: 96 };
  let muted = false, lastMove = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.85;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxG = ctx.createGain(); musG = ctx.createGain(); sfxG.connect(master); musG.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
  }
  function applyVol() { if (!ctx) return; const m = muted ? 0 : 1; sfxG.gain.value = vol.sfx * vol.sfx * m; musG.gain.value = vol.mus * vol.mus * 0.55 * m; }
  function setVol(k, v) { vol[k] = Math.max(0, Math.min(1, v)); applyVol(); }
  function setMuted(m) { muted = !!m; applyVol(); }
  const isMuted = () => muted;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function tone(f, dur, type = 'sine', v = 0.2, when = 0, slideTo = 0, dest = null, attack = 0.004) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, v = 0.2, type = 'highpass', f0 = 2000, f1 = 0, when = 0, dest = null, q = 0.7) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t0); if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxG); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const PENTA = [0, 2, 4, 7, 9];
  const scaleNote = (base, i) => base + PENTA[i % 5] + 12 * Math.floor(i / 5);

  function sfx(name, a = {}) {
    if (!ctx || muted) return;
    switch (name) {
      case 'move': { const n = performance.now(); if (n - lastMove < 28) return; lastMove = n; tone(380, 0.04, 'triangle', 0.12); break; }
      case 'rotate': tone(a.kick ? 520 : 440, 0.08, 'square', 0.1, 0, a.kick ? 760 : 620); break;
      case 'blocked': tone(150, 0.05, 'square', 0.08); break;
      case 'hold': tone(330, 0.09, 'triangle', 0.18, 0, 220); tone(495, 0.09, 'triangle', 0.16, 0.06, 330); break;
      case 'land': tone(130, 0.11, 'sine', 0.3, 0, 60); noise(0.05, 0.08, 'lowpass', 1800, 300); break;
      case 'harddrop': noise(0.16, 0.14, 'bandpass', 3000, 300, 0, null, 1.2); tone(110, 0.16, 'sine', 0.4, 0.02, 45); break;
      case 'clear': {   // a.lines, a.chain, a.kinds
        const n = Math.min(6, a.lines || 1), base = 60 + Math.min(10, (a.chain - 1) * 3);
        noise(0.14, 0.2, 'highpass', 2500, 8000, 0, null, 0.8);
        for (let i = 0; i < n + 2; i++) { const nn = midi(scaleNote(base, i + (a.chain > 1 ? 2 : 0))); tone(nn, 0.5, 'sine', 0.16, i * 0.055); tone(nn * 2, 0.3, 'triangle', 0.05, i * 0.055); }
        if (a.cross) { tone(midi(base + 19), 0.6, 'sawtooth', 0.05, 0.1); tone(midi(base + 24), 0.6, 'sine', 0.1, 0.12); }
        tone(70, 0.3, 'sine', 0.35, 0, 38); break;
      }
      case 'fall': tone(180, 0.18, 'triangle', 0.2, 0, 90); noise(0.12, 0.1, 'lowpass', 900, 200); break;
      case 'levelup': [0, 4, 7, 12].forEach((s, i) => tone(midi(64 + s), 0.38, 'triangle', 0.16, i * 0.09)); break;
      case 'perfect': for (let i = 0; i < 9; i++) tone(midi(scaleNote(72, i)), 0.5, 'sine', 0.13, i * 0.06); break;
      case 'over': tone(220, 1.1, 'sawtooth', 0.14, 0, 55); tone(233, 1.1, 'sawtooth', 0.1, 0, 58); noise(0.6, 0.12, 'lowpass', 1200, 80); break;
      case 'won': [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(midi(60 + s), 0.6, 'triangle', 0.15, i * 0.1)); break;
      case 'tick': tone(900, 0.04, 'square', 0.05); break;
      case 'ui': tone(520, 0.07, 'triangle', 0.2); break;
    }
  }

  /* ---- música: bucle de 4 compases que va sumando capas con el nivel ---- */
  const PROG = [
    { root: 38, ch: [50, 53, 57, 62] },  // Re menor
    { root: 34, ch: [46, 50, 53, 58] },  // Si bemol
    { root: 31, ch: [43, 46, 50, 55] },  // Sol menor
    { root: 33, ch: [45, 49, 52, 57] },  // La (dominante)
  ];
  const ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 3, 1, 2, 3, 2, 1, 2];
  function playStep(step, when) {
    const bar = (step >> 4) & 3, s = step & 15, ch = PROG[bar], lv = mus.level, t = when - ctx.currentTime;
    const sec = 60 / mus.bpm / 4;
    if (s === 0) { for (const n of ch.ch.slice(0, 3)) tone(midi(n), sec * 15, 'sine', 0.1, t, 0, musG, 0.25); }
    if (s === 0 || s === 6 || s === 8 || s === 14) tone(midi(ch.root + (s === 6 || s === 14 ? 12 : 0)), sec * 1.8, 'triangle', 0.3, t, 0, musG);
    if (lv >= 1 && (s % 2 === 0 || lv >= 4)) { const n = ch.ch[ARP[s]] + (lv >= 7 && bar === 3 ? 12 : 12); tone(midi(n), sec * 1.6, lv >= 5 ? 'square' : 'triangle', lv >= 5 ? 0.05 : 0.09, t, 0, musG); }
    if (lv >= 2 && (s === 0 || s === 8)) { tone(95, 0.16, 'sine', 0.55, t, 40, musG); }
    if (lv >= 3 && (s === 4 || s === 12)) noise(0.1, 0.1, 'bandpass', 1800, 900, t, musG, 0.8);
    if (lv >= 3 && s % 2 === 1) noise(0.03, 0.05, 'highpass', 7000, 0, t, musG);
    if (lv >= 6 && (s === 4 || s === 12)) tone(midi(ch.ch[3] + 12), sec * 3, 'sawtooth', 0.04, t, 0, musG);
    if (lv >= 9 && s % 4 === 2) tone(midi(ch.ch[(s >> 2) % 4] + 24), sec * 0.9, 'sine', 0.06, t, 0, musG);
  }
  function pump() {
    if (!ctx || !mus.on) return;
    const sec = 60 / mus.bpm / 4;
    while (mus.next < ctx.currentTime + 0.3) { playStep(mus.step, mus.next); mus.next += sec; mus.step = (mus.step + 1) & 63; }
  }
  function musicStart(level = 1) {
    if (!ctx) return; musicSetLevel(level);
    if (mus.on) return; mus.on = true; mus.step = 0; mus.next = ctx.currentTime + 0.12;
    mus.timer = setInterval(pump, 80); pump();
  }
  function musicStop() { mus.on = false; if (mus.timer) { clearInterval(mus.timer); mus.timer = null; } }
  function musicSetLevel(level) { mus.level = Math.max(1, level); mus.bpm = Math.min(150, 92 + 3 * (level - 1)); }
  return { init, sfx, setVol, setMuted, isMuted, musicStart, musicStop, musicSetLevel, vol, get ready() { return !!ctx; } };
})();
