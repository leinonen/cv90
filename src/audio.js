// WebAudio synth SFX. No samples.
let ctx = null, master = null, noiseBuf = null, mgN = 0, engine = null, engineG = null;

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
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
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
  },
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
