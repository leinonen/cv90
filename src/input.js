import { W, H } from './state.js';
const map = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'tl', ArrowRight: 'tr', KeyQ: 'tl', KeyE: 'tr',
  KeyZ: 'fire', Space: 'fire', KeyJ: 'fire', KeyX: 'mg', KeyK: 'mg', KeyC: 'smoke', KeyL: 'smoke', Enter: 'start', KeyP: 'pause',
};
const NAMES = ['up', 'down', 'left', 'right', 'tl', 'tr', 'fire', 'mg', 'smoke', 'start', 'pause'];
const keys = {}, cur = {}, prev = {}, mb = {};
export const input = {
  up: 0, down: 0, left: 0, right: 0, tl: 0, tr: 0, fire: 0, mg: 0, smoke: 0, start: 0, pause: 0,
  drive: 0, steer: 0, turret: 0,
  mx: 0, my: 0, mouse: false, // logical canvas coords; mouse=true once the mouse has been used
  anyKey: false,
  update() {
    Object.assign(prev, cur);
    for (const name of NAMES) cur[name] = keys[name] ? 1 : 0;
    if (mb[0]) cur.fire = 1;
    if (mb[2]) cur.mg = 1;
    let drive = 0, steer = 0, turret = 0;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) {
      const dz = v => Math.abs(v) > 0.2 ? v : 0;
      steer = dz(gp.axes[0]); drive = -dz(gp.axes[1]); turret = dz(gp.axes[2]);
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      if (b(14)) steer = -1; if (b(15)) steer = 1; if (b(12)) drive = 1; if (b(13)) drive = -1;
      if (b(0) || b(7)) cur.fire = 1;
      if (b(2) || b(5)) cur.mg = 1;
      if (b(1) || b(4)) cur.smoke = 1;
      if (b(9)) cur.start = 1;
    }
    for (const k in cur) this[k] = cur[k];
    this.drive = drive || (cur.up - cur.down);
    this.steer = steer || (cur.right - cur.left);
    this.turret = turret || (cur.tr - cur.tl);
  },
  pressed(name) { return cur[name] && !prev[name]; },
};
window.addEventListener('keydown', e => {
  const k = map[e.code];
  input.anyKey = true;
  if (k) { keys[k] = true; e.preventDefault(); }
});
window.addEventListener('keyup', e => { const k = map[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in mb) mb[k] = false; });
const canvas = document.getElementById('c');
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { mb[e.button] = true; input.mouse = true; input.anyKey = true; e.preventDefault(); });
window.addEventListener('mouseup', e => { mb[e.button] = false; });
window.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  input.mx = (e.clientX - r.left) / r.width * W; input.my = (e.clientY - r.top) / r.height * H;
  input.mouse = true;
});
