import { G, W, H, addScore, after } from './state.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { collideTrees } from './terrain.js';

// ---------------- bullets (pooled) ----------------
const pool = [];
export function spawnBullet(arr, x, y, vx, vy, o = {}) {
  const b = pool.pop() || {};
  b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.ax = o.ax || 0; b.ay = o.ay || 0; b.t = 0;
  b.frame = o.frame || 'orb'; b.sx = o.sx || 1;
  b.r = o.r ?? 1; b.g = o.g ?? 0.35; b.b = o.b ?? 0.35;
  b.rad = o.rad || 3; b.dmg = o.dmg || 1; b.fn = o.fn || null; b.life = o.life || 600;
  b.type = o.type || 'mg'; b.air = o.air || false; b.heavy = o.heavy || false; // air: fired from above, ignores trees
  b.rot = Math.atan2(vy, vx) + Math.PI / 2;
  arr.push(b);
  return b;
}
export function removeBullet(arr, i) {
  pool.push(arr[i]);
  arr[i] = arr[arr.length - 1];
  arr.pop();
}
export function updateBullets(arr) {
  const c = G.cam;
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    b.t++;
    if (b.fn) b.fn(b);
    b.vx += b.ax; b.vy += b.ay; b.x += b.vx; b.y += b.vy;
    b.rot = Math.atan2(b.vy, b.vx) + Math.PI / 2;
    if (Math.abs(b.x - c.x) > W || Math.abs(b.y - c.y) > H || b.t > b.life) removeBullet(arr, i);
  }
}
export function clearBullets(arr, toSparks) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    if (toSparks) spawnParticle(b.x, b.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 25, 'spark', 1.5, b.r, b.g, b.b, true, { drag: 0.95 });
    removeBullet(arr, i);
  }
}

