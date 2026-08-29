import { G, spd } from './state.js';
import { spawnBullet } from './entities.js';
import { treeBlocks } from './terrain.js';

export function aimAngle(x, y) {
  const p = G.player;
  if (!p || p.dead) return 0;
  return Math.atan2(p.y - y, p.x - x);
}
// Angle to where the player will be when a projectile of `speed` arrives.
export function lead(x, y, speed) {
  const p = G.player;
  if (!p || p.dead) return 0;
  const vx = Math.cos(p.rot) * p.v, vy = Math.sin(p.rot) * p.v;
  const d = Math.hypot(p.x - x, p.y - y), t = d / Math.max(1, speed * spd());
  return Math.atan2(p.y + vy * t - y, p.x + vx * t - x);
}
export function shot(x, y, ang, speed, o) {
  const s = speed * spd();
  return spawnBullet(G.eb, x, y, Math.cos(ang) * s, Math.sin(ang) * s, o);
}
export function ring(x, y, n, speed, offset = 0, o) {
  for (let i = 0; i < n; i++) shot(x, y, offset + i * Math.PI * 2 / n, speed, o);
}
export function fan(x, y, ang, n, arc, speed, o) {
  for (let i = 0; i < n; i++) shot(x, y, n === 1 ? ang : ang - arc / 2 + arc * i / (n - 1), speed, o);
}
export function aimedFan(x, y, n, arc, speed, o) { fan(x, y, aimAngle(x, y), n, arc, speed, o); }

const scratch = [];
// Does the segment cross a smoke cloud?
export function smokeBlocks(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  for (const s of G.smokes) {
    const r = s.r * 0.8;
    for (let i = 0; i <= 6; i++) {
      const x = x0 + dx * i / 6, y = y0 + dy * i / 6;
      if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r) return true;
    }
  }
  return false;
}
// Can enemy at (x,y) see the player? Smoke and trees block; air units ignore trees.
export function hasLOS(x, y, air = false) {
  const p = G.player;
  if (!p || p.dead) return false;
  if (smokeBlocks(x, y, p.x, p.y)) return false;
  if (!air && treeBlocks(x, y, p.x, p.y, scratch)) return false;
  return true;
}
