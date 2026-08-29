// Mission system. Each sector is a chain of objectives; the HUD shows the current one
// with a compass arrow. Enemies trickle in from the direction of travel and in bursts
// around each objective, instead of a blind timeline.
import { G, W, H, after, addScore, rate, dif } from './state.js';
import { spawnEnemy, spawnBoss } from './enemies.js';
import { spawnParticle, explosion, crashFire, spawnPickup } from './entities.js';
import { audio } from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const P = () => G.player || { x: 0, y: 0, rot: 0 };
// Spawn at world-polar offset from the player.
const atAng = (type, a, dist = 360, o) => { const p = P(); return spawnEnemy(type, p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, o); };
// Spawn around a world point.
const near = (type, x, y, r = 60) => { const a = rnd(0, 6.28), d = rnd(r * 0.3, r); return spawnEnemy(type, x + Math.cos(a) * d, y + Math.sin(a) * d); };
const group = (type, n, a, dist, spread = 0.5, gap = 8) => { for (let i = 0; i < n; i++) after(i * gap + 1, () => atAng(type, a + rnd(-spread, spread), dist + rnd(-20, 30))); };

// Direction from the player to the current objective (or hull heading if none).
function objAngle() {
  const p = P(), m = G.mission;
  return m && m.x !== undefined ? Math.atan2(m.y - p.y, m.x - p.x) : p.rot;
}
const objDist = () => { const p = P(), m = G.mission; return m && m.x !== undefined ? Math.hypot(m.x - p.x, m.y - p.y) : 0; };

// ---- ambient pressure: small groups from the direction of travel, scaled by sector ----
let ambientT = 0;
function ambient() {
  const d = dif(), a = objAngle();
  const roll = Math.random();
  if (roll < 0.5) group('inf', 3 + d, a, 380, 0.6, 10);
  else if (roll < 0.8) { group('bmp', 1 + (d > 1 ? 1 : 0), a + rnd(-0.6, 0.6), 400, 0.2); if (d > 0) group('inf', 2, a, 380, 0.5); }
  else if (roll < 0.92) group('t72', 1, a + rnd(-0.5, 0.5), 420, 0);
  else group('hind', 1, rnd(0, 6.28), 420, 0);
}

// ---- objectives ----
function pickPoint(dist) {
  const p = P(), a = p.rot + rnd(-0.9, 0.9);
  return { x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist };
}
const OBJ = {
  move: {
    start(m) { Object.assign(m, pickPoint(rnd(700, 900))); m.text = 'REACH THE FIRE-BASE'; m.marker = 'flag'; },
    update(m) { if (objDist() < 70) { cache(m.x, m.y, 2, 1, 1); done(m); } }, // fire-base has supplies
  },
  destroy: {
    start(m) {
      Object.assign(m, pickPoint(rnd(750, 950))); m.text = 'DESTROY THE SUPPLY DEPOT'; m.marker = 'target';
      m.depot = spawnEnemy('depot', m.x, m.y, { rot: rnd(0, 6.28) });
      const d = dif();
      for (let i = 0; i < 4 + d * 2; i++) near('inf', m.x, m.y, 90);
      for (let i = 0; i < 1 + Math.min(2, d); i++) near('bmp', m.x, m.y, 110);
      if (d > 0) near('t72', m.x, m.y, 120);
    },
    update(m) { if (m.depot.hp <= 0 || !G.enemies.includes(m.depot)) done(m); },
  },
  hold: {
    start(m) { Object.assign(m, pickPoint(rnd(600, 800))); m.text = 'HOLD THE CROSSROADS'; m.marker = 'zone'; m.hold = 0; m.need = 45 * 60; m.waveT = 0; },
    update(m) {
      const inZone = objDist() < 110;
      if (inZone) {
        m.hold++;
        if (m.waveT-- <= 0) {
          m.waveT = Math.round(rnd(420, 600) * rate());
          const d = dif(), a = rnd(0, 6.28);
          group('inf', 3 + d, a, 380, 0.4, 10); group('bmp', 1, a + Math.PI * rnd(0.6, 1.4), 400, 0.2);
          if (m.hold > m.need * 0.4) group(d > 0 ? 't72' : 'bmp', 1, a + rnd(1, 2), 420, 0);
          if (m.hold > m.need * 0.6 && Math.random() < 0.5) group('hind', 1, rnd(0, 6.28), 420, 0);
        }
        m.text = 'HOLD THE CROSSROADS  ' + Math.ceil((m.need - m.hold) / 60) + 's';
        if (m.hold >= m.need) done(m);
      } else m.text = 'HOLD THE CROSSROADS  (ENTER ZONE)';
    },
  },
  boss: {
    start(m) {
      m.text = 'DESTROY THE T-90'; m.marker = 'target';
      const p = P(), a = p.rot + rnd(-0.6, 0.6);
      spawnBoss(p.x + Math.cos(a) * 400, p.y + Math.sin(a) * 400);
      cache(p.x - Math.cos(a) * 50, p.y - Math.sin(a) * 50, 1, 1, 2); // AP resupply for the T-90
      G.sub = 'WARNING\nHEAVY ARMOUR'; audio.alert();
      after(150, () => { if (G.sub.startsWith('WARNING')) G.sub = ''; });
    },
    update(m) { const b = G.boss; if (b) { m.x = b.x; m.y = b.y; } else if (m.t > 30 && !G.boss) { /* onBossDead handles it */ } },
  },
};
const SEQ = ['move', 'destroy', 'hold', 'boss'];