// ---------------- particles ----------------
export function spawnParticle(x, y, vx, vy, life, frame, sx, r, g, b, add, o = {}) {
  G.parts.push({ x, y, vx, vy, t: 0, life, frame, sx, r, g, b, add, drag: o.drag ?? 1, grow: o.grow || 0, grav: o.grav || 0, spin: o.spin || 0, rot: o.rot || 0, fade: o.fade ?? 1, ground: o.ground || false, sy: o.sy || 0 });
}
export function updateParticles() {
  const ps = G.parts;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.t++; p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.sx += p.grow; p.rot += p.spin;
    if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); }
  }
}
export function explosion(x, y, size = 1) {
  const n = Math.floor(10 * size) + 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 3) * size;
    spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 20 + Math.random() * 25, 'spark', 1 + size * 0.5, 1, 0.75 + Math.random() * 0.25, 0.3, true, { drag: 0.94 });
  }
  for (let i = 0; i < 4 * size; i++)
    spawnParticle(x + (Math.random() - 0.5) * 8 * size, y + (Math.random() - 0.5) * 8 * size, (Math.random() - 0.5) * 0.6, -0.2 - Math.random() * 0.5, 40 + Math.random() * 30, 'smoke', 0.8 + size * 0.6, 0.22, 0.22, 0.25, false, { grow: 0.04, drag: 0.98, fade: 0.8 });
  spawnParticle(x, y, 0, 0, 8, 'smoke', 2.5 * size, 1, 0.9, 0.6, true, { grow: 0.35 });
  spawnParticle(x, y, 0, 0, 18, 'ring', 0.4 * size, 1, 0.7, 0.3, true, { grow: 0.12 * size });
  spawnParticle(x, y, 0, 0, 900, 'crater', 0.6 * size, 0.12, 0.1, 0.06, false, { fade: 0.7, ground: true, rot: Math.random() * 6 });
}
// Cannon shell detonation: blast + splash damage to ground units within `r` (linear falloff).
export const SPLASH_R = 44, SPLASH_DMG = 10;
export function detonate(x, y, size = 0.8, mult = 1) {
  explosion(x, y, size);
  G.shake = Math.max(G.shake, 3 * mult);
  const R = SPLASH_R * (0.7 + 0.3 * mult), D = SPLASH_DMG * mult;
  for (const e of G.enemies) {
    if (e.def.air) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.rad;
    if (d < R) { e.hp -= D * (1 - Math.max(0, d) / R); e.flash = Math.max(e.flash, 6); e.seen = true; }
  }
  const b = G.boss;
  if (b && !b.dying) { const d = Math.hypot(b.x - x, b.y - y) - b.rad; if (d < R) { b.hp -= D * 0.5 * (1 - Math.max(0, d) / R); b.flash = Math.max(b.flash, 4); } }
}
export function muzzle(x, y, ang, size = 1) {
  spawnParticle(x, y, 0, 0, 5, 'flash', 1.2 * size, 1, 0.9, 0.6, true, { rot: ang, grow: 0.3 });
  for (let i = 0; i < 4 * size; i++) {
    const a = ang + (Math.random() - 0.5) * 0.6, sp = 1 + Math.random() * 2;
    spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 20 + Math.random() * 15, 'smoke', 0.6 + Math.random() * 0.5 * size, 0.6, 0.6, 0.6, false, { grow: 0.05, drag: 0.94, fade: 0.5 });
  }
}
// Infantry death: red spray + splats that stay on the ground.
export function gore(x, y, vx = 0, vy = 0) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2.5;
    spawnParticle(x, y, Math.cos(a) * sp + vx * 0.3, Math.sin(a) * sp + vy * 0.3, 12 + Math.random() * 14, 'spark', 0.8 + Math.random() * 0.8, 0.75, 0.05, 0.05, false, { drag: 0.85, fade: 0.95 });
  }
  const n = 3 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = i ? 3 + Math.random() * 11 : 0;
    spawnParticle(x + Math.cos(a) * d + vx * 2, y + Math.sin(a) * d + vy * 2, 0, 0, 2400 + Math.random() * 1200, 'crater', (i ? 0.25 : 0.5) + Math.random() * 0.25, 0.5, 0.03, 0.03, false, { fade: 0.85, ground: true, rot: Math.random() * 6, sy: 0 });
  }
}
export function leafBurst(x, y) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2;
    spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 30 + Math.random() * 30, 'spark', 1.2, 0.3 + Math.random() * 0.3, 0.5 + Math.random() * 0.3, 0.15, false, { drag: 0.93, fade: 0.9 });
  }
  spawnParticle(x, y, 0, 0, 30, 'smoke', 1.5, 0.35, 0.3, 0.2, false, { grow: 0.08, fade: 0.6 });
}

// Burning wreck: emits flame + smoke for a while.
export function crashFire(x, y, frames = 300, size = 1) {
  const f = { t: 0 };
  const tick = () => {
    f.t++;
    if (f.t > frames || G.state === 'title') return;
    const k = 1 - f.t / frames;
    if (f.t % 2 === 0) spawnParticle(x + (Math.random() - 0.5) * 8 * size, y + (Math.random() - 0.5) * 6 * size, (Math.random() - 0.5) * 0.3, -0.4 - Math.random() * 0.6, 14 + Math.random() * 12, 'flame', (0.8 + Math.random() * 0.8) * (0.4 + 0.6 * k) * size, 1, 0.7 + Math.random() * 0.3, 0.4, true, { grow: -0.02, drag: 0.96, rot: (Math.random() - 0.5) * 0.6 });
    if (f.t % 5 === 0) spawnParticle(x + (Math.random() - 0.5) * 6, y - 4, (Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.4, 70 + Math.random() * 50, 'smoke', (0.6 + Math.random() * 0.5) * size, 0.12, 0.12, 0.13, false, { grow: 0.035, drag: 0.985, fade: 0.7 * (0.5 + 0.5 * k) });
    if (f.t % 9 === 0) spawnParticle(x + (Math.random() - 0.5) * 6, y, (Math.random() - 0.5) * 1.5, -1 - Math.random() * 1.5, 20 + Math.random() * 20, 'spark', 0.8, 1, 0.8, 0.3, true, { grav: 0.05, drag: 0.97 });
    after(1, tick);
  };
  after(1, tick);
}

// ---------------- smoke clouds (gameplay) ----------------
export function spawnSmoke(x, y, life = 480) {
  G.smokes.push({ x, y, r: 6, t: 0, life, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.01 });
}
export function updateSmokes() {
  const ss = G.smokes;
  for (let i = ss.length - 1; i >= 0; i--) {
    const s = ss[i];
    s.t++; s.x += s.vx; s.y += s.vy; s.rot += s.spin;
    s.r = Math.min(34, s.r + (s.t < 60 ? 0.5 : 0.02));
    if (s.t >= s.life) { ss[i] = ss[ss.length - 1]; ss.pop(); }
  }
}
export function inSmoke(x, y) {
  for (const s of G.smokes) if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r * 0.7) return true;
  return false;
}

