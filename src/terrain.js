// Infinite forest. Ground is shaded entirely in the ground shader; this module owns
// the trees: one hashed candidate per 24px cell, density from fbm, cleared along roads.
// Trees are obstacles for hulls, block line of sight, and can be shot down.
import { W, H } from './state.js';

export const CELL = 24;
function hash(x, y) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function hashf(x, y) { // hash of continuous coords (matches shader hash reasonably)
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hashf(xi, yi), b = hashf(xi + 1, yi), c = hashf(xi, yi + 1), d = hashf(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1 + 5.3, y * 2.1 + 3.7) * 0.3 + noise(x * 4.3 + 9.1, y * 4.3 + 1.3) * 0.15;

// Same formulas as groundFS so gameplay agrees with what is drawn.
export function isRoad(x, y) { return Math.abs(noise(x * 0.004 + 7, y * 0.004 + 7) - 0.5) < 0.025; }
export function isBog(x, y) { return fbm(x * 0.01 + 50, y * 0.01 + 50) > 0.76; }
export function density(x, y) { return fbm(x * 0.012, y * 0.012); }

// ---- tree cache ----
const cells = new Map();
const removed = new Set();
const key = (cx, cy) => cx + ',' + cy;
function cell(cx, cy) {
  const k = key(cx, cy);
  let t = cells.get(k);
  if (t !== undefined) return t;
  const h = hash(cx, cy), h2 = hash(cx * 3 + 1, cy * 5 + 2), h3 = hash(cx * 7 + 3, cy * 11 + 5);
  const x = cx * CELL + 4 + h2 * (CELL - 8), y = cy * CELL + 4 + h3 * (CELL - 8);
  const d = density(x, y);
  const thr = 0.5 + (1 - d) * 0.9; // dense woods where fbm high (~50% of cells), glades where low
  let tree = null;
  if (h > thr && !isRoad(x, y) && !isBog(x, y) && !removed.has(k) && (Math.abs(x) > 40 || Math.abs(y) > 40)) {
    const kind = h2 < 0.55 ? 'pine' : h2 < 0.8 ? 'spruce' : h2 < 0.93 ? 'birch' : 'bush';
    const big = kind !== 'bush';
    tree = { cx, cy, x, y, kind, rad: big ? 5 : 3, big, scale: 0.85 + h3 * 0.4, rot: h * 6.28, hp: big ? 3 : 1 };
  }
  cells.set(k, tree);
  if (cells.size > 3000) { for (const kk of cells.keys()) { cells.delete(kk); if (cells.size < 2000) break; } }
  return tree;
}
export function treesNear(x, y, r, out = []) {
  out.length = 0;
  const c0x = Math.floor((x - r) / CELL), c1x = Math.floor((x + r) / CELL), c0y = Math.floor((y - r) / CELL), c1y = Math.floor((y + r) / CELL);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) { const t = cell(cx, cy); if (t) out.push(t); }
  return out;
}
export function removeTree(t) { removed.add(key(t.cx, t.cy)); cells.set(key(t.cx, t.cy), null); if (removed.size > 4000) removed.clear(); }
// Push a circle (x,y,rad) out of big trees; mutates o.x/o.y. Returns true on contact.
export function collideTrees(o, scratch) {
  let hit = false;
  for (const t of treesNear(o.x, o.y, o.rad + 8, scratch)) {
    if (!t.big) continue;
    const dx = o.x - t.x, dy = o.y - t.y, d2 = dx * dx + dy * dy, r = o.rad + t.rad;
    if (d2 < r * r && d2 > 0.01) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.y += dy * k; hit = true; }
  }
  return hit;
}
// Segment blocked by a big tree? Samples every 12px.
export function treeBlocks(x0, y0, x1, y1, scratch) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), n = Math.ceil(len / 12);
  for (let i = 1; i < n; i++) {
    const x = x0 + dx * i / n, y = y0 + dy * i / n;
    for (const t of treesNear(x, y, 6, scratch)) { if (t.big && (t.x - x) ** 2 + (t.y - y) ** 2 < 36) return true; }
  }
  return false;
}
const scratch = [];
export function drawTrees(R, camX, camY, shadowsOnly, px = 1e9, py = 1e9) {
  const f = R.f;
  const c0x = Math.floor((camX - 24) / CELL), c1x = Math.floor((camX + W + 24) / CELL);
  const c0y = Math.floor((camY - 24) / CELL), c1y = Math.floor((camY + H + 24) / CELL);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const t = cell(cx, cy); if (!t) continue;
    const fr = f[t.kind];
    if (shadowsOnly) R.sprite(fr, t.x + 5 * t.scale, t.y + 7 * t.scale, t.rot, t.scale * 1.05, 0, 0, 0, 0.32, 1);
    else { const d2 = (t.x - px) ** 2 + (t.y - py) ** 2; R.sprite(fr, t.x, t.y, t.rot, t.scale, 1, 1, 1, d2 < 38 * 38 ? 0.4 : 1); }
  }
}
