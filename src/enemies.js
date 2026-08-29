import { G, addScore, hpMul, rate, after } from './state.js';
import { spawnBullet, spawnParticle, spawnPickup, spawnSmoke, explosion, crashFire, muzzle, inSmoke, gore } from './entities.js';
import { collideTrees } from './terrain.js';
import * as P from './patterns.js';
import { audio } from './audio.js';

const every = (e, n, phase = 0) => e.t > 90 && (e.t + phase) % Math.max(1, Math.round(n * rate())) === 0;
const scratch = [];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// Rotate `cur` toward `target` by at most `max`. Returns new angle.
const turn = (cur, target, max) => { const d = wrap(target - cur); return cur + Math.max(-max, Math.min(max, d)); };
const dist = e => { const p = G.player; return p ? Math.hypot(p.x - e.x, p.y - e.y) : 1e9; };
// Where does the enemy think the player is? Updates lastSeen when LOS is clear.
function sense(e, air = false) {
  const p = G.player;
  if (!p) return false;
  const los = P.hasLOS(e.x, e.y, air) && !inSmoke(p.x, p.y);
  if (los) { e.seen = true; e.sx = p.x; e.sy = p.y; e.lost = 0; }
  else if (e.seen) { e.lost++; if (e.lost > 90) { e.seen = false; e.sx += (Math.random() - 0.5) * 3; e.sy += (Math.random() - 0.5) * 3; } }
  return los;
}
// Drive toward (tx,ty) at speed, keeping `keep` distance; hull turns at `tr`.
function drive(e, tx, ty, speed, tr, keep = 0, strafe = 0) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  let want = Math.atan2(dy, dx);
  if (d < keep) want += Math.PI; else if (strafe) want += strafe * (e.seed % 2 ? 1 : -1);
  e.rot = turn(e.rot, want, tr);
  const sp = d < keep * 0.6 ? speed * 0.5 : speed;
  e.x += Math.cos(e.rot) * sp; e.y += Math.sin(e.rot) * sp;
  if (collideTrees(e, scratch)) e.rot += (e.seed % 2 ? 1 : -1) * 0.06;
}
const aimTurret = (e, ang, tr) => { e.trot = turn(e.trot, ang, tr); return Math.abs(wrap(ang - e.trot)); };
const tip = (e, len, ang = e.trot) => [e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len];

const SHELL = { frame: 'shell', r: 1, g: 0.7, b: 0.4, rad: 3, type: 'shell', life: 120 };
const AC = { frame: 'tracer', r: 1, g: 0.5, b: 0.3, rad: 2, type: 'mg', life: 70 };
const RPG = { frame: 'rpg', r: 1, g: 1, b: 1, rad: 3, type: 'rpg', life: 120 };
const homing = (x, y, ang, speed, dmg, o = {}) => {
  const b = P.shot(x, y, ang, speed, { frame: 'rocket', r: 1, g: 0.9, b: 0.8, rad: 3, dmg, type: 'atgm', life: 240, ...o });
  b.fn = bb => { const p = G.player; if (!p || p.dead || inSmoke(p.x, p.y)) return; const s = Math.hypot(bb.vx, bb.vy), a = turn(Math.atan2(bb.vy, bb.vx), Math.atan2(p.y - bb.y, p.x - bb.x), 0.025); bb.vx = Math.cos(a) * s; bb.vy = Math.sin(a) * s; if (bb.t % 3 === 0) spawnParticle(bb.x, bb.y, 0, 0, 25, 'smoke', 0.6, 0.8, 0.8, 0.8, false, { grow: 0.04, fade: 0.5 }); };
  return b;
};