// ---------------- pickups ----------------
export function spawnPickup(x, y, type) { G.pickups.push({ x, y, type, t: 0 }); }
export function updatePickups() {
  const p = G.player, ps = G.pickups;
  for (let i = ps.length - 1; i >= 0; i--) {
    const k = ps[i];
    k.t++;
    if (k.t > 1800 || (p && Math.hypot(p.x - k.x, p.y - k.y) > 900)) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    if (p && !p.dead) {
      const dx = p.x - k.x, dy = p.y - k.y;
      if (dx * dx + dy * dy < 18 * 18) {
        if (k.type === 'repair') { if (p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + 60); else addScore(1000); }
        else if (k.type === 'ammop') { if (p.ammo < 20) p.ammo = Math.min(20, p.ammo + 5); else addScore(1000); }
        else { if (p.smoke < 8) p.smoke += 2; else addScore(1000); }
        addScore(200);
        audio.pickup();
        for (let j = 0; j < 8; j++) spawnParticle(k.x, k.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 20, 'spark', 1.5, 1, 1, 0.5, true);
        ps[i] = ps[ps.length - 1]; ps.pop();
      }
    }
  }
}

// ---------------- player ----------------
export function newPlayer() {
  return { x: 0, y: 0, rot: -Math.PI / 2, trot: -Math.PI / 2, v: 0, hp: 150, maxhp: 150, lives: 3, smoke: 4, smokeT: 0, ammo: 0,
           cannonT: 0, mgHeat: 0, mgT: 0, jam: 0, rad: 11, inv: 0, dead: 0, treads: 0, scale: 1, intro: 0 };
}
export const SHOW = { x: 0, y: -20, scale: 2.4 };
export function startIntro(p) { p.x = SHOW.x; p.y = SHOW.y; p.scale = SHOW.scale; p.intro = 75; p.inv = 120; }

