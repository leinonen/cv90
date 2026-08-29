export const W = 480, H = 360;

export const G = {
  state: 'title',      // title | play | gameover
  time: 0,
  cam: { x: 0, y: 0 },
  score: 0,
  hi: +(localStorage.getItem('cv90_hi') || 0),
  stage: 1,
  shake: 0, chroma: 0, flash: 0,
  player: null,
  enemies: [], eb: [], pb: [], parts: [], smokes: [], pickups: [], timers: [],
  boss: null,
  levelT: 0, clearT: 0, mission: null, obj: '',
  msg: '', sub: '', ctl: '', toast: '', toastT: 0,
};

export const dif = () => G.stage - 1;
export const spd = () => 1 + 0.1 * dif();
export const rate = () => 1 / (1 + 0.12 * dif());
export const hpMul = () => 1 + 0.25 * dif();

export function addScore(n) {
  G.score += n;
  if (G.score > G.hi) { G.hi = G.score; localStorage.setItem('cv90_hi', G.hi); }
}
export function after(frames, fn) { G.timers.push({ t: frames, fn }); }
export function updateTimers() {
  for (let i = G.timers.length - 1; i >= 0; i--) {
    const t = G.timers[i];
    if (--t.t <= 0) { G.timers[i] = G.timers[G.timers.length - 1]; G.timers.pop(); t.fn(); }
  }
}