export const TYPES = {
  inf: { hull: 'inf', hp: 2, rad: 5, score: 50, air: false, drop: 0.05, wreck: null, update(e) {
    const los = sense(e);
    const d = dist(e);
    if (e.seen && d > 110) drive(e, e.sx, e.sy, 0.75, 0.08);
    else if (!e.seen) { if (e.t % 120 === 0) e.wander = Math.random() * 6.28; e.rot = turn(e.rot, e.wander || 0, 0.05); e.x += Math.cos(e.rot) * 0.4; e.y += Math.sin(e.rot) * 0.4; collideTrees(e, scratch); }
    else e.rot = turn(e.rot, Math.atan2(e.sy - e.y, e.sx - e.x), 0.1);
    e.trot = e.rot;
    if (los && d < 260 && every(e, 220, e.seed % 220)) { const [x, y] = tip(e, 6, e.rot); P.shot(x, y, P.lead(e.x, e.y, 3.5) + (Math.random() - 0.5) * 0.3, 3.5, { ...RPG, dmg: 7 }); muzzle(x, y, e.rot, 0.6); audio.rpg(); }
  } },
  bmp: { hull: 'bmp_hull', turret: 'bmp_turret', hp: 15, rad: 10, score: 300, air: false, drop: 0.2, wreck: 'wreck_s', update(e) {
    const los = sense(e);
    const d = dist(e);
    if (e.seen) drive(e, e.sx, e.sy, 1.3, 0.03, 140, d < 220 ? 0.9 : 0);
    else drive(e, e.sx, e.sy, 0.7, 0.03, 30);
    const err = aimTurret(e, e.seen ? P.lead(e.x, e.y, 7) : e.rot, 0.05);
    if (los && err < 0.15 && d < 320) {
      if (every(e, 140, e.seed % 140)) e.burst = 3;
      if (e.burst > 0 && e.t % 5 === 0) { e.burst--; const [x, y] = tip(e, 17); P.shot(x, y, e.trot + (Math.random() - 0.5) * 0.14, 6, { ...AC, dmg: 2 }); muzzle(x, y, e.trot, 0.5); audio.eshot(); }
      if (every(e, 520, (e.seed % 200) + 100) && d > 120) { const [x, y] = tip(e, 4, e.trot + Math.PI / 2); homing(x, y, e.trot, 2.6, 14); audio.rpg(); }
    }
  } },
  t72: { hull: 't72_hull', turret: 't72_turret', hp: 45, rad: 13, score: 800, air: false, drop: 0.4, wreck: 'wreck_m', update(e) {
    const los = sense(e);
    const d = dist(e);
    drive(e, e.sx, e.sy, e.seen ? 0.85 : 0.5, 0.02, 200);
    const err = aimTurret(e, e.seen ? P.lead(e.x, e.y, 7) : e.rot, 0.02);
    if (los && err < 0.06 && d < 340 && every(e, 240, e.seed % 240)) { const [x, y] = tip(e, 24); P.shot(x, y, e.trot + (Math.random() - 0.5) * 0.1, 6, { ...SHELL, dmg: 18 }); muzzle(x, y, e.trot, 1.3); e.x -= Math.cos(e.trot) * 2; e.y -= Math.sin(e.trot) * 2; audio.eshell(); }
  } },
  hind: { hull: 'hind', hp: 25, rad: 12, score: 500, air: true, drop: 0.5, wreck: 'wreck_h', update(e) {
    const p = G.player;
    const los = sense(e, true);
    e.rotor += 0.7;
    // figure-8 around the last known position
    const k = e.t * 0.012 + e.seed;
    const tx = e.sx + Math.cos(k) * 170, ty = e.sy + Math.sin(2 * k) * 110;
    const want = Math.atan2(ty - e.y, tx - e.x);
    e.rot = turn(e.rot, want, 0.035);
    e.x += Math.cos(e.rot) * 2.1; e.y += Math.sin(e.rot) * 2.1;
    e.trot = e.rot;
    const d = dist(e), ang = P.aimAngle(e.x, e.y), fwd = Math.abs(wrap(ang - e.rot));
    if (los && p && fwd < 0.5 && d < 300) {
      if (every(e, 300, e.seed % 300)) for (let i = 0; i < 6; i++) after(i * 5, () => { const s = i % 2 ? 9 : -9; const [x, y] = tip(e, 0, e.rot + Math.PI / 2); P.shot(x + Math.cos(e.rot + Math.PI / 2) * s, y + Math.sin(e.rot + Math.PI / 2) * s, e.rot + (Math.random() - 0.5) * 0.2, 5, { frame: 'rocket', r: 1, g: 0.9, b: 0.7, rad: 3, dmg: 5, type: 'rocket', air: true, life: 90 }); audio.rpg(); });
      if (every(e, 100, e.seed % 100)) e.burst = 4;
    }
    if (e.burst > 0 && e.t % 4 === 0) { e.burst--; const [x, y] = tip(e, 20); P.shot(x, y, ang + (Math.random() - 0.5) * 0.2, 7, { ...AC, dmg: 1, air: true }); audio.eshot(); }
  } },
};

// Static objective structure. Calls for help when attacked.
TYPES.depot = { hull: 'depot', hp: 120, rad: 17, score: 2000, air: false, drop: 1, wreck: 'wreck_d', static: true, update(e) {
  if (e.flash && e.t % 90 === 0) { const a = Math.random() * 6.28; spawnEnemy('inf', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); }
} };

