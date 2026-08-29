import { initGL } from './gl.js';
import { Renderer } from './renderer.js';
import { buildAtlas } from './atlas.js';
import { G, W, H, updateTimers, after } from './state.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { drawTrees } from './terrain.js';
import * as E from './entities.js';
import { updateEnemies, updateBoss, spawnBoss } from './enemies.js';
import { updateLevel, resetLevel, drawObjective, nextObjective } from './level.js';
import { collisions } from './game.js';
import { updateHUD, setFontSize } from './hud.js';

const canvas = document.getElementById('c');
const gl = initGL(canvas);
const R = new Renderer(gl, buildAtlas());
const F = R.f;
const DEBUG = location.search.includes('debug');
const AUTO = location.search.includes('auto'); // headless smoke test: autoplay
const GOD = location.search.includes('god');
const dbg = document.getElementById('dbg');
if (DEBUG) dbg.style.display = 'block';

function resize() {
  let s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 1) s = Math.floor(s * 2) / 2;
  const cw = Math.round(W * s), ch = Math.round(H * s), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  setFontSize(s);
}
addEventListener('resize', resize);
resize();

function showTitle() {
  G.state = 'title'; G.player = null; G.boss = null;
  G.cam.x = 0; G.cam.y = 40;
  G.msg = 'CV90'; G.sub = 'SOMETHING CAME THROUGH THE TREES.\nIT WAS NOT THE MOOSE.\nMOUNT UP. HOLD THE FOREST.\n\nCLICK OR PRESS Z';
  G.ctl = 'W/S  DRIVE   A/D  STEER   MOUSE  AIM\nLMB / Z  CANNON   RMB / X  MACHINE GUN   C  SMOKE';
}
function startGame() {
  G.score = 0; G.stage = 1;
  G.player = E.newPlayer(); E.startIntro(G.player);
  G.enemies.length = 0; G.parts.length = 0; G.pickups.length = 0; G.timers.length = 0; G.smokes.length = 0;
  E.clearBullets(G.eb, false); E.clearBullets(G.pb, false);
  G.boss = null; G.shake = 0; G.chroma = 0; G.flash = 0;
  resetLevel();
  { const m = location.search.match(/obj=(\d)/); if (m) { G.timers.length = 0; G.mission = { idx: +m[1] - 1, done: true }; after(60, nextObjective); } }
  if (location.search.includes('boss')) { G.timers.length = 0; G.mission = { idx: 3, kind: 'boss', t: 0, done: false, text: 'DESTROY THE T-90', marker: 'target' }; after(30, () => { spawnBoss(G.player.x, G.player.y - 300); if (location.search.includes('weak')) G.boss.hp = 3; }); }
  G.msg = ''; G.sub = ''; G.ctl = '';
  G.state = 'play';
  audio.start();
}
showTitle();

