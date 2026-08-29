import { G, W, H, after, addScore } from './state.js';
import { spawnEnemy, spawnBoss } from './enemies.js';
import { audio } from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const P = () => G.player || { x: 0, y: 0, rot: 0 };
// Spawn relative to the player: angle offset from hull heading, distance.
const at = (type, ang, dist = 360, o) => { const p = P(); const a = p.rot + ang; return spawnEnemy(type, p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist, o); };
const ahead = (type, n, spread = 1.2, dist = 360) => { for (let i = 0; i < n; i++) after(i * 6 + 1, () => at(type, (n === 1 ? 0 : -spread / 2 + spread * i / (n - 1)) + rnd(-0.1, 0.1), dist + rnd(-30, 30))); };
const squad = (n, ang = 0, dist = 340) => { for (let i = 0; i < n; i++) after(i * 10 + 1, () => at('inf', ang + rnd(-0.3, 0.3), dist + rnd(-20, 40))); };
const ambush = (type, n, dist = 360) => { for (let i = 0; i < n; i++) after(i * 8 + 1, () => at(type, i * Math.PI * 2 / n + rnd(-0.3, 0.3), dist)); };
const flank = (type, n = 1) => { for (let i = 0; i < n; i++) after(i * 12 + 1, () => at(type, (Math.random() < 0.5 ? 1 : -1) * rnd(1.2, 1.9), 360)); };
const behind = (type, n = 1) => { for (let i = 0; i < n; i++) after(i * 12 + 1, () => at(type, Math.PI + rnd(-0.5, 0.5), 360)); };

const script = [
  [3, () => squad(2)],
  [9, () => squad(3, 0.6)],
  [13.5, () => squad(3, -0.6)],
  [21, () => { ahead('bmp', 1); squad(3, 0.4) }],
  [30, () => flank('bmp', 1)],
  [39, () => { squad(5); flank('inf', 3); }],
  [48, () => ahead('bmp', 2, 0.8)],
  [57, () => { ahead('t72', 1, 0, 340); squad(3, 0.9); }],
  [69, () => { flank('bmp', 2); behind('inf', 3); }],
  [78, () => at('hind', rnd(-1, 1), 380)],
  [87, () => { ambush('inf', 6, 360); }],
  [96, () => { ahead('t72', 1, 0, 340); flank('bmp', 1); }],
  [105, () => { at('hind', 1.5, 380); squad(4); }],
  [114, () => { ahead('bmp', 3, 1.2); behind('t72', 1); }],
  [126, () => { ambush('bmp', 3, 360); squad(4, Math.PI); }],
  [135, () => { at('hind', -1.5, 380); squad(3); }],
  [144, () => { ahead('t72', 2, 1.0, 340); flank('inf', 4); }],
  [153, () => { ambush('inf', 8, 360); flank('bmp', 2); }],
  [162, () => { G.bossPending = true; }],
];

export function resetLevel() {
  G.levelT = 0; G.levelIdx = 0; G.bossPending = false; G.clearT = 0; G.boss = null;
  G.onBossDead = stageCleared;
}
function stageCleared() {
  addScore(10000 * G.stage + 20000 * G.stage);
  G.clearT = 240;
  G.msg = 'AREA CLEARED';
  G.sub = 'BONUS ' + (30000 * G.stage);
  audio.clear();
}
export function updateLevel() {
  if (G.clearT > 0) {
    G.clearT--;
    if (G.clearT === 0) { G.stage++; resetLevel(); G.msg = 'SECTOR ' + G.stage; G.sub = ''; after(120, () => { if (G.msg === 'SECTOR ' + G.stage) G.msg = ''; }); }
    return;
  }
  if (G.boss) return;
  G.levelT += 1 / 60;
  while (G.levelIdx < script.length && script[G.levelIdx][0] <= G.levelT) { script[G.levelIdx][1](); G.levelIdx++; }
  if (G.bossPending && G.enemies.length === 0 && G.timers.length === 0) {
    G.bossPending = false;
    const p = P(), a = p.rot;
    spawnBoss(p.x + Math.cos(a) * 360, p.y + Math.sin(a) * 360);
    G.sub = 'WARNING\nHEAVY ARMOUR';
    audio.alert();
    after(150, () => { if (G.sub.startsWith('WARNING')) G.sub = ''; });
  }
}
