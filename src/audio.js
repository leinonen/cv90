// WebAudio synth SFX. No samples.
let ctx = null, master = null, noiseBuf = null, mgN = 0, engine = null, engineG = null;
let music = null; // see startMusic()

function tone(freq, type, dur, vol, slideTo) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, cutoff, cutoffTo) {
  if (!ctx) return;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = noiseBuf; s.loop = true;
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t);
  if (cutoffTo) f.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}

export const audio = {
  init() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.frequency.value = 40;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    engineG = ctx.createGain(); engineG.gain.value = 0;
    engine.connect(f); f.connect(engineG); engineG.connect(master); engine.start();
    startMusic();
    if (ctx.state !== 'running') ctx.resume();
  },
  // 0..1 threat level; the score follows it.
  music(intensity) { if (music) music.target = Math.max(0, Math.min(1, intensity)); },
  // speed 0..1 (abs), on = engine running at all
  engine(speed, on) {
    if (!ctx) return;
    const t = ctx.currentTime;
    engine.frequency.setTargetAtTime(on ? 38 + speed * 40 : 30, t, 0.1);
    engineG.gain.setTargetAtTime(on ? 0.12 + speed * 0.1 : 0, t, 0.15);
  },
  cannon() { noise(0.5, 0.8, 1200, 60); tone(70, 'square', 0.3, 0.4, 25); tone(500, 'sine', 0.06, 0.2, 100); },
  mg() { if (++mgN % 2) { tone(700, 'square', 0.03, 0.06, 200); noise(0.04, 0.2, 3000, 800); } },
  eshot() { tone(300, 'triangle', 0.06, 0.03, 200); },
  eshell() { noise(0.3, 0.4, 900, 80); tone(90, 'square', 0.2, 0.2, 30); },
  rpg() { noise(0.25, 0.3, 2500, 300); tone(400, 'sawtooth', 0.2, 0.08, 120); },
  smoke() { noise(0.6, 0.5, 4000, 300); tone(220, 'triangle', 0.1, 0.1, 60); },
  hit() { tone(180, 'square', 0.03, 0.04, 120); },
  clank() { tone(900, 'triangle', 0.08, 0.15, 200); noise(0.08, 0.3, 2000, 500); },
  hurt() { noise(0.3, 0.5, 1500, 200); tone(140, 'square', 0.15, 0.3, 50); },
  explode(big) { noise(big ? 0.9 : 0.35, big ? 0.7 : 0.35, big ? 900 : 1800, 80); tone(big ? 90 : 170, 'triangle', big ? 0.5 : 0.25, 0.35, 30); },
  pickup() { [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 'square', 0.1, 0.08), i * 60)); },
  die() { noise(1.2, 0.8, 2500, 60); tone(420, 'sawtooth', 0.8, 0.35, 40); },
  bossHit() { tone(120, 'square', 0.05, 0.05, 80); },
  alert() { [880, 660, 880, 660].forEach((f, i) => setTimeout(() => tone(f, 'square', 0.18, 0.1), i * 200)); },
  start() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone(f, 'square', 0.15, 0.08), i * 90)); },
  clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 'square', 0.25, 0.1), i * 120)); },
};

// ---------------- procedural score ----------------
// Drone + slow minor pads + a pulse. Tempo, layers and dissonance scale with `music.target`.
const ROOTS = [36.71, 29.14, 43.65, 27.50]; // D1, Bb0, F1, A0 — a slow Dm / Bb / F / A cycle
function startMusic() {
  const bus = ctx.createGain(); bus.gain.value = 1.0; bus.connect(master);
  // drone: two detuned saws through a slow-wobbling lowpass
  const dg = ctx.createGain(); dg.gain.value = 0.2;
  const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 160; df.Q.value = 4;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 60;
  lfo.connect(lg); lg.connect(df.frequency); lfo.start();
  for (const det of [0, 1.004]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 36.71 * det; o.connect(df); o.start(); }
  df.connect(dg); dg.connect(bus);
  // pad voices (3) with slow attack/release
  const pad = [];
  for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = i ? 'triangle' : 'sine'; g.gain.value = 0; o.connect(g); g.connect(bus); o.start(); pad.push({ o, g }); }
  // tension voice: high, slowly beating pair that fades in with intensity
  const tg = ctx.createGain(); tg.gain.value = 0;
  for (const f of [587.33, 590.5]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(tg); o.start(); }
  tg.connect(bus);
  music = { target: 0.15, level: 0.15, next: ctx.currentTime + 0.5, beat: 0, chord: 0, bus, dg, df, pad, tg };
  setInterval(tick, 80);
}
function kick(t, vol, f0 = 90, f1 = 32, dur = 0.35) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(music.bus); o.start(t); o.stop(t + dur + 0.02);
}
function tickNoise(t, vol, cutoff) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = cutoff; f.Q.value = 6;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  s.connect(f); f.connect(g); g.connect(music.bus); s.start(t); s.stop(t + 0.08);
}
function tick() {
  const m = music, now = ctx.currentTime;
  m.level += (m.target - m.level) * 0.04;
  const L = m.level;
  // continuous layers follow the level
  m.df.frequency.setTargetAtTime(140 + L * 260, now, 0.5);
  m.dg.gain.setTargetAtTime(0.18 + L * 0.12, now, 0.5);
  m.tg.gain.setTargetAtTime(Math.max(0, L - 0.45) * 0.12, now, 1.0);
  while (m.next < now + 0.25) {
    const t = m.next, interval = 1.25 - L * 0.78; // 48 → 128 bpm
    const b = m.beat;
    if (b % 8 === 0) { // chord change: pad slides to new root voicing (root, fifth, minor third an octave up)
      m.chord = (m.chord + 1) % ROOTS.length;
      const r = ROOTS[m.chord] * 2;
      const freqs = [r, r * 1.5, r * 2.4 * (m.chord === 3 ? 1.05 : 1)]; // A chord gets a major third: unresolved
      m.pad.forEach((v, i) => { v.o.frequency.setTargetAtTime(freqs[i], t, 0.8); v.g.gain.setTargetAtTime(0.09 - i * 0.02 + L * 0.04, t, 1.5); });
    }
    kick(t, 0.5 + L * 0.3);                                   // heartbeat on every beat
    if (L > 0.3 && b % 2 === 1) kick(t + interval * 0.5, 0.3 * L, 70, 40, 0.2); // syncopated second thump
    if (L > 0.45) tickNoise(t + interval * 0.5, 0.12 + L * 0.15, 3000); // off-beat tick
    if (L > 0.7 && b % 4 === 2) kick(t, 0.5, 160, 60, 0.3);   // tom accent
    if (L > 0.85 && b % 8 === 7) tickNoise(t + interval * 0.75, 0.35, 1200); // pre-bar snap
    m.next += interval; m.beat++;
  }
}
