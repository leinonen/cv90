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

// ---------------- procedural score: dark chiptune ----------------
// 16th-note step sequencer. Layers gate in with `music.target` (0..1):
//   always: bass + kick      >0.3: snare/hats     >0.55: arp lead      >0.8: octave lead + double-time hats
const N = f => 440 * Math.pow(2, (f - 69) / 12); // midi → Hz
const CHORDS = [ // [root midi, third offset] — Dm, Bb, F, A (major third: never resolves)
  [38, 3], [34, 4], [41, 4], [33, 4],
];
// bass patterns (semitone offsets from root, null = rest), 16 steps
const BASS = [
  [0, null, 0, 0, null, 0, null, 12, 0, null, 0, 0, null, 10, null, 12],
  [0, 0, null, 0, 7, null, 0, null, 0, 0, null, 0, 12, null, 10, 7],
];
const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1];
const ARP = [0, 7, 12, 7, 15, 12, 19, 12, 0, 7, 12, 7, 15, 12, 24, 19]; // third slot replaced by chord third
function startMusic() {
  const bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(master);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2; lp.connect(bus);
  // pad: 3 detuned pulse voices through the shared lowpass
  const pad = [];
  for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = i === 1 ? 'sawtooth' : 'square'; g.gain.value = 0; o.connect(g); g.connect(lp); o.start(); pad.push({ o, g }); }
  music = { target: 0.15, level: 0.15, next: ctx.currentTime + 0.3, step: 0, bus, lp, pad };
  setInterval(tick, 60);
}
function voice(t, freq, type, dur, vol, dest, slideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function drum(t, kind, vol) {
  if (kind === 'kick') { voice(t, 120, 'sine', 0.22, vol, music.bus, 35); return; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; f.Q.value = 1;
  const dur = kind === 'hat' ? 0.04 : 0.12;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(music.bus); s.start(t); s.stop(t + dur + 0.02);
  if (kind === 'snare') voice(t, 220, 'triangle', 0.08, vol * 0.5, music.bus, 120);
}
function tick() {
  const m = music, now = ctx.currentTime;
  m.level += (m.target - m.level) * 0.03;
  const L = m.level;
  m.lp.frequency.setTargetAtTime(500 + L * 2200, now, 0.4);
  while (m.next < now + 0.2) {
    const t = m.next, bpm = 96 + L * 54, sixteenth = 60 / bpm / 4;
    const st = m.step, bar = Math.floor(st / 16), s16 = st % 16;
    const [root, third] = CHORDS[bar % 4];
    if (s16 === 0) { // pad chord change on the bar
      const fr = [N(root + 12), N(root + 12 + third), N(root + 19)];
      m.pad.forEach((v, i) => { v.o.frequency.setTargetAtTime(fr[i] * (i === 1 ? 1.003 : 1), t, 0.05); v.g.gain.setTargetAtTime(0.05 + L * 0.03, t, 0.3); });
    }
    // bass: pulse + sub
    const b = BASS[Math.floor(bar / 2) % 2][s16];
    if (b !== null) { const f = N(root + b); voice(t, f, 'square', sixteenth * 0.9, 0.16, m.lp); voice(t, f / 2, 'triangle', sixteenth * 0.95, 0.22, m.bus); }
    // drums
    if (KICK[s16]) drum(t, 'kick', 0.7);
    if (L > 0.3) {
      if (SNARE[s16]) drum(t, 'snare', 0.25 + L * 0.2);
      if (s16 % 2 === 0 || L > 0.8) drum(t, 'hat', s16 % 4 === 2 ? 0.12 : 0.06);
    }
    // arp lead
    if (L > 0.55) {
      const a = ARP[s16] === 15 ? third + 12 : ARP[s16];
      const f = N(root + 24 + a), v = 0.06 + (L - 0.55) * 0.12;
      voice(t, f, 'square', sixteenth * 0.6, v, m.lp);
      if (L > 0.8) voice(t, f * 2.005, 'square', sixteenth * 0.5, v * 0.5, m.lp);
    }
    // bar-end fill at high threat
    if (L > 0.7 && s16 >= 12 && bar % 4 === 3) drum(t, 'snare', 0.2 + (s16 - 12) * 0.08);
    m.next += sixteenth; m.step++;
  }
}
