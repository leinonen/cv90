import { G } from './state.js';
const $ = id => document.getElementById(id);
const el = { score: $('score'), hi: $('hi'), lives: $('lives'), smoke: $('smoke'), stage: $('stage_n'), msg: $('msg'), sub: $('sub'), ctl: $('ctl') };
const bossbar = $('bossbar'), bossfill = $('bossfill'), hpfill = $('hpfill'), heatfill = $('heatfill');
const last = {};
function set(k, v) { if (last[k] !== v) { last[k] = v; el[k].textContent = v; } }
function width(k, node, w) { if (last[k] !== w) { last[k] = w; node.style.width = w; } }

export function setFontSize(scale) { $('stage').style.setProperty('--fs', Math.max(6, Math.round(6 * scale)) + 'px'); }
export function updateHUD() {
  const p = G.player;
  set('score', String(G.score).padStart(7, '0'));
  set('hi', String(G.hi).padStart(7, '0'));
  set('stage', G.stage);
  set('lives', p ? 'TANK ' + Math.max(0, p.lives) : '');
  set('smoke', p ? 'SMK ' + p.smoke : '');
  set('msg', G.msg); set('sub', G.sub); set('ctl', G.ctl);
  width('hp', hpfill, p ? Math.max(0, p.hp / p.maxhp * 100).toFixed(0) + '%' : '0%');
  width('heat', heatfill, p ? Math.min(100, p.mgHeat).toFixed(0) + '%' : '0%');
  const jam = p && p.jam > 0;
  if (last.jam !== jam) { last.jam = jam; heatfill.style.background = jam ? '#ff3030' : ''; }
  const b = G.boss;
  const show = b && !b.dying ? 'block' : 'none';
  if (last.bossShow !== show) { last.bossShow = show; bossbar.style.display = show; }
  if (b) width('bw', bossfill, Math.max(0, b.hp / b.maxhp * 100).toFixed(1) + '%');
}