let lastStage = 0;
function update() {
  input.update();
  if (AUTO) {
    if (G.state === 'title' && G.time > 10) { input.anyKey = true; startGame(); }
    if (G.state === 'play' && G.player) {
      const m = G.mission, p = G.player;
      let steer = Math.sin(G.time * 0.01) * 0.8;
      if (m && m.x !== undefined) { const d = Math.atan2(Math.sin(Math.atan2(m.y - p.y, m.x - p.x) - p.rot), Math.cos(Math.atan2(m.y - p.y, m.x - p.x) - p.rot)); steer = Math.max(-1, Math.min(1, d * 3)); if (m.kind === 'hold' && Math.hypot(m.x - p.x, m.y - p.y) < 60) steer = 1; }
      input.drive = 1; input.steer = steer; input.turret = Math.sin(G.time * 0.03);
      input.fire = m && m.x !== undefined && m.kind !== 'hold' && Math.hypot(m.x - p.x, m.y - p.y) > 200 ? (G.time % 120 < 10 ? 1 : 0) : 1; input.mg = G.time % 200 < 100 ? 1 : 0; if (G.time % 900 === 0) input.smoke = 1;
    }
    if (G.time % 600 === 0 && G.state === 'play') G.levelT += 20;
  }
  G.god = GOD;
  if (input.anyKey) audio.init();
  G.time++;
  { // threat level for the score
    let th = 0.12;
    if (G.state === 'play' && G.player) {
      const p = G.player, m = G.mission;
      let near = 0; for (const e of G.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 420) near += e.type === 'inf' ? 0.5 : 1;
      th = 0.25 + Math.min(0.45, near * 0.08);
      if (m && m.kind === 'hold' && !m.done) th = Math.max(th, 0.55 + 0.25 * (m.hold / m.need));
      if (G.boss && !G.boss.dying) th = 0.9 + 0.1 * (1 - G.boss.hp / G.boss.maxhp);
      if (p.hp < p.maxhp * 0.3) th = Math.min(1, th + 0.15);
    } else if (G.state === 'gameover') th = 0.3;
    audio.music(th);
  }
  if (G.state === 'title') {
    if (input.pressed('fire') || input.pressed('start')) startGame();
    E.updateParticles();
    if (G.time % 40 === 0) E.spawnParticle(-6 + (Math.random() - 0.5) * 8, 28, (Math.random() - 0.5) * 0.3, -0.3, 60, 'smoke', 1.2, 0.4, 0.4, 0.4, false, { grow: 0.05, fade: 0.3 });
  } else if (G.state === 'play') {
    updateLevel(); updateTimers();
    E.updatePlayer(G.player);
    updateEnemies(); updateBoss();
    E.updateBullets(G.eb); E.updateBullets(G.pb);
    E.updateParticles(); E.updateSmokes(); E.updatePickups();
    collisions();
    const p = G.player;
    if (p) {
      const look = p.dead || p.intro ? 0 : 36;
      const tx = p.x + Math.cos(p.rot) * look * Math.min(1, Math.abs(p.v)), ty = p.y + Math.sin(p.rot) * look * Math.min(1, Math.abs(p.v));
      G.cam.x += (tx - G.cam.x) * 0.08; G.cam.y += (ty - G.cam.y) * 0.08;
      audio.engine(Math.abs(p.v) / 2.4, !p.dead);
    }
    if (G.state === 'gameover') { G.msg = 'GAME OVER'; G.sub += '\n\nPRESS Z TO RETRY'; G.gameoverT = 0; audio.engine(0, false); }
  } else {
    G.gameoverT++;
    updateTimers(); updateEnemies(); updateBoss(); E.updateBullets(G.eb); E.updateParticles(); E.updateSmokes();
    if (G.gameoverT > 40 && (input.pressed('fire') || input.pressed('start'))) startGame();
  }
  if (DEBUG && G.stage !== lastStage) { console.log(`stage ${G.stage} time ${G.time} levelT ${G.levelT.toFixed(1)} boss ${!!G.boss} score ${G.score}`); lastStage = G.stage; }
  G.shake *= 0.86; G.chroma *= 0.93; G.flash *= 0.85;
}

