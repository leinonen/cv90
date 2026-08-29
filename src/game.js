import { G, addScore } from './state.js';
import { removeBullet, spawnParticle, explosion, leafBurst, hurtPlayer, detonate } from './entities.js';
import { treesNear, removeTree } from './terrain.js';
import { audio } from './audio.js';

const scratch = [];
// Swept test: check the bullet at its current position and halfway back along its velocity.
function hitTree(b, canDamage) {
  for (const t of treesNear(b.x, b.y, 12, scratch)) {
    if (!t.big) continue;
    const r = (t.rad + b.rad + 1) ** 2;
    const d0 = (t.x - b.x) ** 2 + (t.y - b.y) ** 2, mx = b.x - b.vx * 0.5, my = b.y - b.vy * 0.5;
    if (d0 < r || (t.x - mx) ** 2 + (t.y - my) ** 2 < r) {
      if (canDamage) { t.hp -= b.type === 'ap' ? 3 : 1; leafBurst(b.x, b.y); if (t.hp <= 0) { removeTree(t); spawnParticle(t.x, t.y, 0, 0, 6000, 'stump', 1, 1, 1, 1, false, { ground: true }); if (b.type === 'ap') detonate(b.x, b.y, b.heavy ? 1 : 0.6, b.heavy ? 2 : 1); else explosion(t.x, t.y, 0.5); leafBurst(t.x, t.y); addScore(5); } }
      else spawnParticle(b.x, b.y, 0, 0, 8, 'spark', 1, 0.6, 0.8, 0.4, true);
      return true;
    }
  }
  return false;
}
export function collisions() {
  const p = G.player, pb = G.pb, eb = G.eb, en = G.enemies, b = G.boss;
  // player bullets vs enemies / boss / trees
  for (let i = pb.length - 1; i >= 0; i--) {
    const k = pb[i]; let hit = false;
    const ap = k.type === 'ap';
    for (let j = en.length - 1; j >= 0 && !hit; j--) {
      const e = en[j];
      if (ap && e.def.air) continue; // cannon can't elevate to the Hind
      const dx = e.x - k.x, dy = e.y - k.y;
      if (dx * dx + dy * dy < (e.rad + k.rad) ** 2) {
        e.hp -= k.dmg; e.flash = ap ? 8 : 3; hit = true; e.kvx = k.vx; e.kvy = k.vy;
        if (ap) detonate(k.x, k.y, k.heavy ? 1.2 : 0.8, k.heavy ? 2 : 1);
        else spawnParticle(k.x, k.y, -k.vx * 0.1, -k.vy * 0.1, 8, 'spark', 1.2, 1, 0.9, 0.6, true);
        audio.hit();
        if (!e.def.air && e.hp > 0 && e.def.hp > 10) e.seen = true; // getting shot reveals you
      }
    }
    if (!hit && b && !b.dying) {
      const dx = b.x - k.x, dy = b.y - k.y;
      if (dx * dx + dy * dy < (b.rad + k.rad) ** 2) {
        b.hp -= ap ? k.dmg : k.dmg * 0.25; b.flash = 6; hit = true;
        if (ap) { detonate(k.x, k.y, k.heavy ? 1.4 : 0.9, k.heavy ? 2 : 1); audio.bossHit(); } else spawnParticle(k.x, k.y, -k.vx * 0.2, -k.vy * 0.2, 8, 'spark', 1.2, 1, 0.9, 0.6, true);
        if (b.hp <= 0) { b.dying = 1; addScore(20000 * G.stage); G.flash = 0.5; }
      }
    }
    if (!hit && hitTree(k, ap)) hit = true;
    if (hit) removeBullet(pb, i);
  }
  // enemy bullets vs player / trees
  for (let i = eb.length - 1; i >= 0; i--) {
    const k = eb[i]; let hit = false;
    if (p && !p.dead) {
      const dx = p.x - k.x, dy = p.y - k.y;
      if (dx * dx + dy * dy < (p.rad + k.rad) ** 2) {
        hit = true;
        if (k.type === 'mg') spawnParticle(k.x, k.y, -k.vx * 0.1, -k.vy * 0.1, 8, 'spark', 1.2, 1, 0.9, 0.6, true);
        else explosion(k.x, k.y, 0.7);
        hurtPlayer(k.dmg, k.x, k.y);
        if (p.dead) break; // killPlayer cleared eb; array is gone
      }
    }
    if (!hit && !k.air && k.t > 4 && hitTree(k, k.type === 'shell' || k.type === 'atgm')) { hit = true; if (k.type !== 'mg') explosion(k.x, k.y, 0.5); }
    if (hit) removeBullet(eb, i);
  }
  // hull vs ground enemies: push apart, crush infantry
  if (p && !p.dead) {
    for (let j = en.length - 1; j >= 0; j--) {
      const e = en[j];
      if (e.def.air) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy, r = e.rad + p.rad;
      if (d2 < r * r && d2 > 0.01) {
        if (e.type === 'inf') { e.hp = 0; e.kvx = Math.cos(p.rot) * p.v; e.kvy = Math.sin(p.rot) * p.v; continue; }
        const d = Math.sqrt(d2), k = (r - d) / d;
        e.x += dx * k * 0.5; e.y += dy * k * 0.5; p.x -= dx * k * 0.5; p.y -= dy * k * 0.5;
        if (Math.abs(p.v) > 1.5) { p.v *= 0.5; hurtPlayer(3, p.x + dx * 0.5, p.y + dy * 0.5); e.hp -= 3; e.flash = 4; }
      }
    }
    if (b && !b.dying) {
      const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy, r = b.rad + p.rad;
      if (d2 < r * r && d2 > 0.01) { const d = Math.sqrt(d2), k = (r - d) / d; p.x -= dx * k; p.y -= dy * k; if (Math.abs(p.v) > 1) { p.v *= -0.3; hurtPlayer(5, p.x + dx * 0.5, p.y + dy * 0.5); } }
    }
  }
}
