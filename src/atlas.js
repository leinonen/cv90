// Procedural sprite atlas. Vehicles are drawn as anti-aliased top-down vector art at SS×
// resolution and mip-mapped; trees stay 1:1 pixel art. All vehicle art faces UP (−y);
// draw with rot = worldAngle + PI/2.
const SS = 4;

export function buildAtlas() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const frames = {};
  let cx = 0, cy = 0, rowH = 0;

  function add(name, w, h, draw, scale = 1) {
    const pw = Math.ceil(w * scale), ph = Math.ceil(h * scale);
    if (cx + pw + 2 > S) { cx = 0; cy += rowH + 2; rowH = 0; }
    const ox = cx, oy = cy;
    g.save();
    g.translate(ox, oy); g.scale(scale, scale);
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    draw({
      w, h,
      px: (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); },
      rect: (x, y, rw, rh, col) => { g.fillStyle = col; g.fillRect(x, y, rw, rh); },
    });
    g.restore();
    frames[name] = { w, h, u0: ox / S, v0: oy / S, u1: (ox + pw) / S, v1: (oy + ph) / S };
    cx += pw + 2; rowH = Math.max(rowH, ph);
  }

  // ---- vector helpers ---------------------------------------------------
  function poly(pts, fill, stroke, lw = 0.45) {
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
  }
  const mir = (pts, cx) => [...pts, ...pts.slice().reverse().map(([x, y]) => [2 * cx - x, y])];
  function grad(x0, x1, stops) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    stops.forEach(([p, col]) => gr.addColorStop(p, col));
    return gr;
  }
  function radial(x, y, r, stops) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(([p, col]) => gr.addColorStop(p, col));
    return gr;
  }
  function ellipse(x, y, rx, ry, fill, stroke, lw = 0.4) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function line(x0, y0, x1, y1, col, lw = 0.5) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'butt'; g.stroke();
  }
  function rrect(x, y, w, h, r, fill, stroke, lw = 0.4) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  // deterministic pseudo-random for camo
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // Splinter / blotch camo painted inside the current clip.
  function camo(x, y, w, h, cols, n = 9, splinter = true) {
    for (let i = 0; i < n; i++) {
      const px = x + rnd() * w, py = y + rnd() * h, r = 2 + rnd() * 4;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      if (splinter) { const k = 3 + (rnd() * 3 | 0); for (let j = 0; j < k; j++) { const a = j / k * Math.PI * 2 + rnd(); g.lineTo(px + Math.cos(a) * r * (0.6 + rnd() * 0.8), py + Math.sin(a) * r * (0.6 + rnd() * 0.8)); } }
      else g.ellipse(px, py, r, r * (0.5 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2);
      g.closePath(); g.fill();
    }
  }

  // Palettes
  const SWE = { base: '#5d7d3c', cam: ['#35542a', '#22261f', '#8a9658'], edge: '#0f140c', track: '#2a2c28', splinter: true, mark: 'swe' };
  const RUS = { base: '#6d6a3e', cam: ['#4b5a30', '#3a3a2a'], edge: '#1a1a10', track: '#2c2a24', splinter: false, mark: 'rus' };
  const RUS2 = { base: '#5d6a3a', cam: ['#7a6a3c', '#3a4a2a'], edge: '#1a1a10', track: '#2c2a24', splinter: false, mark: 'rus' };
  const T90 = { base: '#5a5a48', cam: ['#3c4a30', '#2a2a22', '#7a7458'], edge: '#101010', track: '#26261f', splinter: false, mark: 'rus' };

  // Generic tracked hull. Sprite w×h; hull faces up. o: {pal, trackW, hull(pts right half), wheels, glacis, hatches, extras(fn)}
  function tracked(d, o) {
    const w = d.w, h = d.h, cx = w / 2, p = o.pal, tw = o.trackW || 4, tt = o.trackTop || 2;
    const gl = o.glacis || 5, dk = o.deck || 7;
    // tracks with idler (front) and drive sprocket (rear)
    for (const tx of [1, w - 1 - tw]) {
      rrect(tx, tt, tw, h - tt - 1.5, 1.2, p.track, p.edge, 0.5);
      for (let y = tt + 1.5; y < h - 2.5; y += 2) line(tx + 0.5, y, tx + tw - 0.5, y, 'rgba(0,0,0,0.45)', 0.5);
      line(tx + tw / 2, tt + 1, tx + tw / 2, h - 2.5, 'rgba(255,255,255,0.12)', 0.6);
      ellipse(tx + tw / 2, tt + tw / 2 + 0.5, tw * 0.38, tw * 0.38, '#4a4c46', '#111', 0.3);
      ellipse(tx + tw / 2, h - tw / 2 - 2, tw * 0.42, tw * 0.42, '#3a3c36', '#111', 0.3);
      ellipse(tx + tw / 2, h - tw / 2 - 2, tw * 0.15, tw * 0.15, '#6a6c66', null);
    }
    // hull body with camo
    g.save();
    const hull = mir(o.hull, cx);
    g.beginPath(); hull.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
    g.fillStyle = grad(tw, w - tw, [[0, p.base], [0.5, lighten(p.base, 0.12)], [1, darken(p.base, 0.15)]]); g.fillRect(0, 0, w, h);
    camo(tw, 0, w - 2 * tw, h, p.cam, o.camoN || 10, p.splinter);
    // FRONT: sloped glacis catches the light; crease line where it meets the roof
    const gg = g.createLinearGradient(0, 0, 0, gl + 2);
    gg.addColorStop(0, 'rgba(255,255,255,0.42)'); gg.addColorStop(1, 'rgba(255,255,255,0.08)');
    g.fillStyle = gg; g.fillRect(tw, 0, w - 2 * tw, gl + 2);
    line(tw + 0.5, gl + 2, w - tw - 0.5, gl + 2, 'rgba(0,0,0,0.5)', 0.5);
    // REAR: engine deck grille + rear door, in shadow
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(tw, h - dk, w - 2 * tw, dk);
    for (let y = h - dk + 1.2; y < h - 3; y += 1.3) line(tw + 1.2, y, w - tw - 1.2, y, 'rgba(0,0,0,0.45)', 0.5);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - (w - 2 * tw) * 0.28, h - 3, (w - 2 * tw) * 0.56, 2.2);
    line(cx - (w - 2 * tw) * 0.28, h - 3, cx - (w - 2 * tw) * 0.28, h - 0.8, 'rgba(255,255,255,0.15)', 0.4);
    line(cx + (w - 2 * tw) * 0.28, h - 3, cx + (w - 2 * tw) * 0.28, h - 0.8, 'rgba(255,255,255,0.15)', 0.4);
    g.restore();
    poly(hull, null, p.edge, 0.5);
    // headlights front, exhaust stubs + tow hooks rear (outside clip so they can sit on the edge)
    for (const sx of [tw + 1.6, w - tw - 1.6]) { ellipse(sx, 1.6, 0.9, 0.7, '#f2f0d0', '#222', 0.3); }
    for (const sx of [tw + 1.2, w - tw - 1.2]) { rrect(sx - 0.8, h - 2.4, 1.6, 1.6, 0.3, '#2a2a26', '#000', 0.3); }
    rrect(w - tw - 3.2, h - dk - 1.5, 1.6, 3, 0.4, '#1c1c1a', '#000', 0.3); // exhaust
    if (o.hatches) for (const [hx, hy, hr] of o.hatches) ellipse(hx, hy, hr, hr, darken(p.base, 0.2), p.edge, 0.35);
    if (o.extras) o.extras();
  }
  // Turret sprite: ring centre at sprite centre; barrel points up. o: {pal, r(ring radius), body(pts right half rel. centre), barrel:[len, width], mantlet, coax}
  function turret(d, o) {
    const cx = d.w / 2, cy = d.h / 2, p = o.pal;
    const [bl, bw] = o.barrel;
    // barrel
    const bx = cx + (o.barrelX || 0);
    rrect(bx - bw / 2, cy - bl, bw, bl, bw / 3, grad(bx - bw / 2, bx + bw / 2, [[0, '#2a2e2a'], [0.4, '#6a706a'], [1, '#1e221e']]), p.edge, 0.35);
    if (o.muzzle) rrect(bx - bw / 2 - 0.4, cy - bl, bw + 0.8, o.muzzle, 0.3, '#1c1e1c', p.edge, 0.3);
    if (o.coax) rrect(bx + o.coax, cy - o.r - 3, 0.9, 4, 0.3, '#333', p.edge, 0.3);
    // body
    g.save();
    const body = mir(o.body.map(([x, y]) => [cx + x, cy + y]), cx);
    g.beginPath(); body.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
    g.fillStyle = radial(cx - 2, cy - 2, o.r * 1.6, [[0, lighten(p.base, 0.22)], [1, darken(p.base, 0.2)]]); g.fillRect(0, 0, d.w, d.h);
    camo(cx - o.r, cy - o.r, o.r * 2, o.r * 2, p.cam, 5, p.splinter);
    g.restore();
    poly(body, null, p.edge, 0.5);
    if (o.mantlet) rrect(bx - o.mantlet / 2, cy - o.r - 1, o.mantlet, 3, 0.6, darken(p.base, 0.3), p.edge, 0.35);
    ellipse(cx + (o.hatchX || 1.5), cy + 1.5, 1.6, 1.6, darken(p.base, 0.15), p.edge, 0.3);
    if (o.extras) o.extras(cx, cy);
  }
  function hex(col) { return [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)); }
  function lighten(col, k) { return 'rgb(' + hex(col).map(v => Math.min(255, v + 255 * k) | 0).join(',') + ')'; }
  function darken(col, k) { return 'rgb(' + hex(col).map(v => Math.max(0, v * (1 - k)) | 0).join(',') + ')'; }

  add('white', 4, 4, d => d.rect(0, 0, 4, 4, '#fff'));
  frames.white.u0 += 1 / S; frames.white.v0 += 1 / S; frames.white.u1 -= 1 / S; frames.white.v1 -= 1 / S;

  // ---- CV90 (Strf 9040) ---------------------------------------------------
  add('cv90_hull', 22, 34, d => tracked(d, { pal: SWE, trackW: 4, glacis: 6, deck: 8,
    hull: [[11, 1], [16, 1.5], [17.5, 5], [17.8, 28], [16.5, 33], [11, 33]],
    hatches: [[6.8, 9.5, 1.5], [6.5, 25, 1.3], [15.5, 25, 1.3]],
    extras: () => { ellipse(6.8, 9.5, 0.9, 0.4, '#9fb8c8', null); } }), SS);
  add('cv90_turret', 14, 44, d => turret(d, { pal: SWE, r: 5.5, barrel: [21, 1.6], muzzle: 2.5, mantlet: 4, coax: 3.2, hatchX: -2,
    body: [[0, -5.5], [4.5, -5], [6, -2], [6, 5], [4, 7], [0, 7]],
    extras: (cx, cy) => { rrect(cx + 3.5, cy - 2, 2, 5, 0.5, '#2a3022', '#111', 0.3); line(cx - 5.5, cy + 4, cx + 5.5, cy + 4, 'rgba(0,0,0,0.3)', 0.4); } }), SS);

  // ---- BMP-2 --------------------------------------------------------------
  add('bmp_hull', 20, 30, d => tracked(d, { pal: RUS, trackW: 3.5, glacis: 7, deck: 6,
    hull: [[10, 0.5], [14, 2], [16, 6], [16.3, 26], [15, 29.5], [10, 29.5]],
    hatches: [[6.5, 10, 1.3], [7, 23, 1.1], [13, 23, 1.1]],
    extras: () => { ellipse(6.5, 10, 0.8, 0.4, '#9fb8c8', null); } }), SS);
  add('bmp_turret', 10, 34, d => turret(d, { pal: RUS, r: 4, barrel: [14, 1.1], mantlet: 3, coax: 2.2,
    body: [[0, -4], [3.5, -3], [4, 3], [2.5, 4.2], [0, 4.5]],
    extras: (cx, cy) => { rrect(cx - 1.5, cy - 9, 3, 6, 0.5, '#3a3a2a', '#111', 0.3); } }), SS); // ATGM launcher on top

  // ---- T-72 ---------------------------------------------------------------
  add('t72_hull', 26, 34, d => tracked(d, { pal: RUS2, trackW: 5, glacis: 7, deck: 9,
    hull: [[13, 1], [18.5, 2], [20.5, 7], [20.8, 28], [19, 33], [13, 33]],
    hatches: [[13, 9.5, 1.5]],
    extras: () => { for (let i = 0; i < 4; i++) rrect(7 + i * 3.5, 24.5, 2.6, 1.6, 0.4, '#2a2a22', '#111', 0.3); } }), SS);
  add('t72_turret', 16, 48, d => turret(d, { pal: RUS2, r: 6.5, barrel: [22, 1.8], muzzle: 3, mantlet: 5, coax: 3.5,
    body: [[0, -6.5], [5.5, -4.5], [6.5, 1], [5, 6], [0, 7]],
    extras: (cx, cy) => { ellipse(cx - 3, cy + 1, 1.4, 1.4, '#3c3c2c', '#111', 0.3); rrect(cx - 0.6, cy - 12, 1.2, 4, 0.3, '#222', null); } }), SS);

  // ---- T-90 (boss) ----------------------------------------------------------
  add('t90_hull', 40, 54, d => tracked(d, { pal: T90, trackW: 7, glacis: 10, deck: 14, camoN: 22,
    hull: [[20, 1], [28, 2], [32, 9], [32.5, 46], [30, 53], [20, 53]],
    hatches: [[20, 13, 2.2]],
    extras: () => { for (let i = 0; i < 6; i++) rrect(10 + i * 3.6, 38, 2.8, 2.2, 0.4, '#2a2a22', '#111', 0.3); for (let i = 0; i < 5; i++) rrect(9 + i * 4.8, 4, 3.4, 1.2, 0.3, '#3a3a30', '#111', 0.25); } }), SS);
  add('t90_turret', 26, 76, d => turret(d, { pal: T90, r: 10.5, barrel: [34, 2.6], muzzle: 4, mantlet: 8, coax: 5.5, hatchX: 4,
    body: [[0, -10.5], [8.5, -7.5], [10.5, 1], [8, 9], [0, 11]],
    extras: (cx, cy) => { ellipse(cx - 4.5, cy + 2, 2.2, 2.2, '#3c3c2c', '#111', 0.3); for (const sx of [-8, 8]) for (let i = 0; i < 3; i++) rrect(cx + sx - 1 + (sx < 0 ? -i * 1.4 : i * 1.4), cy - 8 + i * 1.5, 1.6, 3, 0.4, '#3a3a30', '#111', 0.25); rrect(cx - 3.2, cy - 14, 1.2, 5, 0.3, '#222', null); rrect(cx + 5, cy - 6, 1.6, 1.6, 0.3, '#c33', '#511', 0.3); } }), SS);

  // ---- infantry (top-down, facing up) --------------------------------------
  add('inf', 10, 10, d => {
    ellipse(5, 6.5, 3.2, 1.8, '#4a5a34', '#1a2012', 0.35); // shoulders
    line(5.5, 6, 6.5, 0.5, '#222', 0.9); // RPG tube
    ellipse(6.5, 1, 0.9, 0.9, '#5a4a2a', null);
    ellipse(5, 5.5, 2, 2, radial(4.5, 5, 2.4, [[0, '#7d8a55'], [1, '#3e4a2c']]), '#141a0e', 0.4); // helmet
  }, SS);

  // ---- Mi-24 Hind (facing up) ----------------------------------------------
  add('hind', 26, 46, d => {
    const p = RUS2;
    // tail boom
    rrect(11.7, 20, 2.6, 24, 1, grad(11.7, 14.3, [[0, '#7a7a50'], [1, '#3a3a24']]), p.edge, 0.4);
    poly([[13, 40], [17, 38], [17.5, 44], [13, 44]], '#4a5030', p.edge, 0.4); // tail fin
    ellipse(13, 42.5, 4.5, 0.9, '#2a2a2a', '#111', 0.3); // tail rotor
    // stub wings
    poly(mir([[13, 15], [25, 18.5], [25, 20], [13, 19]], 13), '#4f5a34', p.edge, 0.4);
    for (const x of [4, 8, 18, 22]) rrect(x - 0.8, 15.5, 1.6, 6, 0.6, '#4a4a3a', p.edge, 0.3); // rocket pods
    // fuselage
    g.save();
    const body = mir([[13, 2], [16, 3.5], [17.5, 10], [17, 22], [15, 28], [13, 29]], 13);
    g.beginPath(); body.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
    g.fillStyle = grad(8.5, 17.5, [[0, '#3c4a2a'], [0.45, '#7a8050'], [1, '#2c3020']]); g.fillRect(0, 0, 26, 46);
    camo(9, 4, 8, 24, ['#4a5a30', '#6a5a3a'], 6, false);
    g.restore();
    poly(body, null, p.edge, 0.5);
    ellipse(13, 6, 2.4, 3.5, radial(12, 5, 3.5, [[0, '#cfe8ff'], [1, '#2a4a70']]), '#111', 0.35); // front canopy
    ellipse(13, 12.5, 2.8, 3, radial(12, 11.5, 3, [[0, '#cfe8ff'], [1, '#2a4a70']]), '#111', 0.35); // rear canopy
    for (const sx of [10, 16]) rrect(sx - 1, 14, 2, 8, 0.8, '#5a5a44', p.edge, 0.3); // engine nacelles
    ellipse(13, 18, 2.2, 2.2, '#222', '#000', 0.4); // rotor hub
  }, SS);
  add('rotor', 52, 52, d => {
    g.translate(26, 26);
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i * Math.PI * 2 / 5);
      rrect(-1, -25, 2, 25, 0.8, 'rgba(40,40,36,0.85)', 'rgba(0,0,0,0.5)', 0.3);
      g.restore();
    }
    ellipse(0, 0, 2.5, 2.5, '#333', '#000', 0.4);
  }, SS);
  add('rotorblur', 52, 52, d => { g.fillStyle = radial(26, 26, 26, [[0, 'rgba(60,60,60,0)'], [0.8, 'rgba(70,70,70,0.22)'], [0.95, 'rgba(90,90,90,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 52, 52); }, SS);

  // ---- wrecks --------------------------------------------------------------
  const wreck = (w, h) => d => {
    poly(mir([[w / 2, 1], [w * 0.72, 2], [w * 0.8, h * 0.2], [w * 0.78, h - 3], [w * 0.7, h - 1], [w / 2, h - 1]], w / 2), radial(w / 2, h / 2, w * 0.7, [[0, '#3a3430'], [1, '#141210']]), '#000', 0.5);
    for (let i = 0; i < 6; i++) ellipse(w * 0.3 + rnd() * w * 0.4, 3 + rnd() * (h - 6), 1 + rnd() * 2, 1 + rnd() * 2, 'rgba(0,0,0,0.5)', null);
    for (const tx of [1, w - 4]) rrect(tx, 2, 3, h - 4, 1, '#1c1a18', '#000', 0.4);
  };
  add('wreck_s', 20, 30, wreck(20, 30), SS);
  add('wreck_m', 26, 34, wreck(26, 34), SS);
  add('wreck_l', 40, 54, wreck(40, 54), SS);
  add('wreck_h', 26, 46, d => { // downed hind
    rrect(11.7, 20, 2.6, 24, 1, '#2a2824', '#000', 0.4);
    poly(mir([[13, 2], [16, 3.5], [17.5, 10], [17, 22], [15, 28], [13, 29]], 13), radial(13, 14, 14, [[0, '#3a3430'], [1, '#141210']]), '#000', 0.5);
    for (let i = 0; i < 3; i++) { g.save(); g.translate(13, 18); g.rotate(i * 2.1 + 0.4); rrect(-1, 0, 2, 16 + i * 3, 0.8, '#222', '#000', 0.3); g.restore(); }
  }, SS);

  // ---- bullets & particles (2x, smooth) ----------------------------------
  const B = 2;
  add('orb', 12, 12, () => { g.fillStyle = radial(6, 6, 6, [[0, '#fff'], [0.3, '#fff'], [0.55, 'rgba(255,255,255,0.85)'], [0.8, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, 12, 12); }, B);
  add('ap', 4, 14, () => { g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(2, 7, 2, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(2, 6, 0.8, 5.5, 0, 0, Math.PI * 2); g.fill(); }, B);
  add('tracer', 3, 10, () => { g.fillStyle = radial(1.5, 3, 7, [[0, '#fff'], [0.4, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.ellipse(1.5, 5, 1.5, 5, 0, 0, Math.PI * 2); g.fill(); }, B);
  add('rpg', 5, 12, () => { g.fillStyle = '#ccc'; g.beginPath(); g.ellipse(2.5, 3, 2.2, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#888'; g.fillRect(1.8, 5, 1.4, 7); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0.5, 10, 4, 1.5); }, B);
  add('shell', 6, 14, () => { g.fillStyle = radial(3, 7, 8, [[0, '#fff'], [0.35, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.ellipse(3, 7, 3, 7, 0, 0, Math.PI * 2); g.fill(); }, B);
  add('rocket', 4, 12, () => { g.fillStyle = '#eee'; g.beginPath(); g.moveTo(2, 0); g.lineTo(3.5, 3); g.lineTo(3.2, 10); g.lineTo(0.8, 10); g.lineTo(0.5, 3); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 9, 4, 3); }, B);
  add('spark', 3, 3, () => { g.fillStyle = radial(1.5, 1.5, 1.5, [[0, '#fff'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, 3, 3); }, B);
  add('smoke', 10, 10, () => { g.fillStyle = radial(5, 5, 5, [[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, 10, 10); }, B);
  add('cloud', 24, 24, () => { for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 5 + (i % 3) * 1.5, x = 12 + Math.cos(a) * 5.5, y = 12 + Math.sin(a) * 5.5; g.fillStyle = radial(x, y, r, [[0, 'rgba(255,255,255,0.75)'], [0.6, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } }, B);
  add('ring', 24, 24, () => { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(12, 12, 10, 0, Math.PI * 2); g.stroke(); }, B);
  add('flash', 16, 16, () => { g.translate(8, 8); g.fillStyle = radial(0, 0, 8, [[0, '#fff'], [0.3, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3 : 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }, B);
  add('flame', 8, 12, () => { g.fillStyle = radial(4, 8, 8, [[0, '#fff'], [0.4, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(8, 7, 4, 12); g.quadraticCurveTo(0, 7, 4, 0); g.fill(); }, B);
  add('track', 8, 6, () => { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, 0, 8, 2); g.fillRect(0, 4, 8, 2); }, B);
  add('crater', 20, 20, () => { g.fillStyle = radial(10, 10, 10, [[0, 'rgba(255,255,255,0.8)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, 20, 20); }, B);

  // ---- trees (pixel art) --------------------------------------------------
  const blob = (d, cx, cy, r, cols, seedv) => {
    let s = seedv;
    const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dd = Math.sqrt(dx * dx + dy * dy) / r;
      const n = rr();
      if (dd < 0.55 + n * 0.5) {
        const light = (-dx - dy) / r; // light from top-left
        const i = light > 0.45 && n > 0.3 ? 0 : light < -0.45 || dd > 0.75 ? 2 : n > 0.75 ? 0 : 1;
        d.px(x, y, cols[i]);
      }
    }
  };
  add('pine', 24, 24, d => { blob(d, 12, 12, 10, ['#3f6a2f', '#2b4d22', '#182e14'], 13); d.rect(11, 11, 2, 2, '#2a1a0c'); });
  add('spruce', 24, 24, d => {
    // star-shaped conifer from above
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7 + 0.3; for (let t = 0; t < 10; t++) { const x = 12 + Math.cos(a) * t, y = 12 + Math.sin(a) * t; const w = t < 4 ? 2 : 1; d.rect(Math.floor(x - w / 2), Math.floor(y - w / 2), w + 1, w + 1, t > 7 ? '#1a3417' : (a < 3 ? '#2f5a26' : '#24471d')); } }
    blob(d, 12, 12, 5.5, ['#4a7a35', '#33602a', '#213f1a'], 29); d.rect(11, 11, 2, 2, '#1a2a14');
  });
  add('birch', 24, 24, d => { blob(d, 12, 12, 9, ['#8fb24a', '#6a9236', '#446a24'], 41); d.rect(11, 11, 2, 2, '#e8e8e0'); d.px(11, 13, '#333'); d.px(13, 11, '#333'); });
  add('bush', 14, 14, d => blob(d, 7, 7, 6, ['#6f9a3c', '#4f7a2a', '#35561c'], 57));
  add('stump', 10, 10, d => { blob(d, 5, 5, 4, ['#8a6a3a', '#5a4020', '#3a2a14'], 71); d.px(4, 4, '#c9a86a'); d.px(5, 5, '#c9a86a'); });

  // ---- pickups ------------------------------------------------------------
  const glyph = (d, rows, col) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '1') d.px(x + 3, y + 3, col); }));
  add('repair', 12, 12, d => { d.rect(0, 0, 12, 12, '#e8e6d8'); d.rect(1, 1, 10, 10, '#c9c7b8'); glyph(d, ['00100', '00100', '11111', '00100', '00100', '00000'], '#d0302a'); });
  add('smokep', 12, 12, d => { d.rect(0, 0, 12, 12, '#8ea9c4'); d.rect(1, 1, 10, 10, '#5a7a94'); glyph(d, ['01110', '10000', '01110', '00001', '11110', '00000'], '#fff'); });
  add('life', 12, 12, d => { d.rect(2, 2, 8, 8, '#4b6b33'); d.rect(1, 2, 1, 8, '#2a2c28'); d.rect(10, 2, 1, 8, '#2a2c28'); d.rect(5, 4, 2, 2, '#2e4a22'); d.rect(5, 0, 2, 5, '#6d7a45'); });

  return { canvas: c, frames };
}