const Q = Math.PI / 2;
function drawVehicle(hull, tur, x, y, rot, trot, flash, s = 1, a = 1) {
  const fh = F[hull], ft = tur && F[tur];
  R.sprite(fh, x + 4 * s, y + 6 * s, rot + Q, s, 0, 0, 0, 0.35, 1);
  R.sprite(fh, x, y, rot + Q, s, 1, 1, 1, a);
  if (ft) R.sprite(ft, x, y, trot + Q, s, 1, 1, 1, a);
  if (flash) { const fa = Math.min(0.45, 0.08 * flash); R.sprite(fh, x, y, rot + Q, s, 1, 1, 1, fa, 1); if (ft) R.sprite(ft, x, y, trot + Q, s, 1, 1, 1, fa, 1); }
}
function drawEnemy(e) {
  const d = e.def;
  if (d.air) {
    R.sprite(F.hind, e.x + 16, e.y + 22, e.rot + Q, 1, 0, 0, 0, 0.3, 1);
    R.sprite(F.rotorblur, e.x + 16 - Math.cos(e.rot) * 4, e.y + 22 - Math.sin(e.rot) * 4, e.rotor, 1, 0, 0, 0, 0.25, 1);
    R.sprite(F.hind, e.x, e.y, e.rot + Q);
    const hx = e.x - Math.cos(e.rot) * 5, hy = e.y - Math.sin(e.rot) * 5;
    R.sprite(F.rotorblur, hx, hy, e.rotor);
    R.sprite(F.rotor, hx, hy, e.rotor, 1, 1, 1, 1, 0.55);
    if (e.flash) R.sprite(F.hind, e.x, e.y, e.rot + Q, 1, 1, 1, 1, Math.min(0.8, 0.15 * e.flash), 1);
  } else if (e.type === 'inf') {
    R.sprite(F.inf, e.x + 1.5, e.y + 2, e.rot + Q, 1, 0, 0, 0, 0.3, 1);
    R.sprite(F.inf, e.x, e.y, e.rot + Q);
    if (e.flash) R.sprite(F.inf, e.x, e.y, e.rot + Q, 1, 1, 1, 1, 0.5, 1);
  } else drawVehicle(d.hull, d.turret, e.x, e.y, e.rot, d.static ? e.rot : e.trot, e.flash);
}
function render() {
  const t = G.time / 60;
  const cx = Math.round(G.cam.x - W / 2), cy = Math.round(G.cam.y - H / 2);
  R.setCamera(cx, cy);
  R.beginFrame();
  R.drawGround(t);
  for (const p of G.parts) if (p.ground) R.sprite(F[p.frame], p.x, p.y, p.rot, p.sx, p.r, p.g, p.b, p.fade * Math.min(1, (1 - p.t / p.life) * 4));
  drawTrees(R, cx, cy, true);
  for (const k of G.pickups) R.sprite(F[k.type], k.x, k.y, 0, 1 + 0.1 * Math.sin(k.t * 0.2));
  for (const e of G.enemies) if (!e.def.air) drawEnemy(e);
  const b = G.boss;
  if (b) drawVehicle('t90_hull', 't90_turret', b.x, b.y, b.rot, b.trot, b.flash);
  const p = G.player;
  if (G.state === 'title') {
    const s = E.SHOW.scale;
    drawVehicle('cv90_hull', 'cv90_turret', E.SHOW.x, E.SHOW.y, -Q, -Q + Math.sin(t * 0.7) * 0.25, 0, s);
  }
  if (p && !p.dead && G.state === 'play') {
    const a = p.inv > 0 && !p.intro && (p.inv % 8 < 4) ? 0.5 : 1;
    drawVehicle('cv90_hull', 'cv90_turret', p.x, p.y, p.rot, p.trot, 0, p.scale, a);
  }
  for (const q of G.parts) if (!q.add && !q.ground) R.sprite(F[q.frame], q.x, q.y, q.rot, q.sx, q.r, q.g, q.b, q.fade * (1 - q.t / q.life));
  drawTrees(R, cx, cy, false, p && !p.dead ? p.x : 1e9, p && !p.dead ? p.y : 1e9);
  for (const e of G.enemies) if (e.def.air) drawEnemy(e);
  R.setAdditive(true);
  if (G.state === 'play') drawObjective(R, cx, cy, t);
  for (const k of G.pb) R.sprite(F[k.frame], k.x, k.y, k.rot, k.sx, k.r, k.g, k.b, 0.9);
  for (const k of G.eb) R.sprite(F[k.frame], k.x, k.y, k.rot, k.sx, k.r, k.g, k.b, 1);
  for (const q of G.parts) if (q.add) R.sprite(F[q.frame], q.x, q.y, q.rot, q.sx, q.r, q.g, q.b, q.fade * (1 - q.t / q.life));
  if (input.mouse && G.state === 'play' && p && !p.dead) { R.sprite(F.ring, input.mx + cx, input.my + cy, t * 2, 0.45, 1, 0.9, 0.3, 0.8); R.sprite(F.spark, input.mx + cx, input.my + cy, 0, 1, 1, 0.9, 0.3, 0.9); }
  R.setAdditive(false);
  for (const s of G.smokes) {
    const k = s.t / s.life, a = k < 0.1 ? k * 10 : k > 0.7 ? (1 - k) / 0.3 : 1;
    R.sprite(F.cloud, s.x, s.y, s.rot, s.r / 12, 0.62, 0.63, 0.6, 0.75 * a);
    R.sprite(F.cloud, s.x + 4, s.y - 3, -s.rot * 1.3, s.r / 14, 0.72, 0.72, 0.7, 0.55 * a);
  }
  R.endFrame({
    time: t, shakeX: (Math.random() - 0.5) * G.shake, shakeY: (Math.random() - 0.5) * G.shake,
    chroma: Math.min(2, G.chroma), flash: Math.min(1, G.flash),
  }, canvas.width, canvas.height);
}

let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0;
const DT = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  let steps = 0;
  while (acc >= DT && steps < 4) { update(); acc -= DT; steps++; }
  if (acc >= DT) acc = 0;
  render();
  updateHUD();
  if (DEBUG) { fpsN++; if (now - fpsT > 500) { fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsT = now; fpsN = 0; } dbg.textContent = `obj ${G.mission ? G.mission.kind : '-'} fps ${fps} eb ${G.eb.length} pb ${G.pb.length} parts ${G.parts.length} en ${G.enemies.length} smk ${G.smokes.length} t ${G.levelT.toFixed(1)}`; }
  requestAnimationFrame(frame);
}
{ const m = location.search.match(/skip=(\d+)/); if (m) for (let i = 0; i < +m[1]; i++) update(); }
requestAnimationFrame(frame);