export function spawnEnemy(type, x, y, o = {}) {
  const d = TYPES[type];
  const hp = Math.ceil(d.hp * hpMul());
  const p = G.player;
  const rot = p ? Math.atan2(p.y - y, p.x - x) : 0;
  const e = { type, def: d, x, y, t: 0, hp, maxhp: hp, rad: d.rad, rot, trot: rot, seed: (Math.random() * 1000) | 0, flash: 0,
              seen: true, sx: p ? p.x : 0, sy: p ? p.y : 0, lost: 0, burst: 0, rotor: 0, wander: 0, silent: false, ...o };
  G.enemies.push(e);
  return e;
}
export function killEnemy(i) {
  const e = G.enemies[i], d = e.def;
  if (!e.silent) {
    if (e.type === 'inf') { gore(e.x, e.y, e.kvx || 0, e.kvy || 0); audio.hit(); }
    else { explosion(e.x, e.y, d.air ? 1.4 : d.hp > 30 ? 1.8 : d.hp > 10 ? 1.3 : 0.6); audio.explode(d.hp > 30 || d.air); }
    addScore(d.score);
    if (Math.random() < d.drop) spawnPickup(e.x, e.y, Math.random() < 0.6 ? 'repair' : 'smokep');
    if (d.hp > 10) G.shake = Math.max(G.shake, 6);
    if (d.wreck) {
      const wx = e.x + (d.air ? (Math.random() - 0.5) * 30 : 0), wy = e.y + (d.air ? (Math.random() - 0.5) * 30 : 0);
      spawnParticle(wx, wy, 0, 0, 3000, d.wreck, 1, 1, 1, 1, false, { rot: e.rot + Math.PI / 2, ground: true, fade: 1 });
      crashFire(wx, wy, d.hp > 30 ? 500 : 240, d.hp > 30 ? 1.3 : 0.9);
    }
  }
  G.enemies[i] = G.enemies[G.enemies.length - 1]; G.enemies.pop();
}
export function updateEnemies() {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    e.t++; e.def.update(e);
    if (e.flash) e.flash--;
    if (e.hp <= 0) { killEnemy(i); continue; }
    if (p && !e.def.static && e.t > 300 && Math.hypot(e.x - p.x, e.y - p.y) > 800) { G.enemies[i] = G.enemies[G.enemies.length - 1]; G.enemies.pop(); }
  }
}

// ---------------- boss: T-90 command tank ----------------
export function spawnBoss(x, y) {
  const hp = Math.ceil(700 * hpMul());
  const p = G.player, rot = p ? Math.atan2(p.y - y, p.x - x) : 0;
  G.boss = { x, y, rot, trot: rot, t: 0, hp, maxhp: hp, rad: 24, flash: 0, dying: 0, phase: 0, seed: (Math.random() * 1000) | 0, seen: true, sx: p ? p.x : 0, sy: p ? p.y : 0, lost: 0, burst: 0 };
}
export function updateBoss() {
  const b = G.boss; if (!b) return;
  b.t++;
  if (b.dying) {
    b.dying++;
    if (b.dying % 6 === 0) explosion(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 50, 1.2);
    if (b.dying % 6 === 0) audio.explode(false);
    if (b.dying === 170) {
      explosion(b.x, b.y, 3.5); explosion(b.x - 20, b.y + 10, 2.2); explosion(b.x + 20, b.y - 10, 2.2);
      audio.explode(true); G.shake = 24; G.flash = 0.8;
      spawnParticle(b.x, b.y, 0, 0, 4000, 'wreck_l', 1, 1, 1, 1, false, { rot: b.rot + Math.PI / 2, ground: true });
      crashFire(b.x, b.y, 900, 2);
      G.boss = null;
      if (G.onBossDead) G.onBossDead();
    }
    return;
  }
  const los = sense(b);
  const d = dist(b);
  drive(b, b.sx, b.sy, b.seen ? 0.7 : 0.4, 0.015, 180, d < 260 && b.phase ? 0.7 : 0);
  const fr = b.hp / b.maxhp;
  const phase = fr > 0.5 ? 0 : 1;
  if (phase !== b.phase) { b.phase = phase; G.flash = 0.4; G.shake = 8; audio.alert(); for (let i = 0; i < 6; i++) { const a = i * 1.05; spawnSmoke(b.x + Math.cos(a) * 50, b.y + Math.sin(a) * 50, 300); } }
  const err = aimTurret(b, b.seen ? P.lead(b.x, b.y, 7.5) : b.rot, 0.025);
  if (los && d < 400) {
    if (err < 0.08 && every(b, phase ? 130 : 170, b.seed % 100)) { const [x, y] = tip(b, 38); P.shot(x, y, b.trot + (Math.random() - 0.5) * 0.08, 6.5, { ...SHELL, sx: 1.3, rad: 4, dmg: 22 }); muzzle(x, y, b.trot, 2); audio.eshell(); G.shake = Math.max(G.shake, 4); }
    if (every(b, 110, (b.seed % 70) + 30)) b.burst = 5;
  }
  if (b.burst > 0 && b.t % 4 === 0) { b.burst--; const [x, y] = tip(b, 14, b.trot); const sx = Math.cos(b.trot + Math.PI / 2) * 5, sy = Math.sin(b.trot + Math.PI / 2) * 5; P.shot(x + sx, y + sy, b.trot + (Math.random() - 0.5) * 0.14, 7, { ...AC, dmg: 2 }); audio.eshot(); }
  if (phase === 1) {
    if (every(b, 260, 60)) { for (let i = 0; i < 6; i++) { const a = b.rot + (i - 2.5) * 0.35; const [x, y] = tip(b, 20, a); after(i * 8, () => { homing(x, y, a, 2.3, 14); audio.rpg(); }); } }
    if (every(b, 300, 200)) for (let i = 0; i < 3; i++) { const a = b.rot + Math.PI + (i - 1) * 0.8; spawnEnemy('inf', b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 40); }
    if (every(b, 420, 300) && d < 200) { for (let i = 0; i < 5; i++) { const a = b.trot + (i - 2) * 0.5; spawnSmoke(b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60, 360); } audio.smoke(); }
  }
}