// Drop supplies around a point: n repair crates, s smoke crates.
function cache(x, y, n, s, am = 0) {
  const k = n + s + am;
  for (let i = 0; i < k; i++) { const a = i / k * 6.28 + 0.5; spawnPickup(x + Math.cos(a) * 34, y + Math.sin(a) * 34, i < n ? 'repair' : i < n + s ? 'smokep' : 'ammop'); }
}
function done(m) {
  m.done = true;
  if (m.kind !== 'move') { const p = P(); cache(p.x + Math.cos(p.rot) * 50, p.y + Math.sin(p.rot) * 50, 1, 0); }
  addScore(2500 * G.stage);
  audio.pickup();
  G.msg = 'OBJECTIVE COMPLETE';
  after(90, () => { if (G.msg === 'OBJECTIVE COMPLETE') G.msg = ''; });
  after(120, nextObjective);
}
export function nextObjective() {
  if (G.state !== 'play') return;
  const idx = G.mission ? G.mission.idx + 1 : 0;
  const kind = SEQ[idx];
  const m = { idx, kind, t: 0, done: false, x: undefined, y: undefined, text: '', marker: null };
  G.mission = m;
  if (location.search.includes('debug')) console.log(`objective ${idx} ${kind} time ${G.time} score ${G.score} lives ${P().lives}`);
  OBJ[kind].start(m);
  G.sub = 'NEW OBJECTIVE:\n' + m.text; after(150, () => { if (G.sub.startsWith('NEW OBJECTIVE')) G.sub = ''; });
}

export function resetLevel() {
  G.clearT = 0; G.boss = null; G.mission = null; G.obj = ''; ambientT = 240;
  G.onBossDead = stageCleared;
  after(60, nextObjective);
}
function stageCleared() {
  if (location.search.includes('debug')) console.log(`sector ${G.stage} secured time ${G.time}`);
  addScore(30000 * G.stage);
  G.clearT = 240; G.mission = null; G.obj = '';
  const p = G.player; if (p) { p.hp = p.maxhp; p.smoke = Math.max(p.smoke, 4); cache(p.x, p.y, 2, 1, 1); }
  G.msg = 'SECTOR SECURED';
  G.sub = 'BONUS ' + (30000 * G.stage) + '\nREPAIRED AND RESUPPLIED';
  audio.clear();
}
export function updateLevel() {
  if (G.clearT > 0) {
    G.clearT--;
    if (G.clearT === 0) { G.stage++; resetLevel(); G.msg = 'SECTOR ' + G.stage; G.sub = ''; after(120, () => { if (G.msg === 'SECTOR ' + G.stage) G.msg = ''; }); }
    return;
  }
  G.levelT += 1 / 60;
  const m = G.mission;
  if (m && !m.done) {
    m.t++;
    OBJ[m.kind].update(m);
    // compass text
    const d = objDist();
    G.obj = m.text + (m.x !== undefined ? '  ' + Math.round(d / 10) * 10 + 'm' : '');
  }
  // ambient pressure only while travelling / fighting the depot; the hold + boss stages bring their own
  if (m && !m.done && (m.kind === 'move' || m.kind === 'destroy')) {
    if (--ambientT <= 0) { ambientT = Math.round(rnd(600, 900) * rate()); ambient(); }
  }
}
// Objective marker + edge compass arrow. Called from render inside the additive pass.
export function drawObjective(R, cx, cy, t) {
  const m = G.mission; if (!m || m.done || m.x === undefined) return;
  const F = R.f, p = P();
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  if (m.marker === 'zone') { R.sprite(F.ring, m.x, m.y, 0, 9, 0.4, 1, 0.5, 0.35 + 0.2 * pulse); R.sprite(F.ring, m.x, m.y, t, 4 + pulse * 0.5, 0.4, 1, 0.5, 0.5); }
  else if (m.marker === 'flag') { R.sprite(F.ring, m.x, m.y, 0, 2.5 + pulse, 0.4, 1, 0.5, 0.7 - pulse * 0.4); R.sprite(F.spark, m.x, m.y, 0, 2, 0.5, 1, 0.5, 1); }
  else { R.sprite(F.ring, m.x, m.y, t * 2, 1.6 + pulse * 0.5, 1, 0.35, 0.3, 0.6); }
  // arrow at screen edge when the objective is off-screen
  const sx = m.x - cx, sy = m.y - cy;
  if (sx < 0 || sx > W || sy < 0 || sy > H) {
    const a = Math.atan2(m.y - p.y, m.x - p.x);
    const px = p.x - cx, py = p.y - cy;
    // march along the ray until we hit the edge inset
    let k = 1e9;
    const dx = Math.cos(a), dy = Math.sin(a), ins = 22;
    if (dx > 0) k = Math.min(k, (W - ins - px) / dx); if (dx < 0) k = Math.min(k, (ins - px) / dx);
    if (dy > 0) k = Math.min(k, (H - ins - py) / dy); if (dy < 0) k = Math.min(k, (ins - py) / dy);
    const ax = px + dx * k + cx, ay = py + dy * k + cy;
    const col = m.marker === 'target' ? [1, 0.4, 0.3] : [0.5, 1, 0.5];
    R.sprite(F.arrow, ax, ay, a + Math.PI / 2, 1.2 + pulse * 0.3, col[0], col[1], col[2], 0.9);
  }
}