const scratch = [];
export function barrelTip(p, len = 26) { return [p.x + Math.cos(p.trot) * len, p.y + Math.sin(p.trot) * len]; }
function fireCannon(p) {
  const [bx, by] = barrelTip(p);
  const v = 9;
  // With the mouse the shell is fused to burst at the cursor; keys give max range.
  let life = 90;
  if (input.mouse) {
    const wx = input.mx + G.cam.x - W / 2, wy = input.my + G.cam.y - H / 2;
    life = Math.max(3, Math.min(90, Math.round((Math.hypot(wx - bx, wy - by)) / v)));
  }
  const heavy = p.ammo > 0; // APFSDS: sabot round, ~3x the punch and a bigger blast
  if (heavy) p.ammo--;
  spawnBullet(G.pb, bx, by, Math.cos(p.trot) * v, Math.sin(p.trot) * v, heavy
    ? { frame: 'ap', r: 0.7, g: 0.9, b: 1, sx: 1.5, rad: 4, dmg: 40, type: 'ap', heavy: true, life, fn: b => { if (b.t === b.life) detonate(b.x, b.y, 1.1, 2); } }
    : { frame: 'ap', r: 1, g: 0.95, b: 0.7, rad: 3, dmg: 15, type: 'ap', life, fn: b => { if (b.t === b.life) detonate(b.x, b.y, 0.7); } });
  muzzle(bx, by, p.trot, heavy ? 1.9 : 1.4);
  p.v -= Math.cos(p.trot - p.rot) * 0.7;
  G.shake = Math.max(G.shake, 5); p.cannonT = 38;
  audio.cannon();
}
function fireMG(p) {
  const [bx, by] = barrelTip(p, 16);
  const a = p.trot + (Math.random() - 0.5) * 0.08, v = 11;
  spawnBullet(G.pb, bx + Math.cos(p.trot + Math.PI / 2) * 3, by + Math.sin(p.trot + Math.PI / 2) * 3, Math.cos(a) * v, Math.sin(a) * v, { frame: 'tracer', r: 1, g: 0.8, b: 0.4, rad: 1.5, dmg: 1, type: 'mg', life: 45 });
  p.mgT = 4; p.mgHeat += 3;
  if (p.mgHeat >= 100) { p.jam = 90; p.mgHeat = 100; audio.clank(); }
  audio.mg();
}
export function popSmoke(p) {
  p.smoke--; p.smokeT = 60;
  const back = p.trot + Math.PI;
  for (let i = -2; i <= 2; i++) {
    const a = back + i * 0.45, d = 34 + Math.abs(i) * 6;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    after(6 + Math.abs(i) * 4, () => { spawnSmoke(x, y); for (let j = 0; j < 4; j++) spawnParticle(x, y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 30, 'spark', 1, 1, 1, 0.9, true, { drag: 0.9 }); });
    spawnParticle(p.x, p.y, Math.cos(a) * 3, Math.sin(a) * 3, 12, 'spark', 1.5, 1, 0.9, 0.7, true, { drag: 0.85 });
  }
  audio.smoke();
}
const QUIPS = [
  'CREW BAILED OUT.\nFOUND THE COFFEE THERMOS INTACT.',
  'THE MOOSE WATCHED.\nTHE MOOSE JUDGED.',
  'HÄGGLUNDS WOULD LIKE\nA WORD ABOUT THE WARRANTY.',
  'SPARE CV90 LOCATED\nBEHIND THE IKEA.',
  'REPORTED AS MISSING.\nFOUND IN THE QUEUE AT SYSTEMBOLAGET.',
  'ALLEMANSRÄTTEN APPLIES.\nYOU MAY CAMP IN THE WRECK.',
  'FLATTENED A BLUEBERRY PATCH.\nTHIS IS THE REAL TRAGEDY.',
  'INSURANCE DECLINED.\nACT OF NEIGHBOUR.',
  'FIKA BREAK.\nINVOLUNTARY.',
  'ORDERED A NEW VAGN.\nDELIVERY IN 6-8 WEEKS.',
  'NOTHING TO SEE HERE.\nSAYS THE OFFICIAL STATEMENT.',
  'CREW ON SICK LEAVE.\nVAB APPROVED.',
  'TEXTED MOM.\n"ALL GOOD." SENT.',
  'THE PINES REMEMBER.\nTHE PINES DO NOT FORGIVE.',
  'WALKED HOME.\nTICK COUNT: 14.',
  'BURNED FOR A WHILE.\nLINGONBERRIES NEARBY LIGHTLY TOASTED.',
];
export function hurtPlayer(dmg, x, y) {
  const p = G.player;
  if (!p || p.dead || p.inv > 0 || G.god) return;
  p.hp -= dmg;
  G.shake = Math.max(G.shake, Math.min(14, 3 + dmg * 0.4)); G.chroma = Math.max(G.chroma, 0.6);
  audio.hurt();
  for (let i = 0; i < 6; i++) spawnParticle(x, y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 15, 'spark', 1.3, 1, 0.8, 0.4, true, { drag: 0.9 });
  if (p.hp <= 0) killPlayer();
}
export function killPlayer() {
  const p = G.player;
  if (!p || p.dead) return;
  explosion(p.x, p.y, 2.4);
  audio.die();
  p.dead = 170; p.lives--;
  G.sub = QUIPS[(Math.random() * QUIPS.length) | 0];
  crashFire(p.x, p.y, 200, 1.4);
  // turret pops off
  spawnParticle(p.x, p.y, (Math.random() - 0.5) * 3, -3 - Math.random() * 2, 60, 'ring', 0.3, 0.3, 0.3, 0.3, false, { grav: 0.1, spin: 0.3, fade: 1 });
  clearBullets(G.eb, true);
  G.shake = 18; G.chroma = 1.5; G.flash = 0.5;
}
export function updatePlayer(p) {
  if (p.dead) {
    p.dead--;
    if (p.dead === 0) {
      if (p.lives < 0) { G.state = 'gameover'; return; }
      G.sub = '';
      p.hp = p.maxhp; p.inv = 180; p.smoke = Math.max(p.smoke, 3); p.v = 0; p.mgHeat = 0; p.jam = 0; p.cannonT = 0;
      for (const e of G.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 220) { e.hp = 0; e.silent = true; } }
      if (G.boss && !G.boss.dying) { const b = G.boss, a = Math.atan2(b.y - p.y, b.x - p.x); b.x = p.x + Math.cos(a) * 320; b.y = p.y + Math.sin(a) * 320; }
    }
    return;
  }
  if (p.intro) {
    p.intro--;
    const k = 1 - p.intro / 75, e = k * k * (3 - 2 * k);
    p.x = SHOW.x; p.y = SHOW.y * (1 - e); p.scale = SHOW.scale + (1 - SHOW.scale) * e;
    return;
  }
  // drive
  const maxF = 2.4, maxR = 1.2;
  if (input.drive > 0) p.v += 0.1 * input.drive; else if (input.drive < 0) p.v += 0.08 * input.drive;
  p.v *= 0.94;
  p.v = Math.max(-maxR, Math.min(maxF, p.v));
  if (Math.abs(p.v) < 0.02 && !input.drive) p.v = 0;
  const steer = input.steer * (p.v < -0.1 ? -1 : 1);
  p.rot += steer * 0.04 * (0.55 + Math.min(1, Math.abs(p.v) / maxF) * 0.45);
  const ox = p.x, oy = p.y;
  p.x += Math.cos(p.rot) * p.v; p.y += Math.sin(p.rot) * p.v;
  if (collideTrees(p, scratch)) { p.v *= 0.7; if (Math.abs(p.v) > 0.8 && G.time % 6 === 0) audio.clank(); }
  // treads: dust + track marks
  const moved = Math.hypot(p.x - ox, p.y - oy);
  p.treads += moved;
  if (p.treads > 9) {
    p.treads = 0;
    const px = p.rot + Math.PI / 2;
    for (const s of [-8, 8]) spawnParticle(p.x + Math.cos(px) * s, p.y + Math.sin(px) * s, 0, 0, 420, 'track', 0.7, 0.16, 0.13, 0.08, false, { rot: p.rot + Math.PI / 2, fade: 0.22, ground: true });
    const bx = p.x - Math.cos(p.rot) * 14, by = p.y - Math.sin(p.rot) * 14;
    spawnParticle(bx + (Math.random() - 0.5) * 8, by + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 35 + Math.random() * 20, 'smoke', 0.8, 0.45, 0.4, 0.3, false, { grow: 0.05, fade: 0.35 });
  }
  // turret: mouse aim (fast slew) or keys
  if (input.turret) p.trot += input.turret * 0.06;
  else if (input.mouse) {
    const wx = input.mx + G.cam.x - W / 2, wy = input.my + G.cam.y - H / 2;
    const want = Math.atan2(wy - p.y, wx - p.x), d = Math.atan2(Math.sin(want - p.trot), Math.cos(want - p.trot));
    p.trot += Math.max(-0.16, Math.min(0.16, d));
  }
  // weapons
  if (p.inv > 0) p.inv--;
  if (p.cannonT > 0) p.cannonT--;
  if (p.mgT > 0) p.mgT--;
  if (p.smokeT > 0) p.smokeT--;
  if (p.jam > 0) { p.jam--; if (p.jam === 0) p.mgHeat = 30; } else if (p.mgHeat > 0) p.mgHeat -= 0.8;
  if (input.fire && p.cannonT === 0) fireCannon(p);
  if (input.mg && p.mgT === 0 && p.jam === 0) fireMG(p);
  if (input.smoke && p.smokeT === 0 && p.smoke > 0) popSmoke(p);
}
