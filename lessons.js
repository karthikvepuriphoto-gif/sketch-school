// Sketch School lesson data. All coordinates are in a 1000 x 750 board.
// A stroke is {t: tool, g: pencil grade, p: [[x,y,pressure],...], clip: [{d, rule}]}.
// tools: 'pencil' (graphite), 'smudge' (blending stump), 'lift' (kneaded eraser), 'ink' (clean guide line)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const S = (t, g, p, clip) => ({ t, g, p, clip });

function line(x1, y1, x2, y2, p = .3, g = 'HB', n) {
  n = n || Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 6));
  const a = [];
  for (let i = 0; i <= n; i++) { const t = i / n; a.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, typeof p === 'function' ? p(t) : p]); }
  return S('pencil', g, a);
}
function ell(cx, cy, rx, ry, p = .3, g = 'HB', a0 = 0, a1 = TAU, rot = 0) {
  const n = Math.max(12, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry) / 6)), a = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (a1 - a0) * i / n, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    a.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), typeof p === 'function' ? p(i / n) : p]);
  }
  return S('pencil', g, a);
}
function ellD(cx, cy, rx, ry) { return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`; }
function polyD(pts) { return 'M' + pts.map(p => p.join(',')).join(' L') + ' Z'; }
function poly(pts, p = .3, g = 'HB', close = true) {
  const out = []; const q = close ? [...pts, pts[0]] : pts;
  for (let i = 0; i < q.length - 1; i++) { const s = line(q[i][0], q[i][1], q[i + 1][0], q[i + 1][1], p, g).p; out.push(...(i ? s.slice(1) : s)); }
  return S('pencil', g, out);
}
// cubic bezier path: start [x,y], then segments [c1x,c1y,c2x,c2y,x,y]
function bez(start, segs) {
  let d = `M${start[0]},${start[1]}`, pts = [start], cur = start;
  for (const s of segs) {
    d += ` C${s.slice(0, 6).join(',')}`;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      pts.push([u * u * u * cur[0] + 3 * u * u * t * s[0] + 3 * u * t * t * s[2] + t * t * t * s[4], u * u * u * cur[1] + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5]]);
    }
    cur = [s[4], s[5]];
  }
  return { d: d + ' Z', pts };
}
const trace = (pts, p = .3, g = 'HB') => S('pencil', g, pts.map((q, i) => [q[0], q[1], typeof p === 'function' ? p(i / (pts.length - 1)) : p]));

// Hatching across a box at an angle; pressure comes from dark(x,y) (0..1)
function hatch(box, angle, gap, dark, g = 'HB', clip, jitter = 1.5) {
  const [x0, y0, x1, y1] = box, dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  const cs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  const os = cs.map(c => c[0] * nx + c[1] * ny), ts = cs.map(c => c[0] * dx + c[1] * dy);
  const omin = Math.min(...os), omax = Math.max(...os), tmin = Math.min(...ts), tmax = Math.max(...ts);
  const out = []; let flip = false;
  for (let o = omin + gap / 2; o < omax; o += gap) {
    let cur = [], seq = [];
    for (let t = tmin; t <= tmax; t += 6) seq.push(t);
    if (flip) seq.reverse(); flip = !flip;
    const oj = o + (rnd() - .5) * jitter;
    for (const t of seq) {
      const x = nx * oj + dx * t, y = ny * oj + dy * t;
      if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) { if (cur.length > 1) out.push(S('pencil', g, cur, clip)); cur = []; continue; }
      const v = dark(x, y);
      if (v < .04) { if (cur.length > 1) out.push(S('pencil', g, cur, clip)); cur = []; continue; }
      cur.push([x, y, clamp(v)]);
    }
    if (cur.length > 1) out.push(S('pencil', g, cur, clip));
  }
  return out;
}
// circular blending-stump scribbles over a box
function smudge(box, clip, r = 18, step = 30) {
  const [x0, y0, x1, y1] = box, out = [];
  for (let y = y0 + step / 2; y < y1; y += step) {
    const a = [];
    for (let x = x0; x <= x1; x += 4) { const t = x / r; a.push([x + Math.cos(t) * r * .6, y + Math.sin(t) * r * .6, .6]); }
    out.push(S('smudge', '', a, clip));
  }
  return out;
}
function lift(cx, cy, r, p = .8) { const a = []; for (let i = 0; i <= 30; i++) { const t = i / 30 * TAU * 2; a.push([cx + Math.cos(t) * r * (i / 30), cy + Math.sin(t) * r * (i / 30), p]); } return S('lift', '', a); }
function stipple(box, dark, n, g = '2B', clip) { const [x0, y0, x1, y1] = box, out = []; for (let i = 0; i < n; i++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), v = dark(x, y); if (rnd() < v) out.push(S('pencil', g, [[x, y, .7]], clip)); } return out; }
function scribble(cx, cy, rx, ry, loops, p, g = 'HB', clip) { const a = []; for (let i = 0; i <= loops * 20; i++) { const t = i / 20 * TAU, k = i / (loops * 20); a.push([cx - rx + 2 * rx * k + Math.cos(t) * 14, cy + Math.sin(t) * 14 + Math.sin(k * 9) * ry, typeof p === 'function' ? p(k) : p]); } return S('pencil', g, a, clip); }

// Lighting: sphere with light from upper left
const L = (() => { const v = [-.55, -.62, .56], m = Math.hypot(...v); return v.map(c => c / m); })();
function sphereDark(cx, cy, r, scale = 1) {
  return (x, y) => {
    const nx = (x - cx) / r, ny = (y - cy) / r, q = nx * nx + ny * ny; if (q > 1) return 0;
    const d = nx * L[0] + ny * L[1] + Math.sqrt(1 - q) * L[2];
    let v;
    if (d > .9) v = 0;                                  // highlight
    else if (d > 0) v = (1 - d / .9) * .55;             // light to mid-tone
    else if (d > -.35) v = .55 + (-d / .35) * .4;       // core shadow
    else v = .95 - ((-d - .35) / .65) * .45;            // reflected light
    return v * scale;
  };
}
const castDark = (cx, cy, rx, ry, contactX) => (x, y) => { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (q > 1) return 0; return clamp(.95 - Math.abs(x - contactX) / (rx * 2.2)) * (1 - q * .4); };
const P = (fn, lo, hi) => (x, y) => { const v = fn(x, y); return v < lo ? 0 : clamp((v - lo) / (hi - lo)) * hi; };

// ---------- lesson builders ----------
function sphereLesson() {
  const cx = 470, cy = 350, r = 170, clip = [{ d: ellD(cx, cy, r, r) }], dk = sphereDark(cx, cy, r), box = [cx - r, cy - r, cx + r, cy + r];
  const castC = [cx + 120, cy + r - 5, 230, 42], cclip = [{ d: ellD(...castC) }, { d: `M0,0 H1000 V750 H0 Z ${ellD(cx, cy, r, r)}`, rule: 'evenodd' }];
  return [
    { title: 'Draw a light circle', say: 'Barely touch the paper. Light lines are easy to fix later.', strokes: [ell(cx, cy, r, r, .22, '2H', -2.2, -2.2 + TAU)] },
    { title: 'Pick your light source', say: 'Decide where the light comes from before you shade. Here it is the top left.', labels: [{ x: 130, y: 90, t: '☀️ Light source' }], strokes: [ell(130, 120, 28, 28, .3, 'HB'), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i / 8 * TAU; return line(130 + Math.cos(a) * 40, 120 + Math.sin(a) * 40, 130 + Math.cos(a) * 60, 120 + Math.sin(a) * 60, .3); }), line(185, 165, 300, 230, .15, '2H')] },
    { title: 'Mid-tones with HB', say: 'Light, even pressure. Shade everywhere except the bright spot.', labels: [{ x: 480, y: 330, t: 'Mid-tone' }], strokes: hatch(box, .8, 7, (x, y) => Math.min(.5, dk(x, y)) * .9, 'HB', clip) },
    { title: 'Core shadow with 2B', say: 'Press harder for the core shadow, the darkest band on the ball.', labels: [{ x: 560, y: 460, t: 'Core shadow' }], strokes: hatch(box, -.7, 8, P(dk, .6, .95), '2B', clip) },
    { title: 'Cast shadow', say: 'The ball blocks the light, so a shadow falls on the table. It is darkest right where the ball touches.', labels: [{ x: 640, y: 560, t: 'Cast shadow' }], strokes: [...hatch([castC[0] - castC[2], castC[1] - castC[3], castC[0] + castC[2], castC[1] + castC[3]], .3, 6, castDark(...castC, cx + 40), '2B', cclip), ...hatch([cx - 90, cy + r - 40, cx + 190, cy + r + 30], 0, 4, (x, y) => clamp(.95 - Math.hypot((x - cx - 40) / 150, (y - cy - r + 4) / 22)), '6B', cclip)] },
    { title: 'Blend with a stump', say: 'Rub in small circles that follow the round shape. Keep the reflected light a little lighter.', labels: [{ x: 600, y: 500, t: 'Reflected light' }], strokes: smudge(box, clip, 16, 26) },
    { title: 'Lift the highlight', say: 'Press a kneaded eraser on the bright spot to lift graphite off. Now it looks round!', labels: [{ x: 330, y: 220, t: '✨ Highlight' }], strokes: [lift(cx - 75, cy - 85, 30), lift(cx - 75, cy - 85, 18)] },
  ];
}
function cubeLesson() {
  const top = [[330, 260], [520, 200], [700, 250], [510, 320]], left = [[330, 260], [510, 320], [510, 560], [330, 490]], right = [[510, 320], [700, 250], [700, 480], [510, 560]];
  const cast = [[700, 250], [880, 330], [880, 520], [700, 480], [510, 560], [560, 580]];
  const f = (pts, v, g, a, gap = 7) => hatch([300, 180, 720, 580], a, gap, () => v, g, [{ d: polyD(pts) }]);
  return [
    { title: 'Start with a square idea', say: 'Sketch the box lightly with a 2H. Edges going back get shorter.', strokes: [poly(top, .25, '2H'), poly(left, .25, '2H'), poly(right, .25, '2H')] },
    { title: 'Light on top', say: 'Light comes from the top left, so the top is the lightest face. Barely touch the paper.', labels: [{ x: 470, y: 240, t: 'Lightest' }], strokes: f(top, .18, '2H', .3, 9) },
    { title: 'Medium on the left', say: 'Medium pressure with HB on the front face.', labels: [{ x: 360, y: 400, t: 'Medium' }], strokes: [...f(left, .45, 'HB', 1.2), ...f(left, .3, 'HB', -.4)] },
    { title: 'Dark side', say: 'Press harder with a 2B for the side facing away from the light.', labels: [{ x: 560, y: 400, t: 'Darkest face' }], strokes: [...f(right, .75, '2B', .9), ...f(right, .7, '2B', -.5, 8)] },
    { title: 'Cast shadow', say: 'The shadow stretches away from the light. Darkest near the box.', labels: [{ x: 760, y: 470, t: 'Cast shadow' }], strokes: hatch([500, 240, 900, 600], .15, 6, (x) => clamp(.95 - (x - 700) / 300) * .9, '6B', [{ d: polyD(cast) }]) },
    { title: 'Crisp edges', say: 'Blend each face, then sharpen the edges so the box looks solid.', strokes: [...smudge([320, 190, 710, 570], [{ d: polyD(right) }], 14, 22), poly(left, .5, 'HB'), poly(right, .5, 'HB')] },
  ];
}
function cylinderLesson() {
  const cx = 500, w = 150, ty = 200, by = 540, ery = 45;
  const body = `M${cx - w},${ty} L${cx - w},${by} A${w},${ery} 0 0,0 ${cx + w},${by} L${cx + w},${ty} Z`;
  const dk = (x) => { const u = (x - cx) / w; if (u < -.55) return .3 + (-.55 - u) * .4; if (u < -.25) return .05; if (u < .45) return .1 + (u + .25) / .7 * .55; if (u < .75) return .9; return .9 - (u - .75) * 1.2; };
  return [
    { title: 'Two ellipses and two lines', say: 'A cylinder is a rectangle with ellipses at each end. Keep it light.', strokes: [ell(cx, ty, w, ery, .25, '2H'), ell(cx, by, w, ery, .18, '2H', 0, Math.PI), ell(cx, by, w, ery, .1, '2H', Math.PI, TAU), line(cx - w, ty, cx - w, by, .25, '2H'), line(cx + w, ty, cx + w, by, .25, '2H')] },
    { title: 'Shade in stripes', say: 'Round things change from light to dark across them. Leave a highlight stripe on the left.', labels: [{ x: 420, y: 320, t: 'Highlight' }], strokes: hatch([cx - w, ty - 5, cx + w, by + ery], Math.PI / 2, 6, dk, 'HB', [{ d: body }]) },
    { title: 'Core shadow and reflected light', say: 'Press harder near the right side, then ease off at the very edge for reflected light.', labels: [{ x: 600, y: 380, t: 'Core shadow' }, { x: 655, y: 470, t: 'Reflected light' }], strokes: hatch([cx - w, ty - 5, cx + w, by + ery], Math.PI / 2 + .1, 7, (x, y) => dk(x) > .6 ? dk(x) : 0, '2B', [{ d: body }]) },
    { title: 'Top and cast shadow', say: 'The top faces the light, so it stays light.', strokes: [...hatch([cx - w, ty - ery, cx + w, ty + ery], .2, 9, () => .15, '2H', [{ d: ellD(cx, ty, w, ery) }]), ...hatch([cx - 40, by - 20, cx + 380, by + 70], 0, 5, (x) => clamp(.9 - (x - cx) / 420), '2B', [{ d: `M${cx + 20},${by + ery} L${cx + 380},${by + 25} L${cx + 360},${by - 10} L${cx + w},${by - 10} Z` }])] },
    { title: 'Blend smooth', say: 'Blend up and down along the cylinder, not across.', strokes: smudge([cx - w, ty, cx + w, by + 30], [{ d: body }], 12, 20) },
  ];
}
function coneLesson() {
  const ax = 500, tipY = 160, by = 560, w = 170, ery = 45;
  const body = `M${ax},${tipY} L${ax - w},${by} A${w},${ery} 0 0,0 ${ax + w},${by} Z`;
  const dk = (x, y) => { const hw = Math.max(4, (y - tipY) / (by - tipY) * w), u = (x - ax) / hw; if (u < -.6) return .3; if (u < -.2) return .06; if (u < .5) return .12 + (u + .2) * .7; if (u < .8) return .9; return .65; };
  return [
    { title: 'Triangle on an ellipse', say: 'A cone is a triangle sitting on an ellipse. Draw lightly.', strokes: [line(ax, tipY, ax - w, by, .25, '2H'), line(ax, tipY, ax + w, by, .25, '2H'), ell(ax, by, w, ery, .25, '2H', 0, Math.PI), ell(ax, by, w, ery, .1, '2H', Math.PI, TAU)] },
    { title: 'Shade toward the tip', say: 'Stroke from the base up toward the point, so your lines follow the shape.', strokes: (() => { const out = []; for (let i = -1; i <= 1.001; i += .025) { const bx = ax + i * w, a = []; for (let k = 0; k <= 30; k++) { const t = k / 30, x = bx + (ax - bx) * t * .92, y = by + Math.sqrt(Math.max(0, 1 - i * i)) * ery * (1 - t) + (tipY - by) * t * .92; a.push([x, y, clamp(dk(x, y)) * (1 - t * .3)]); } out.push(S('pencil', i > .4 ? '2B' : 'HB', a, [{ d: body }])); } return out; })(), labels: [{ x: 610, y: 430, t: 'Core shadow' }] },
    { title: 'Cast shadow and blend', say: 'The shadow of a cone is a pointy triangle.', strokes: [...hatch([ax - 20, by - 30, ax + 420, by + 60], .05, 5, (x) => clamp(.9 - (x - ax) / 450), '2B', [{ d: `M${ax - 30},${by + ery - 5} L${ax + 400},${by + 10} L${ax + w - 10},${by - 20} Z` }]), ...smudge([ax - w, tipY, ax + w, by + 40], [{ d: body }], 12, 22)] },
  ];
}
function techniquesLesson() {
  const boxes = [[60, 120], [250, 120], [440, 120], [630, 120], [820, 120]].map(([x, y]) => [x, y, x + 150, y + 380]);
  const g = (b) => (x, y) => .1 + (y - b[1]) / (b[3] - b[1]) * .85, c = (b) => [{ d: polyD([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) }];
  const lab = ['Hatching', 'Cross-hatching', 'Stippling', 'Blending', 'Scumbling'];
  return [
    { title: 'Hatching', say: 'Parallel lines. Closer lines and more pressure make it darker.', labels: [{ x: 70, y: 70, t: lab[0] }], strokes: hatch(boxes[0], -1.0, 9, g(boxes[0]), 'HB', c(boxes[0])) },
    { title: 'Cross-hatching', say: 'Add a second layer of lines going the other way. Each layer gets darker.', labels: [{ x: 250, y: 70, t: lab[1] }], strokes: [...hatch(boxes[1], -1.0, 10, () => .4, 'HB', c(boxes[1])), ...hatch(boxes[1], 1.0, 10, (x, y) => y > 240 ? .5 : 0, 'HB', c(boxes[1])), ...hatch(boxes[1], 0, 10, (x, y) => y > 370 ? .7 : 0, '2B', c(boxes[1]))] },
    { title: 'Stippling', say: 'Lots of little dots. More dots close together look darker. Be patient!', labels: [{ x: 460, y: 70, t: lab[2] }], strokes: stipple(boxes[2], g(boxes[2]), 1400, '2B', c(boxes[2])) },
    { title: 'Blending', say: 'Shade with the side of the pencil, then rub with a blending stump for smooth skin, metal, or sky.', labels: [{ x: 650, y: 70, t: lab[3] }], strokes: [...hatch(boxes[3], -.8, 5, g(boxes[3]), '2B', c(boxes[3])), ...smudge(boxes[3], c(boxes[3]), 14, 22)] },
    { title: 'Scumbling', say: 'Tiny overlapping circles. Great for bushes, rough walls and fur.', labels: [{ x: 820, y: 70, t: lab[4] }], strokes: (() => { const b = boxes[4], o = []; for (let y = b[1] + 15; y < b[3]; y += 22) o.push(scribble((b[0] + b[2]) / 2, y, 70, 3, 8, () => g(b)(0, y), 'HB', c(b))); return o; })() },
  ];
}
function valueScaleLesson() {
  const n = 7, w = 120, x0 = 80, y0 = 260, h = 180, vals = [0, .15, .3, .45, .62, .8, .97], gr = ['2H', '2H', 'HB', 'HB', '2B', '2B', '6B'];
  const steps = [{ title: 'Draw 7 boxes', say: 'Use a ruler and draw a long rectangle split into 7 boxes.', strokes: [poly([[x0, y0], [x0 + n * w, y0], [x0 + n * w, y0 + h], [x0, y0 + h]], .35, 'HB'), ...Array.from({ length: n - 1 }, (_, i) => line(x0 + (i + 1) * w, y0, x0 + (i + 1) * w, y0 + h, .35, 'HB'))] }];
  const names = ['Leave white', 'Barely touch the paper', 'Light', 'Medium', 'Medium-heavy', 'Press harder', 'Darkest dark'];
  for (let i = 1; i < n; i++) {
    const b = [x0 + i * w + 2, y0 + 2, x0 + (i + 1) * w - 2, y0 + h - 2];
    steps.push({ title: `Box ${i + 1}: ${names[i]}`, say: `${gr[i]} pencil. ${i < 3 ? 'Very light pressure, build it in layers.' : i < 5 ? 'A bit more pressure each box.' : 'Press harder, and add a second layer of lines.'}`, labels: [{ x: b[0] + 4, y: y0 + h + 20, t: gr[i] }], strokes: [...hatch(b, -.9, 6, () => vals[i], gr[i], [{ d: polyD([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) }]), ...(i > 2 ? hatch(b, .9, 7, () => vals[i], gr[i], [{ d: polyD([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) }]) : [])] });
  }
  steps[0].labels = [{ x: x0 + 4, y: y0 + h + 20, t: 'White' }];
  return steps;
}
function gradientLesson() {
  const b = [80, 300, 920, 430], c = [{ d: polyD([[80, 300], [920, 300], [920, 430], [80, 430]]) }];
  return [
    { title: 'Long box', say: 'Draw one long box.', strokes: [poly([[80, 300], [920, 300], [920, 430], [80, 430]], .35)] },
    { title: 'Smooth light-to-dark', say: 'Start at the right pressing hard. Slowly ease off as you move left, until you barely touch the paper.', strokes: hatch(b, Math.PI / 2 - .3, 5, (x) => clamp((x - 80) / 840) * .95, '2B', c) },
    { title: 'Blend it', say: 'Blend from light to dark, never dark to light, so you do not drag graphite into the white.', strokes: smudge(b, c, 12, 20) },
  ];
}
function appleLesson() {
  const ap = bez([500, 245], [[565, 195, 700, 215, 705, 370], [712, 510, 615, 600, 560, 590], [530, 585, 520, 575, 500, 582], [480, 575, 470, 585, 440, 590], [385, 600, 288, 510, 295, 370], [300, 215, 435, 195, 500, 245]]);
  const clip = [{ d: ap.d }], dk = sphereDark(500, 400, 215), box = [290, 190, 712, 600];
  const stem = bez([498, 250], [[495, 220, 505, 190, 525, 160]]), leaf = bez([520, 190], [[560, 150, 620, 150, 650, 170], [610, 200, 560, 205, 520, 190]]);
  return [
    { title: 'Basic shape', say: 'An apple starts as a circle that is a little wider at the top.', strokes: [ell(500, 400, 205, 190, .18, '2H')] },
    { title: 'Refine the outline', say: 'Find the dip at the top and the bumps at the bottom. Light pressure.', strokes: [trace(ap.pts, .3, 'HB'), trace(stem.pts, .5, '2B'), trace(leaf.pts, .35, 'HB')] },
    { title: 'Mid-tones', say: 'Shade the whole apple lightly, curving your strokes around the form.', strokes: hatch(box, .7, 7, (x, y) => Math.min(.5, dk(x, y)) + (Math.hypot(x - 500, y - 250) < 70 ? .25 : 0), 'HB', clip) },
    { title: 'Core shadow and dimple', say: 'Press harder on the shadow side and inside the dip by the stem.', labels: [{ x: 580, y: 500, t: 'Core shadow' }], strokes: [...hatch(box, -.8, 8, P(dk, .6, .95), '2B', clip), ...hatch([440, 230, 560, 290], 0, 5, (x, y) => clamp(.7 - Math.hypot(x - 500, y - 255) / 70), '2B', clip)] },
    { title: 'Speckles and stripes', say: 'Apples have faint stripes running down from the stem. Use light flicks.', strokes: Array.from({ length: 14 }, (_, i) => { const a = -1.1 + i * .16; return S('pencil', 'HB', Array.from({ length: 20 }, (_, k) => [500 + Math.sin(a) * (60 + k * 9), 260 + k * 15 * Math.cos(a * .5), .25 * (1 - k / 22)]), clip); }) },
    { title: 'Cast shadow and blend', say: 'Darkest right under the apple.', strokes: [...hatch([450, 560, 850, 640], .1, 5, castDark(610, 595, 210, 35, 560), '2B', [{ d: ellD(610, 595, 210, 35) }, { d: `M0,0H1000V750H0Z ${ap.d}`, rule: 'evenodd' }]), ...smudge(box, clip, 14, 24)] },
    { title: 'Shiny highlight', say: 'Lift a bright spot with the kneaded eraser. Shiny apples have a sharp highlight.', labels: [{ x: 360, y: 260, t: '✨ Highlight' }], strokes: [lift(410, 320, 26), lift(395, 345, 12)] },
  ];
}
function eyeLesson() {
  const top = bez([300, 390], [[380, 290, 600, 270, 710, 370]]), bot = bez([710, 370], [[620, 440, 420, 455, 300, 390]]);
  const alm = `M300,390 C380,290 600,270 710,370 C620,440 420,455 300,390 Z`, ic = [500, 375, 88], hl = [470, 342, 15];
  const iris = [{ d: alm }, { d: ellD(ic[0], ic[1], ic[2], ic[2]) }];
  const pupil = [{ d: alm }, { d: `${ellD(ic[0], ic[1], 38, 38)} ${ellD(hl[0], hl[1], hl[2], hl[2])}`, rule: 'evenodd' }];
  const lashes = Array.from({ length: 16 }, (_, i) => { const k = 3 + i * 5.5, q = top.pts[Math.min(top.pts.length - 1, Math.round(k * 16 / 100 * 1))] || top.pts[i]; const pt = top.pts[Math.round(2 + i * (top.pts.length - 4) / 15)], ang = -Math.PI / 2 + (i / 15 - .5) * 1.6; return S('pencil', '2B', Array.from({ length: 10 }, (_, s) => [pt[0] + Math.cos(ang) * s * 5 + s * s * .6 * (i / 15 - .3), pt[1] + Math.sin(ang) * s * 5, .85 * (1 - s / 10)])); });
  return [
    { title: 'Almond shape', say: 'An eye is shaped like an almond. The top lid curves more than the bottom.', strokes: [trace(top.pts, .3, 'HB'), trace(bot.pts, .25, 'HB')] },
    { title: 'Iris and pupil', say: 'The top of the iris hides under the eyelid. Mark a small circle for the reflection.', labels: [{ x: 395, y: 300, t: 'Reflection' }], strokes: [S('pencil', '2H', ell(...ic, ic[2], .25, '2H').p, [{ d: alm }]), ell(ic[0], ic[1], 38, 38, .25, '2H'), ell(...hl, hl[2], .2, '2H')] },
    { title: 'Darkest pupil', say: 'Press hard with a 6B. Go around the reflection, never over it.', labels: [{ x: 520, y: 470, t: 'Press hard here' }], strokes: hatch([455, 330, 545, 420], .7, 3, () => 1, '6B', pupil) },
    { title: 'Iris lines', say: 'Pull lines out from the pupil like spokes on a wheel. Darker near the outer ring.', strokes: [...Array.from({ length: 60 }, (_, i) => { const a = i / 60 * TAU; return S('pencil', 'HB', Array.from({ length: 10 }, (_, s) => [ic[0] + Math.cos(a) * (40 + s * 5), ic[1] + Math.sin(a) * (40 + s * 5), .25 + s * .04]), iris); }), S('pencil', '2B', ell(ic[0], ic[1], ic[2] - 3, ic[2] - 3, .8, '2B').p, iris)] },
    { title: 'Shade the eyeball', say: 'The white of the eye is not pure white. Shade the corners and under the top lid lightly.', strokes: hatch([300, 280, 710, 450], 1.3, 6, (x, y) => { const e = Math.abs(x - 505) / 205; return Math.hypot(x - ic[0], y - ic[1]) < ic[2] ? 0 : clamp(e * e * .55 + (y < 350 ? .2 : 0)); }, 'HB', [{ d: alm }]) },
    { title: 'Lids, crease and lashes', say: 'Lashes start firm and flick off light. They curve outward, never straight up.', strokes: [trace(top.pts, .8, '2B'), trace(bot.pts.map(p => [p[0], p[1] + 6]), .3, 'HB'), trace(bez([330, 340], [[420, 230, 620, 220, 700, 320]]).pts, .35, 'HB'), ...lashes] },
    { title: 'Eyebrow and highlight', say: 'Brow hairs grow outward. Then lift the reflection crisp with the eraser.', strokes: [...Array.from({ length: 40 }, (_, i) => { const x = 300 + i * 10, y = 215 - Math.sin(i / 40 * Math.PI) * 40; return line(x, y + 20, x + 22, y - 4, (t) => .6 * (1 - t), '2B', 6); }), lift(hl[0], hl[1], 10, 1)] },
  ];
}
function treeLesson() {
  const trunk = [[470, 700], [530, 700], [518, 600], [512, 450], [490, 450], [482, 600]];
  const clusters = [[500, 260, 120], [390, 330, 95], [610, 330, 100], [450, 400, 90], [560, 410, 90], [500, 340, 110]];
  const fol = clusters.map(c => ellD(c[0], c[1], c[2], c[2] * .8)).join(' ');
  return [
    { title: 'Big shapes first', say: 'A tree is a trunk plus a cloud of leaf clumps. Sketch lightly.', strokes: [poly(trunk, .25, '2H'), ...clusters.map(c => ell(c[0], c[1], c[2], c[2] * .8, .15, '2H'))] },
    { title: 'Branches', say: 'Branches get thinner as they split, like a Y.', strokes: [line(500, 460, 420, 340, t => .6 - t * .4, '2B'), line(500, 470, 600, 330, t => .6 - t * .4, '2B'), line(500, 450, 505, 280, t => .6 - t * .4, '2B'), line(440, 370, 380, 320, .3, 'HB'), line(580, 360, 650, 310, .3, 'HB')] },
    { title: 'Leaf texture', say: 'Scumble little loops. Light on top where the sun hits, heavy underneath each clump.', strokes: clusters.flatMap((c, i) => Array.from({ length: 7 }, (_, k) => scribble(c[0], c[1] - c[2] * .6 + k * c[2] * .2, c[2] * .9, 4, 9, () => .15 + k * .12, k > 3 ? '2B' : 'HB', [{ d: fol }]))) },
    { title: 'Bark', say: 'Bark is wavy up-and-down lines. Darker on the shadow side.', strokes: [...hatch([470, 440, 535, 700], Math.PI / 2, 5, (x) => clamp(.3 + (x - 470) / 65 * .6), '2B', [{ d: polyD(trunk) }]), ...Array.from({ length: 6 }, (_, i) => S('pencil', '6B', Array.from({ length: 20 }, (_, k) => [480 + i * 8 + Math.sin(k * .8 + i) * 3, 700 - k * 12, .5]), [{ d: polyD(trunk) }]))] },
    { title: 'Shadow on the grass', say: 'The tree shadow lies on the ground away from the sun. Add little grass flicks.', strokes: [...hatch([480, 680, 900, 730], .05, 5, castDark(690, 705, 210, 22, 520), '2B', [{ d: ellD(690, 705, 210, 22) }]), ...Array.from({ length: 70 }, (_, i) => { const x = 200 + rnd() * 620, y = 700 + rnd() * 40; return line(x, y, x + (rnd() - .5) * 10, y - 14 - rnd() * 12, t => .5 * (1 - t), 'HB', 5); })] },
  ];
}
function catLesson() {
  const head = [500, 230, 80], body = bez([450, 290], [[360, 360, 350, 560, 380, 620], [430, 650, 570, 650, 620, 620], [650, 560, 640, 360, 550, 290]]);
  const earL = [[440, 190], [445, 120], [485, 160]], earR = [[515, 160], [555, 120], [560, 190]];
  const all = `${body.d} ${ellD(head[0], head[1], head[2], head[2] * .9)}`, dkb = sphereDark(500, 470, 190), dkh = sphereDark(500, 230, 85);
  const tail = bez([610, 610], [[700, 640, 760, 600, 740, 520]]);
  return [
    { title: 'Shapes', say: 'A sitting cat is a circle head on a pear-shaped body.', strokes: [ell(head[0], head[1], head[2], head[2] * .9, .2, '2H'), trace(body.pts, .2, '2H'), poly(earL, .2, '2H', false), poly(earR, .2, '2H', false)] },
    { title: 'Guidelines for the face', say: 'Draw a cross on the face. Eyes go on the line across, nose just below.', strokes: [line(500, 160, 500, 305, .12, '2H'), line(425, 225, 575, 225, .12, '2H'), ell(468, 225, 15, 10, .4, 'HB'), ell(532, 225, 15, 10, .4, 'HB'), poly([[490, 250], [510, 250], [500, 262]], .5, '2B')] },
    { title: 'Tail and paws', say: 'The tail wraps around the body. Paws are small ovals at the bottom.', strokes: [trace(tail.pts, .4, 'HB'), trace(tail.pts.map(p => [p[0] - 15, p[1] + 5]), .35, 'HB'), ell(460, 625, 30, 14, .3, 'HB'), ell(540, 625, 30, 14, .3, 'HB')] },
    { title: 'Fur shading', say: 'Short strokes in the direction the fur grows. More pressure on the shadow side.', strokes: (() => { const o = []; for (let i = 0; i < 900; i++) { const x = 340 + rnd() * 320, y = 140 + rnd() * 500, v = Math.max(dkb(x, y), dkh(x, y)); if (v < .1) continue; const a = y < 300 ? Math.atan2(y - 230, x - 500) : Math.PI / 2 + (x - 500) / 400; o.push(S('pencil', v > .6 ? '2B' : 'HB', [[x, y, v], [x + Math.cos(a) * 9, y + Math.sin(a) * 9, v * .7], [x + Math.cos(a) * 16, y + Math.sin(a) * 16, v * .2]], [{ d: all }])); } return o; })() },
    { title: 'Eyes, whiskers and shadow', say: 'Cat pupils are tall slits. Whiskers are quick, light flicks.', strokes: [S('pencil', '6B', [[468, 216, 1], [468, 234, 1]]), S('pencil', '6B', [[532, 216, 1], [532, 234, 1]]), ...[-1, 1].flatMap(s => [0, 1, 2].map(k => line(500 + s * 25, 258 + k * 6, 500 + s * 120, 245 + k * 18, t => .35 * (1 - t), 'HB'))), ...hatch([380, 610, 820, 680], .05, 5, castDark(600, 640, 230, 30, 500), '2B', [{ d: ellD(600, 640, 230, 30) }])] },
  ];
}
function carLesson() {
  const body = [[160, 480], [170, 420], [300, 400], [380, 320], [620, 320], [720, 400], [840, 420], [850, 490], [160, 490]];
  const win = [[400, 335], [500, 335], [500, 400], [330, 400]], win2 = [[515, 335], [610, 335], [690, 400], [515, 400]];
  const wheels = [[300, 500], [700, 500]];
  return [
    { title: 'Boxes first', say: 'A car is a long box with a smaller box on top. Wheels are circles.', strokes: [poly([[160, 400], [850, 400], [850, 490], [160, 490]], .15, '2H'), poly([[300, 320], [720, 320], [720, 400], [300, 400]], .15, '2H'), ...wheels.map(w => ell(w[0], w[1], 62, 62, .2, '2H'))] },
    { title: 'Shape the body', say: 'Slant the windshield and round the corners.', strokes: [poly(body, .4, 'HB'), poly(win, .35, 'HB'), poly(win2, .35, 'HB'), line(510, 405, 510, 485, .3, 'HB'), ell(800, 435, 18, 10, .3, 'HB')] },
    { title: 'Dark tires', say: 'Tires are the darkest part. Press hard with a 6B, leave the hubcaps light.', strokes: wheels.flatMap(w => [...hatch([w[0] - 62, w[1] - 62, w[0] + 62, w[1] + 62], .8, 4, (x, y) => Math.hypot(x - w[0], y - w[1]) < 32 ? 0 : 1, '6B', [{ d: ellD(w[0], w[1], 62, 62) }]), ell(w[0], w[1], 32, 32, .5, '2B'), ell(w[0], w[1], 10, 10, .6, '2B')]) },
    { title: 'Glass and paint', say: 'Windows reflect the sky, so leave diagonal white streaks. The car body is darker near the bottom.', strokes: [...hatch([320, 330, 700, 405], 1.4, 5, (x, y) => ((x + y * .8) % 120) < 30 ? 0 : .65, '2B', [{ d: polyD(win) + ' ' + polyD(win2) }]), ...hatch([150, 320, 860, 495], Math.PI / 2, 6, (x, y) => clamp((y - 410) / 90) * .7 + .08, 'HB', [{ d: polyD(body) }, { d: `M0,0H1000V750H0Z ${polyD(win)} ${polyD(win2)} ${ellD(300, 500, 62, 62)} ${ellD(700, 500, 62, 62)}`, rule: 'evenodd' }])] },
    { title: 'Shadow underneath', say: 'A dark shadow under the car makes it sit on the road.', strokes: [...hatch([140, 545, 880, 580], 0, 4, (x) => .85, '6B', [{ d: ellD(510, 560, 370, 18) }]), ...smudge([150, 320, 860, 495], [{ d: polyD(body) }], 12, 20)] },
  ];
}
function faceLesson() {
  const cx = 500, top = 160, chin = 600, eyeY = 380, noseY = 490, mouthY = 530, rx = 165;
  return [
    { title: 'Egg-shaped head', say: 'A face from the front is an upside-down egg, narrower at the chin.', strokes: [trace(bez([cx, top], [[cx + 210, top, cx + 190, chin - 60, cx, chin], [cx - 190, chin - 60, cx - 210, top, cx, top]]).pts, .25, '2H')] },
    { title: 'Measure: eyes go halfway!', say: 'Most kids put eyes too high. The eyes sit halfway between the top of the head and the chin.', labels: [{ x: 700, y: eyeY - 12, t: '½ way down' }], strokes: [line(cx, top, cx, chin, .12, '2H'), line(cx - rx - 10, eyeY, cx + rx + 10, eyeY, .2, '2H')] },
    { title: 'Five eyes wide', say: 'The face is about five eyes wide. There is one eye-width between the eyes.', strokes: [...[-2.5, -1.5, -.5, .5, 1.5, 2.5].map(k => line(cx + k * 64, eyeY - 12, cx + k * 64, eyeY + 12, .15, '2H')), trace(bez([cx - 160, eyeY], [[cx - 130, eyeY - 25, cx - 90, eyeY - 25, cx - 32, eyeY], [cx - 80, eyeY + 18, cx - 130, eyeY + 18, cx - 160, eyeY]]).pts, .4, 'HB'), trace(bez([cx + 32, eyeY], [[cx + 90, eyeY - 25, cx + 130, eyeY - 25, cx + 160, eyeY], [cx + 130, eyeY + 18, cx + 80, eyeY + 18, cx + 32, eyeY]]).pts, .4, 'HB'), ell(cx - 96, eyeY, 12, 12, .8, '2B'), ell(cx + 96, eyeY, 12, 12, .8, '2B')] },
    { title: 'Nose and mouth lines', say: 'The bottom of the nose is halfway from the eyes to the chin. The mouth is a little below it.', labels: [{ x: 700, y: noseY - 12, t: 'Nose' }, { x: 700, y: mouthY + 8, t: 'Mouth' }], strokes: [line(cx - 120, noseY, cx + 120, noseY, .12, '2H'), trace(bez([cx - 30, noseY - 5], [[cx - 15, noseY + 12, cx + 15, noseY + 12, cx + 30, noseY - 5]]).pts, .45, 'HB'), trace(bez([cx - 60, mouthY + 15], [[cx - 25, mouthY + 30, cx + 25, mouthY + 30, cx + 60, mouthY + 15]]).pts, .45, 'HB'), trace(bez([cx - 60, mouthY + 15], [[cx - 25, mouthY + 5, cx + 25, mouthY + 5, cx + 60, mouthY + 15]]).pts, .5, '2B')] },
    { title: 'Ears and brows', say: 'Ears line up from the eyebrows to the bottom of the nose.', strokes: [trace(bez([cx - 172, eyeY - 30], [[cx - 215, eyeY - 30, cx - 210, noseY, cx - 165, noseY]]).pts, .4, 'HB'), trace(bez([cx + 172, eyeY - 30], [[cx + 215, eyeY - 30, cx + 210, noseY, cx + 165, noseY]]).pts, .4, 'HB'), line(cx - 150, eyeY - 40, cx - 40, eyeY - 45, .5, '2B'), line(cx + 40, eyeY - 45, cx + 150, eyeY - 40, .5, '2B')] },
    { title: 'Gentle shading', say: 'Shadows go in the eye sockets, beside the nose and under the lip and chin. Keep it light.', strokes: [...hatch([cx - 160, eyeY - 60, cx - 20, eyeY + 30], .7, 7, (x, y) => .3, 'HB', [{ d: ellD(cx - 92, eyeY - 10, 80, 35) }]), ...hatch([cx + 20, eyeY - 60, cx + 160, eyeY + 30], .7, 7, () => .3, 'HB', [{ d: ellD(cx + 92, eyeY - 10, 80, 35) }]), ...hatch([cx + 5, eyeY, cx + 40, noseY], 1.3, 5, () => .35, 'HB'), ...hatch([cx - 40, mouthY + 30, cx + 40, mouthY + 50], 0, 5, () => .35, 'HB'), ...hatch([cx - 90, chin, cx + 90, chin + 60], .4, 6, () => .5, '2B', [{ d: polyD([[cx - 90, chin - 10], [cx + 90, chin - 10], [cx + 70, chin + 60], [cx - 70, chin + 60]]) }])] },
  ];
}
function onePointLesson() {
  const hy = 300, vp = [500, hy];
  const toward = (x, y, t) => [x + (vp[0] - x) * t, y + (vp[1] - y) * t];
  const posts = [0, .25, .45, .6, .72, .81].map(t => { const b = toward(160, 750, t), h = 150 * (1 - t); return line(b[0], b[1], b[0], b[1] - h, .6 * (1 - t * .6), '2B'); });
  const trees = [0, .3, .52, .67].map(t => { const b = toward(880, 720, t), s = 1 - t; return [line(b[0], b[1], b[0], b[1] - 130 * s, .6, '2B'), ...Array.from({ length: 4 }, (_, k) => scribble(b[0], b[1] - 150 * s - k * 22 * s, 55 * s, 2, 4, .4 + k * .05, 'HB'))]; }).flat();
  return [
    { title: 'Horizon and vanishing point', say: 'The horizon line is your eye level. Things far away shrink to one dot: the vanishing point.', labels: [{ x: 520, y: 270, t: 'Vanishing point' }, { x: 40, y: 270, t: 'Horizon' }], strokes: [line(20, hy, 980, hy, .25, 'HB'), ell(500, 300, 6, 6, .8, '2B')] },
    { title: 'The road', say: 'Both sides of the road go to the vanishing point.', strokes: [line(250, 750, 500, hy, .4, 'HB'), line(750, 750, 500, hy, .4, 'HB'), ...[0, .3, .5, .64, .74].map(t => { const a = toward(500, 750, t), b = toward(500, 750, t + .12 * (1 - t)); return line(a[0], a[1], b[0], b[1], .7, '2B'); })] },
    { title: 'Fence posts shrink', say: 'Each post is shorter and closer together as it goes back. Use guide lines to the vanishing point.', strokes: [line(160, 750, 500, hy, .1, '2H'), line(160, 600, 500, hy, .1, '2H'), ...posts, line(160, 650, 500, hy, .3, 'HB')] },
    { title: 'Trees in perspective', say: 'Same idea: near trees big and dark, far trees small and light.', strokes: trees },
    { title: 'Atmospheric perspective', say: 'Far mountains look lighter and softer. Barely touch the paper with a 2H.', strokes: [poly([[20, hy], [160, 210], [260, 250], [380, 180], [520, hy]], .2, '2H', false), poly([[480, hy], [640, 200], [760, 240], [900, 170], [980, 230]], .2, '2H', false), ...hatch([20, 160, 980, hy], .5, 8, (x, y) => .14, '2H', [{ d: polyD([[20, hy], [160, 210], [260, 250], [380, 180], [520, hy], [640, 200], [760, 240], [900, 170], [980, 230], [980, hy]]) }])] },
  ];
}
function twoPointLesson() {
  const hy = 280, v1 = [40, hy], v2 = [960, hy], cx = 480, t = 180, b = 600;
  const inter = (p, v, x) => { const s = (x - p[0]) / (v[0] - p[0]); return [x, p[1] + (v[1] - p[1]) * s]; };
  const lt = inter([cx, t], v1, 280), lb = inter([cx, b], v1, 280), rt = inter([cx, t], v2, 720), rb = inter([cx, b], v2, 720);
  const left = [[cx, t], lt, lb, [cx, b]], right = [[cx, t], rt, rb, [cx, b]];
  const wins = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { for (const [face, v, xe] of [[0, v1, 280], [1, v2, 720]]) { const x0 = cx + (xe - cx) * (.15 + c * .28), x1 = cx + (xe - cx) * (.3 + c * .28), y0 = t + 50 + r * 95, y1 = y0 + 50; const a = inter([cx, y0], v, x0), bb = inter([cx, y0], v, x1), cc = inter([cx, y1], v, x1), d = inter([cx, y1], v, x0); wins.push(poly([a, bb, cc, d], .5, '2B')); } }
  return [
    { title: 'Two vanishing points', say: 'Put two dots far apart on the horizon line. Draw one vertical line for the nearest corner.', strokes: [line(20, hy, 980, hy, .2, 'HB'), ell(...v1, 6, 6, .8, '2B'), ell(...v2, 6, 6, .8, '2B'), line(cx, t, cx, b, .5, 'HB')], labels: [{ x: 40, y: 250, t: 'VP 1' }, { x: 900, y: 250, t: 'VP 2' }] },
    { title: 'Lines to each point', say: 'From the top and bottom of the corner, draw light lines to both vanishing points.', strokes: [line(cx, t, ...v1, .1, '2H'), line(cx, b, ...v1, .1, '2H'), line(cx, t, ...v2, .1, '2H'), line(cx, b, ...v2, .1, '2H')] },
    { title: 'Close the building', say: 'Add vertical lines for the back edges. Now it is a 3D building!', strokes: [poly(left, .45, 'HB'), poly(right, .45, 'HB')] },
    { title: 'Windows follow the lines', say: 'Window tops and bottoms also aim at the vanishing points.', strokes: wins },
    { title: 'Shade one side', say: 'Light from the left, so the right side is in shadow.', strokes: hatch([cx, t - 30, 720, b + 30], Math.PI / 2, 6, () => .5, 'HB', [{ d: polyD(right) }]) },
  ];
}
function textureLesson() {
  const bx = [[60, 140], [290, 140], [520, 140], [750, 140]].map(([x, y]) => [x, y, x + 200, y + 340]);
  const c = (b) => [{ d: polyD([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) }];
  return [
    { title: 'Wood grain', say: 'Long wavy lines that bend around a knot.', labels: [{ x: 60, y: 100, t: 'Wood' }], strokes: [...Array.from({ length: 22 }, (_, i) => S('pencil', 'HB', Array.from({ length: 60 }, (_, k) => { const y = 140 + k * 5.8, x = 70 + i * 9; const d = Math.hypot(x - 160, y - 300); return [x + 30 * Math.exp(-d * d / 1800) * Math.sign(x - 160) + Math.sin(y / 40) * 3, y, .35 + (i % 3) * .1]; }), c(bx[0]))), ell(160, 300, 14, 26, .8, '2B')] },
    { title: 'Fur', say: 'Short flicks in rows. Start firm, lift off at the end.', labels: [{ x: 290, y: 100, t: 'Fur' }], strokes: Array.from({ length: 360 }, (_, i) => { const x = 290 + rnd() * 200, y = 140 + rnd() * 340; return line(x, y, x + 6, y + 26, t => .7 * (1 - t), y > 330 ? '2B' : 'HB', 5); }).map(s => ({ ...s, clip: c(bx[1]) })) },
    { title: 'Stone', say: 'Outline rounded rocks, then shade the bottom-right of each one.', labels: [{ x: 520, y: 100, t: 'Stone' }], strokes: [[570, 200, 45, 35], [660, 210, 40, 40], [600, 300, 60, 40], [680, 330, 30, 35], [580, 410, 45, 40], [670, 430, 40, 30]].flatMap(r => [ell(r[0], r[1], r[2], r[3], .45, 'HB'), ...hatch([r[0] - r[2], r[1] - r[3], r[0] + r[2], r[1] + r[3]], .8, 5, (x, y) => clamp(((x - r[0]) / r[2] + (y - r[1]) / r[3]) * .45 + .1), '2B', [{ d: ellD(...r) }])]) },
    { title: 'Grass', say: 'Flick upward fast. Dark at the base, light at the tip. Overlap a lot.', labels: [{ x: 750, y: 100, t: 'Grass' }], strokes: Array.from({ length: 260 }, () => { const x = 755 + rnd() * 190, y = 300 + rnd() * 180; return line(x, y, x + (rnd() - .5) * 30, y - 50 - rnd() * 60, t => .8 * (1 - t), y > 400 ? '2B' : 'HB', 6); }).map(s => ({ ...s, clip: c(bx[3]) })) },
  ];
}
function blindContourLesson() {
  const leaf = bez([300, 600], [[260, 420, 420, 180, 720, 140], [700, 380, 520, 600, 300, 600]]);
  return [
    { title: 'Look at a real object', say: 'Pick a leaf, your hand, or a shoe. Put your pencil on the paper.', strokes: [trace(leaf.pts, .45, 'HB')] },
    { title: 'Eyes on the object only', say: 'Now draw the edges very slowly while looking ONLY at the object, not the paper. One continuous line.', strokes: [line(300, 600, 690, 170, .4, 'HB'), ...Array.from({ length: 6 }, (_, i) => { const t = .2 + i * .12, a = [300 + 390 * t, 600 - 430 * t]; return line(a[0], a[1], a[0] + 70 * (1 - t), a[1] + 10 + 40 * (1 - t), .3, 'HB'); })] },
    { title: 'It will look funny, and that is good!', say: 'Blind contour trains your eye to really see. Wobbly lines mean you were looking. Try it 3 times.', strokes: [trace(leaf.pts.map((p, i) => [p[0] + 40 + Math.sin(i / 3) * 12 + 120, p[1] + Math.cos(i / 4) * 10]), .3, 'HB')] },
  ];
}
function upsideDownLesson() {
  return [
    { title: 'Turn the picture upside down', say: 'Drawing on the Right Side of the Brain idea: when a picture is upside down, your brain stops guessing and you copy the real shapes.', strokes: [] },
    { title: 'Copy one edge at a time', say: 'Start at the top and copy each line where it meets the next. Do not name the parts, just look at angles and spaces.', strokes: [] },
    { title: 'Flip it over', say: 'When you are done, turn your paper right side up. Most kids are surprised how good it looks!', strokes: [] },
  ];
}
function negativeSpaceLesson() {
  const chair = [[380, 160], [420, 160], [420, 380], [600, 380], [600, 160], [640, 160], [640, 640], [610, 640], [610, 450], [410, 450], [410, 640], [380, 640]];
  const box = [300, 110, 720, 680], all = `M300,110 H720 V680 H300 Z ${polyD(chair)}`;
  return [
    { title: 'See the spaces, not the chair', say: 'Negative space is the empty space around and between things. Look at the gaps between chair legs.', strokes: [poly([[300, 110], [720, 110], [720, 680], [300, 680]], .3, 'HB')] },
    { title: 'Shade only the gaps', say: 'Draw and shade the shapes of the gaps. The chair appears by itself, left white!', strokes: hatch(box, .8, 6, () => .55, 'HB', [{ d: all, rule: 'evenodd' }]) },
  ];
}
function measuringLesson() {
  const cx = 500, w = 70;
  return [
    { title: 'Hold your pencil out', say: 'Stretch your arm straight, close one eye, and line the pencil tip up with the top of the bottle.', strokes: [] },
    { title: 'Slide your thumb', say: 'Slide your thumb to the bottom of the bottle width. That width is your measuring unit.', strokes: [line(cx - w, 600, cx + w, 600, .4, 'HB'), ...[0, 1, 2, 3, 4].map(k => line(cx + 110, 640 - k * w * 2 + 0, cx + 130, 640 - k * w * 2, .6, '2B'))], labels: [{ x: 640, y: 560, t: '1 width' }] },
    { title: 'Count the units', say: 'This bottle is about 3½ widths tall. Measure on the real thing, then match it on your paper.', strokes: [poly([[cx - w, 640], [cx + w, 640], [cx + w, 360], [cx + 30, 300], [cx + 25, 160], [cx - 25, 160], [cx - 30, 300], [cx - w, 360]], .45, 'HB'), ...hatch([cx - w, 160, cx + w, 640], Math.PI / 2, 6, (x) => clamp((x - cx + w) / (2 * w)) * .6, 'HB', [{ d: polyD([[cx - w, 640], [cx + w, 640], [cx + w, 360], [cx + 30, 300], [cx + 25, 160], [cx - 25, 160], [cx - 30, 300], [cx - w, 360]]) }])] },
  ];
}

// ---------- Eyes course ----------
function clipPoly(pts, a, b, c) { // keep a*x + b*y + c >= 0
  const out = []; for (let i = 0; i < pts.length; i++) { const P1 = pts[i], P2 = pts[(i + 1) % pts.length], d1 = a * P1[0] + b * P1[1] + c, d2 = a * P2[0] + b * P2[1] + c; if (d1 >= 0) out.push(P1); if ((d1 >= 0) !== (d2 >= 0)) { const t = d1 / (d1 - d2); out.push([P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]); } } return out;
}
const ellPts = (cx, cy, rx, ry, n = 72) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * rx, cy + Math.sin(i / n * TAU) * ry]);
// Cartoon / storybook eye. o: px,py pupil offset (-1..1), pr pupil size (0..1 of ry), top: lid line [y at left, y at right] in -1..1 of ry, bot likewise, brow: [[dx1,dy1],[dx2,dy2]] in units of rx, cl: catchlights, iris: ring size
function cEye(cx, cy, rx, ry, o = {}) {
  let shape = ellPts(cx, cy, rx, ry);
  if (o.top) { const [l, r] = o.top, y1 = cy + l * ry, y2 = cy + r * ry; shape = clipPoly(shape, -(y2 - y1), 2 * rx, -(-(y2 - y1) * (cx - rx) + 2 * rx * y1)); }
  if (o.bot) { const [l, r] = o.bot, y1 = cy + l * ry, y2 = cy + r * ry; shape = clipPoly(shape, (y2 - y1), -2 * rx, ((y2 - y1) * -(cx - rx) + 2 * rx * y1)); }
  const clip = [{ d: polyD(shape) }];
  const ir = (o.iris || .62) * Math.min(rx, ry), ix = cx + (o.px || 0) * (rx - ir * .9), iy = cy + (o.py || 0) * (ry - ir * .9), pr = (o.pr || .55) * ir;
  const cls = o.cl === false ? [] : [[ix - ir * .35, iy - ir * .38, ir * (o.big ? .32 : .22)], ...(o.big ? [[ix + ir * .38, iy + ir * .4, ir * .12]] : [])];
  const holes = cls.map(c => ellD(...c, c[2])).join(' ');
  const s = [];
  s.push(trace([...shape, shape[0]], .55, 'HB'));
  s.push(...hatch([ix - ir, iy - ir, ix + ir, iy + ir], .8, 4, (x, y) => .38 + (y < iy ? (iy - y) / ir * .35 : 0), '2B', [...clip, { d: `${ellD(ix, iy, ir, ir)} ${holes}`, rule: 'evenodd' }]));
  s.push(...hatch([ix - pr, iy - pr, ix + pr, iy + pr], -.7, 3, () => 1, '6B', [...clip, { d: `${ellD(ix, iy, pr, pr)} ${holes}`, rule: 'evenodd' }]));
  s.push(S('pencil', '6B', ell(ix, iy, ir, ir, .75, '6B').p, clip));
  if (o.top) s.push(line(cx - rx, cy + o.top[0] * ry, cx + rx, cy + o.top[1] * ry, .85, '6B'));
  if (o.lash) s.push(...[0, 1, 2].map(k => { const a = -.5 + k * .3; return line(cx + rx * .7 + k * 6, cy - ry * .6 + k * 10, cx + rx * 1.05 + k * 10, cy - ry * .9 + k * 12 + a, t => .8 * (1 - t), '2B', 6); }));
  if (o.brow) { const [[a, b], [c, d]] = o.brow; s.push(line(cx + a * rx, cy - ry * 1.25 + b * ry, cx + c * rx, cy - ry * 1.25 + d * ry, t => .9 - t * .3, '6B')); }
  s.push(...hatch([cx - rx, cy - ry, cx + rx, cy + ry], 0, 5, (x, y) => (y < cy - ry * .45 ? .25 : 0), 'HB', [...clip, { d: `M0,0H1000V750H0Z ${ellD(ix, iy, ir, ir)}`, rule: 'evenodd' }]));
  return s;
}
function eyeStructureLesson() {
  const cx = 500, cy = 380, r = 150, dk = sphereDark(cx, cy, r, .5);
  const top = bez([330, 390], [[400, 260, 600, 250, 670, 360]]), bot = bez([670, 360], [[600, 450, 420, 460, 330, 390]]);
  const alm = `M330,390 C400,260 600,250 670,360 C600,450 420,460 330,390 Z`;
  return [
    { title: 'The eyeball is a ball', say: 'An eye is a sphere, like the ball you shaded. Draw a light circle.', strokes: [ell(cx, cy, r, r, .15, '2H')] },
    { title: 'Lids wrap around the ball', say: 'The eyelids are like a blanket wrapped around the ball. The top lid curves more.', labels: [{ x: 690, y: 300, t: 'Upper lid' }, { x: 690, y: 440, t: 'Lower lid' }], strokes: [trace(top.pts, .45, 'HB'), trace(bot.pts, .35, 'HB'), trace(top.pts.map(p => [p[0], p[1] - 12]), .35, 'HB')] },
    { title: 'Lid thickness and tear duct', say: 'The lower lid has a thin ledge you can see. The tear duct is a little pink bump at the inside corner.', labels: [{ x: 230, y: 395, t: 'Tear duct' }, { x: 560, y: 470, t: 'Lid thickness' }], strokes: [trace(bot.pts.map(p => [p[0], p[1] + 9]), .3, 'HB'), ell(345, 392, 16, 10, .35, 'HB')] },
    { title: 'Shade it like a sphere', say: 'Since the eye is round, the white part gets darker toward the corners, so it is never pure white.', strokes: hatch([330, 260, 670, 460], 1.2, 6, (x, y) => clamp(dk(x, y) + Math.abs(x - 500) / 400), 'HB', [{ d: alm }]) },
    { title: 'The upper lid casts a shadow', say: 'The top lid sticks out, so it casts a shadow band across the top of the eyeball. Press a bit harder right under the lid.', labels: [{ x: 520, y: 300, t: 'Lid shadow' }], strokes: hatch([330, 260, 670, 350], .1, 5, (x, y) => clamp(.6 - (y - 290) / 70), '2B', [{ d: alm }]) },
    { title: 'Find the crease', say: 'The crease follows the top of the ball, above the lid.', strokes: [trace(bez([350, 340], [[420, 220, 600, 210, 660, 320]]).pts, .4, 'HB')] },
  ];
}
function threeQuarterEyeLesson() {
  const alm = `M340,390 C380,300 560,270 650,350 C600,420 440,440 340,390 Z`, ic = [560, 365], irx = 56, iry = 74;
  const iris = [{ d: alm }, { d: ellD(ic[0], ic[1], irx, iry) }];
  return [
    { title: 'A squished almond', say: 'When the head turns, the far side of the eye gets shorter. The almond is lopsided.', strokes: [trace(bez([340, 390], [[380, 300, 560, 270, 650, 350]]).pts, .35, 'HB'), trace(bez([650, 350], [[600, 420, 440, 440, 340, 390]]).pts, .3, 'HB')] },
    { title: 'The iris is an oval now', say: 'From the side, the round iris looks like a tall oval. It slides toward the far corner.', strokes: [S('pencil', 'HB', ell(ic[0], ic[1], irx, iry, .35).p, [{ d: alm }]), ell(ic[0] + 6, ic[1], 22, 30, .4, 'HB')] },
    { title: 'Pupil, iris and catchlight', say: 'Dark pupil with a 6B. Leave the catchlight white. Darken the limbal ring around the iris.', strokes: [...hatch([ic[0] - 30, ic[1] - 35, ic[0] + 40, ic[1] + 35], .7, 3, () => 1, '6B', [{ d: alm }, { d: `${ellD(ic[0] + 6, ic[1], 22, 30)} ${ellD(ic[0] - 12, ic[1] - 18, 10, 10)}`, rule: 'evenodd' }]), ...Array.from({ length: 40 }, (_, i) => { const a = i / 40 * TAU; return S('pencil', 'HB', Array.from({ length: 8 }, (_, k) => [ic[0] + 6 + Math.cos(a) * (24 + k * 4) * .75, ic[1] + Math.sin(a) * (31 + k * 5.5), .3 + k * .05]), iris); }), S('pencil', '2B', ell(ic[0], ic[1], irx - 2, iry - 2, .85, '2B').p, iris)] },
    { title: 'Shade, lid shadow and lashes', say: 'Lashes on the far side overlap and look shorter. Shade the corners of the eye white.', strokes: [...hatch([340, 270, 650, 440], 1.2, 6, (x, y) => clamp(Math.abs(x - 520) / 320 + (y < 340 ? .25 : 0)), 'HB', [{ d: alm }, { d: `M0,0H1000V750H0Z ${ellD(ic[0], ic[1], irx, iry)}`, rule: 'evenodd' }]), trace(bez([340, 390], [[380, 300, 560, 270, 650, 350]]).pts, .85, '2B'), ...Array.from({ length: 12 }, (_, i) => { const x = 380 + i * 23, y = 330 - Math.sin(i / 11 * Math.PI) * 30 + i * 2; return line(x, y, x + 14 + i, y - 26 + i * 1.2, t => .8 * (1 - t), '2B', 6); })] },
  ];
}
function eyePairLesson() {
  const y = 380, w = 130, gap = 130, xL = 500 - gap / 2 - w / 2, xR = 500 + gap / 2 + w / 2;
  const eye = (cx, flip) => { const f = flip ? -1 : 1, d = `M${cx - f * w / 2},${y + 6} C${cx - f * w / 3},${y - 50} ${cx + f * w / 3},${y - 52} ${cx + f * w / 2},${y - 4} C${cx + f * w / 3},${y + 34} ${cx - f * w / 3},${y + 36} ${cx - f * w / 2},${y + 6} Z`; return { d, s: [S('pencil', 'HB', bez([cx - f * w / 2, y + 6], [[cx - f * w / 3, y - 50, cx + f * w / 3, y - 52, cx + f * w / 2, y - 4], [cx + f * w / 3, y + 34, cx - f * w / 3, y + 36, cx - f * w / 2, y + 6]]).pts.map(p => [...p, .45]))] }; };
  const L = eye(xL, true), R = eye(xR, false);
  return [
    { title: 'One eye-width apart', say: 'The space between two eyes is about one eye wide. Mark 3 equal spaces on a line.', labels: [{ x: 440, y: 450, t: '1 eye-width' }], strokes: [line(240, y, 760, y, .12, '2H'), ...[xL - w / 2, xL + w / 2, xR - w / 2, xR + w / 2].map(x => line(x, y - 20, x, y + 20, .3, 'HB'))] },
    { title: 'Mirror the shapes', say: 'Draw both eyes at the same time, a little on each side, so they match.', strokes: [...L.s, ...R.s] },
    { title: 'Both look the same way', say: 'Put both irises looking in the same direction, or your drawing will look cross-eyed.', strokes: [xL, xR].flatMap(cx => [...hatch([cx - 40, y - 52, cx + 40, y + 28], .7, 3, (X, Y) => Math.hypot(X - cx - 8, Y - y + 18) < 8 ? 0 : (Math.hypot(X - cx, Y - y + 10) < 17 ? 1 : .45), '2B', [{ d: (cx === xL ? L : R).d }, { d: ellD(cx, y - 10, 38, 38) }])]) },
    { title: 'Brows and the nose bridge', say: 'Brows sit above, and the nose bridge sits in the gap. Shade gently beside it.', strokes: [line(xL - 70, y - 70, xL + 60, y - 82, t => .7 - t * .2, '2B'), line(xR - 60, y - 82, xR + 70, y - 70, t => .5 + t * .2, '2B'), ...hatch([455, y - 40, 480, y + 60], Math.PI / 2, 5, () => .25, 'HB'), ...hatch([520, y - 40, 545, y + 60], Math.PI / 2, 5, () => .25, 'HB')] },
  ];
}
function eyeExpressionsLesson() {
  const P = [[200, 'Happy'], [500, 'Sad'], [800, 'Angry']], y = 400;
  return [
    { title: 'Happy', say: 'Cheeks push the lower lid up. Brows relax. Little smile lines at the corner.', labels: [{ x: 160, y: 520, t: 'Happy' }], strokes: [...cEye(200, y, 75, 50, { bot: [.35, .35], iris: .7, brow: [[-.9, -.1], [.9, -.25]] }), line(270, y + 35, 300, y + 50, .5)] },
    { title: 'Sad', say: 'The inside of the brow goes up and the upper lid droops at the outside.', labels: [{ x: 470, y: 520, t: 'Sad' }], strokes: cEye(500, y, 75, 50, { top: [-.6, -.1], py: .4, iris: .7, brow: [[-.9, .2], [.9, -.4]] }) },
    { title: 'Angry', say: 'Brows push down toward the nose, and the lid cuts across the top of the iris.', labels: [{ x: 760, y: 520, t: 'Angry' }], strokes: cEye(800, y, 75, 50, { top: [-.1, -.6], iris: .7, brow: [[-.9, .55], [.9, .05]] }) },
  ];
}
function catEyeLesson() {
  const alm = `M300,380 C360,250 640,250 700,380 C640,500 360,500 300,380 Z`, slit = `M500,268 C540,330 540,430 500,492 C460,430 460,330 500,268 Z`;
  return [
    { title: 'A round almond', say: 'Cat eyes are big and round, tipped up at the outside corner.', strokes: [trace(bez([300, 380], [[360, 250, 640, 250, 700, 380], [640, 500, 360, 500, 300, 380]]).pts, .45, 'HB')] },
    { title: 'Slit pupil', say: 'In bright light a cat pupil is a tall slit, like a lemon seed.', strokes: [trace(bez([500, 268], [[540, 330, 540, 430, 500, 492], [460, 430, 460, 330, 500, 268]]).pts, .5, 'HB'), ...hatch([460, 268, 540, 492], .5, 3, () => 1, '6B', [{ d: slit }])] },
    { title: 'Glowing iris', say: 'Cat irises fill almost the whole eye. Shade darker at the top under the lid, lighter at the bottom so it glows.', strokes: hatch([300, 250, 700, 500], 1.1, 5, (x, y) => clamp(.2 + (430 - y) / 300 + Math.abs(x - 500) / 600), 'HB', [{ d: alm }, { d: `M0,0H1000V750H0Z ${slit}`, rule: 'evenodd' }]) },
    { title: 'Dark rim and catchlight', say: 'A thick dark rim goes all the way around. Lift a sharp catchlight on top of the pupil.', strokes: [trace(bez([300, 380], [[360, 250, 640, 250, 700, 380], [640, 500, 360, 500, 300, 380]]).pts, 1, '6B'), lift(470, 320, 16, 1), ...Array.from({ length: 50 }, (_, i) => { const a = Math.PI + i / 49 * Math.PI, x = 500 + Math.cos(a) * 250, y = 380 + Math.sin(a) * 160; return line(x, y, x + Math.cos(a) * 28, y + Math.sin(a) * 28, t => .5 * (1 - t), 'HB', 5); })] },
  ];
}
function dogEyeLesson() {
  const cx = 500, cy = 380, d = `M330,390 C380,280 620,270 670,370 C630,470 380,480 330,390 Z`;
  return [
    { title: 'Soft almond', say: 'Dog eyes are almond-shaped and look forward.', strokes: [trace(bez([330, 390], [[380, 280, 620, 270, 670, 370], [630, 470, 380, 480, 330, 390]]).pts, .45, 'HB')] },
    { title: 'Big brown iris', say: 'The iris fills most of the eye, so you see only a little white in the corners.', strokes: [...hatch([390, 270, 610, 490], .8, 4, (x, y) => Math.hypot(x - 480, y - 340) < 20 ? 0 : Math.hypot(x - cx, y - cy) < 45 ? 1 : .6, '2B', [{ d }, { d: ellD(cx, cy, 105, 105) }])] },
    { title: 'Rim, fur and catchlight', say: 'A dark rim, then short fur strokes around the eye, and a crisp catchlight.', strokes: [trace(bez([330, 390], [[380, 280, 620, 270, 670, 370], [630, 470, 380, 480, 330, 390]]).pts, .95, '6B'), lift(480, 340, 14, 1), ...Array.from({ length: 160 }, () => { const a = rnd() * TAU, r = 200 + rnd() * 90, x = cx + Math.cos(a) * r * 1.1, y = cy + Math.sin(a) * r * .8; return line(x, y, x + Math.cos(a + .6) * 22, y + Math.sin(a + .6) * 22, t => .45 * (1 - t), 'HB', 5); })] },
  ];
}
function birdEyeLesson() {
  return [
    { title: 'Small round eye', say: 'Bird eyes are round circles on the side of the head.', strokes: [ell(500, 360, 70, 70, .5, 'HB'), trace(bez([260, 520], [[300, 250, 650, 180, 760, 360]]).pts, .2, '2H'), poly([[770, 340], [900, 390], [770, 410]], .45, 'HB')] },
    { title: 'Dark, shiny center', say: 'Most birds have a big dark iris. Leave a catchlight.', strokes: hatch([430, 290, 570, 430], .8, 3, (x, y) => Math.hypot(x - 475, y - 335) < 14 ? 0 : 1, '6B', [{ d: ellD(500, 360, 62, 62) }]) },
    { title: 'Eye ring', say: 'Many birds have a light ring of skin or feathers around the eye. Shade around it, not on it.', strokes: [ell(500, 360, 86, 86, .35, 'HB'), ...Array.from({ length: 140 }, () => { const a = rnd() * TAU, r = 100 + rnd() * 110, x = 500 + Math.cos(a) * r, y = 360 + Math.sin(a) * r; return line(x, y, x - 20, y + 6, .3, 'HB', 4); })] },
  ];
}
function fishEyeLesson() {
  const cx = 480, cy = 360, R = 150;
  return [
    { title: 'Big round eye', say: 'Fish eyes are big, round and glassy. Draw a large circle.', strokes: [ell(cx, cy, R, R, .4, 'HB')] },
    { title: 'The ring', say: 'Fish have a ring (the iris) around a big pupil. Shade it medium, darker at the top.', strokes: hatch([cx - R, cy - R, cx + R, cy + R], .9, 5, (x, y) => .3 + (cy - y) / R * .25, 'HB', [{ d: `${ellD(cx, cy, R, R)} ${ellD(cx + 10, cy + 5, 90, 90)}`, rule: 'evenodd' }]) },
    { title: 'Big dark pupil', say: 'Press hard with a 6B. The pupil is huge and round. Go around the catchlights.', strokes: hatch([cx - 90, cy - 90, cx + 100, cy + 100], -.7, 3, () => 1, '6B', [{ d: `${ellD(cx + 10, cy + 5, 90, 90)} ${ellD(cx - 35, cy - 40, 34, 28)} ${ellD(cx + 55, cy + 55, 12, 12)}`, rule: 'evenodd' }]) },
    { title: 'Glassy shine', say: 'A big catchlight, a small one opposite, and a light curve along the bottom edge make it look wet and glassy.', labels: [{ x: 330, y: 230, t: 'Big catchlight' }, { x: 560, y: 520, t: 'Glassy rim light' }], strokes: [lift(cx + 20, cy + 90, 20, .6), lift(cx + 60, cy + 70, 16, .6), S('lift', '', ell(cx, cy, R - 12, R - 12, .5, '', .3, 1.4).p)] },
    { title: 'Scales around it', say: 'Little overlapping C shapes for scales, darker near the eye.', strokes: Array.from({ length: 90 }, (_, i) => { const a = rnd() * TAU, r = R + 30 + rnd() * 140, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .7; return ell(x, y, 18, 14, .35, 'HB', -1.6, 1.6); }) },
  ];
}
// Storybook eyes: big, glossy, emotional. Inspired by the style of Alvin Adhi, illustrator of be Colorless. Original demos.
function storyFishLesson() {
  const body = bez([180, 380], [[260, 180, 620, 170, 720, 360], [620, 560, 260, 580, 180, 380]]);
  return [
    { title: 'A friendly fish shape', say: 'Start with a lemon shape and a fan tail. Storybook fish look soft and round.', strokes: [trace(body.pts, .35, 'HB'), poly([[720, 360], [860, 250], [830, 370], [860, 480]], .35, 'HB'), trace(bez([420, 230], [[480, 140, 560, 160, 600, 250]]).pts, .3, 'HB')] },
    { title: 'An extra-big eye', say: 'Make the eye much bigger than real life, up near the front. Big eyes look friendly and young.', strokes: cEye(330, 330, 85, 85, { iris: .82, pr: .6, big: true, px: .15 }) },
    { title: 'Two catchlights', say: 'A big shine on top and a small one below make the eye sparkle with feeling.', labels: [{ x: 210, y: 210, t: 'Sparkle!' }], strokes: [ell(300, 300, 4, 4, .2, '2H')] },
    { title: 'Brow and smile', say: 'A tiny raised brow and a soft smile give the fish a personality.', strokes: [line(270, 220, 370, 215, t => .7 - t * .3, '2B'), trace(bez([230, 420], [[250, 450, 290, 450, 310, 430]]).pts, .6, '2B')] },
    { title: 'Soft shading and scales', say: 'Shade the belly and back lightly, then a few C-shaped scales. Keep the eye the most detailed part.', strokes: [...hatch([180, 170, 720, 580], 1.2, 7, (x, y) => clamp((y - 380) / 400 + .15), 'HB', [{ d: body.d }, { d: `M0,0H1000V750H0Z ${ellD(330, 330, 90, 90)}`, rule: 'evenodd' }]), ...Array.from({ length: 30 }, (_, i) => ell(470 + (i % 6) * 38, 300 + Math.floor(i / 6) * 34, 14, 12, .3, 'HB', -1.4, 1.4))] },
  ];
}
function storyKidLesson() {
  return [
    { title: 'A round face', say: 'Storybook kids have round faces with the eyes a little below the middle.', strokes: [ell(500, 380, 220, 210, .3, 'HB'), line(280, 400, 720, 400, .1, '2H')] },
    { title: 'Big, wide-set eyes', say: 'Make tall ovals, set a bit wide. Leave the top of the iris under the lid.', strokes: [...cEye(410, 410, 55, 70, { iris: .85, big: true, px: .15, top: [-.85, -.85] }), ...cEye(590, 410, 55, 70, { iris: .85, big: true, px: .15, top: [-.85, -.85] })] },
    { title: 'Brows tell the feeling', say: 'Curved brows high up look curious and kind.', strokes: [line(350, 310, 450, 300, t => .8 - t * .3, '2B'), line(550, 300, 650, 310, t => .5 + t * .3, '2B')] },
    { title: 'Little details', say: 'A small nose, a smile, and rosy cheeks done with very light pressure.', strokes: [trace(bez([490, 480], [[495, 495, 510, 495, 515, 485]]).pts, .5, 'HB'), trace(bez([450, 520], [[480, 560, 530, 560, 560, 520]]).pts, .6, '2B'), ...hatch([320, 470, 400, 520], .8, 6, () => .15, '2H', [{ d: ellD(360, 495, 40, 22) }]), ...hatch([600, 470, 680, 520], .8, 6, () => .15, '2H', [{ d: ellD(640, 495, 40, 22) }])] },
  ];
}
function cartoonLifeLesson() {
  const ex = [
    ['Happy', { bot: [.3, .3], brow: [[-.9, -.25], [.9, -.25]] }, 'Lower lids push up into a smile shape. Brows float up.'],
    ['Sad', { top: [-.4, .1], py: .5, brow: [[-.9, .1], [.9, -.45]] }, 'Pupils look down. The lid droops on the outside, and the brow tilts up in the middle.'],
    ['Surprised', { pr: .3, iris: .45, brow: [[-.9, -.6], [.9, -.6]] }, 'Wide open, tiny pupils, brows way up high.'],
    ['Sleepy', { top: [.05, .05], py: .6, brow: [[-.9, .3], [.9, .3]] }, 'The top lid comes halfway down and the pupils sink low.'],
    ['Determined', { top: [-.2, -.65], brow: [[-.9, .6], [.9, .1]] }, 'Brows push down toward the middle and the lid cuts across the top. Super-hero face!'],
    ['Cute big eyes', { iris: .85, pr: .6, big: true, lash: true, brow: [[-.6, -.3], [.6, -.3]] }, 'Huge irises and two catchlights. The bigger the eye, the younger and cuter it looks.'],
  ];
  const pos = [[210, 200], [500, 200], [790, 200], [210, 520], [500, 520], [790, 520]];
  const steps = ex.map(([n, o, say], i) => { const [x, y] = pos[i]; return { title: n, say, labels: [{ x: x - 50, y: y + 115, t: n }], strokes: [...cEye(x - 48, y, 40, 52, { ...o, brow: o.brow && [[o.brow[0][0], o.brow[0][1]], [o.brow[1][0], o.brow[1][1]]] }), ...cEye(x + 48, y, 40, 52, { ...o, brow: o.brow && [[-o.brow[1][0], o.brow[1][1]], [-o.brow[0][0], o.brow[0][1]]] })] }; });
  steps.unshift({ title: 'Eyes are the steering wheel of a face', say: 'Change just five things to change the whole feeling: eye shape, eye size, where the pupils point, the catchlights and the eyebrows.', strokes: [] });
  return steps;
}
function cartoonLife2Lesson() {
  const blob = bez([120, 330], [[110, 170, 360, 150, 380, 300], [400, 420, 140, 440, 120, 330]]);
  const fish = bez([560, 300], [[620, 180, 820, 180, 860, 300], [820, 410, 620, 420, 560, 300]]);
  return [
    { title: 'A blob', say: 'Even a blob comes alive with eyes! Close together and looking up = curious.', labels: [{ x: 180, y: 430, t: 'Curious blob' }], strokes: [trace(blob.pts, .45, 'HB'), ...cEye(225, 270, 28, 36, { py: -.5 }), ...cEye(290, 270, 28, 36, { py: -.5 })] },
    { title: 'A fish', say: 'One big storybook eye on the side, two catchlights, a tiny smile.', labels: [{ x: 640, y: 430, t: 'Happy fish' }], strokes: [trace(fish.pts, .45, 'HB'), poly([[860, 300], [950, 240], [935, 300], [950, 360]], .45, 'HB'), ...cEye(650, 280, 40, 40, { iris: .8, big: true, bot: [.45, .45] })] },
    { title: 'A monster', say: 'Monsters can have one giant eye. Angle the lid for a sneaky or determined look.', labels: [{ x: 150, y: 700, t: 'Silly monster' }], strokes: [poly([[100, 680], [110, 500], [160, 460], [330, 460], [380, 500], [390, 680]], .45, 'HB'), poly([[150, 470], [170, 420], [200, 465]], .4, 'HB'), poly([[290, 465], [320, 420], [340, 470]], .4, 'HB'), ...cEye(245, 560, 70, 55, { top: [-.2, -.6], iris: .6, brow: [[-.9, .6], [.9, .1]] })] },
    { title: 'A car', say: 'Cartoon cars wear their eyes on the windshield. Big eyes and a bumper smile, and the car has feelings!', labels: [{ x: 600, y: 700, t: 'Friendly car' }], strokes: [poly([[520, 660], [530, 580], [600, 560], [650, 490], [830, 490], [880, 560], [940, 580], [950, 660]], .45, 'HB'), ell(610, 665, 38, 38, .6, '2B'), ell(860, 665, 38, 38, .6, '2B'), ...cEye(705, 535, 32, 30, { iris: .8, big: true }), ...cEye(780, 535, 32, 30, { iris: .8, big: true }), trace(bez([700, 625], [[730, 645, 790, 645, 820, 625]]).pts, .6, '2B')] },
  ];
}
// ---------- Superhero track (original characters only) ----------
function heroProportionLesson() {
  const hh = 80, top = 30, cx = 500;
  const marks = ['Chin', 'Chest', 'Belly button', 'Hips', 'Mid-thigh', 'Knees', 'Shins', 'Feet'];
  return [
    { title: 'Heroes are 8 heads tall', say: 'Real people are about 7½ heads tall. Heroes are drawn 8 heads tall so they look strong and tall. Stack 8 head-sized ovals.', strokes: Array.from({ length: 8 }, (_, i) => ell(200, top + hh * i + hh / 2, 30, hh / 2, .15, '2H')) },
    { title: 'Mark the landmarks', say: 'Each head length lands on a body part. Draw light lines across.', labels: marks.map((m, i) => ({ x: 790, y: top + hh * (i + 1), t: `${i + 1}: ${m}` })), strokes: Array.from({ length: 9 }, (_, i) => line(260, top + hh * i, 780, top + hh * i, .12, '2H')) },
    { title: 'Wide shoulders', say: 'Hero shoulders are about 2 to 3 heads wide. The waist is narrower, like a V.', strokes: [ell(cx, top + hh / 2, 32, hh / 2, .4, 'HB'), line(cx - 110, top + hh * 1.35, cx + 110, top + hh * 1.35, .4, 'HB'), poly([[cx - 110, top + hh * 1.35], [cx + 110, top + hh * 1.35], [cx + 55, top + hh * 3.6], [cx - 55, top + hh * 3.6]], .35, 'HB')] },
    { title: 'Limbs', say: 'Elbows line up with the belly button, wrists with the hips. Knees sit at 6 heads.', strokes: [line(cx - 110, top + hh * 1.35, cx - 135, top + hh * 3, .4), line(cx - 135, top + hh * 3, cx - 140, top + hh * 4.2, .4), line(cx + 110, top + hh * 1.35, cx + 135, top + hh * 3, .4), line(cx + 135, top + hh * 3, cx + 140, top + hh * 4.2, .4), line(cx - 40, top + hh * 4, cx - 55, top + hh * 6, .4), line(cx - 55, top + hh * 6, cx - 60, top + hh * 7.9, .4), line(cx + 40, top + hh * 4, cx + 55, top + hh * 6, .4), line(cx + 55, top + hh * 6, cx + 60, top + hh * 7.9, .4), ...[[cx - 135, 3], [cx + 135, 3], [cx - 55, 6], [cx + 55, 6]].map(([x, k]) => ell(x, top + hh * k, 9, 9, .4))] },
  ];
}
function heroPoseLesson() {
  const loa = bez([250, 650], [[330, 420, 520, 200, 760, 120]]);
  return [
    { title: 'Line of action', say: 'Start every pose with one big curved line. A curve looks full of energy. A straight line looks stiff.', strokes: [trace(loa.pts, .4, 'HB')] },
    { title: 'Bean body', say: 'Put a bean-shaped chest and hips along the curve, and a head at the top.', strokes: [ell(700, 160, 32, 38, .4, 'HB'), ell(610, 260, 70, 50, .4, 'HB', 0, TAU, -.7), ell(500, 380, 50, 40, .4, 'HB', 0, TAU, -.9)] },
    { title: 'Flying arms and legs', say: 'One fist forward, legs trailing behind. Joints are little circles.', strokes: [line(650, 225, 800, 170, .45), ell(815, 165, 16, 16, .45), line(580, 290, 520, 220, .45), line(520, 220, 470, 250, .45), line(470, 400, 360, 520, .45), line(360, 520, 260, 590, .45), line(520, 410, 430, 560, .45), line(430, 560, 330, 650, .45)] },
    { title: 'Speed lines', say: 'Light, quick lines behind the hero show motion. Lift your pencil at the end of each one.', strokes: Array.from({ length: 8 }, (_, i) => line(330 - i * 10, 300 + i * 30, 120 - i * 10, 420 + i * 30, t => .4 * (1 - t), 'HB')) },
  ];
}
function heroMuscleLesson() {
  const ch = [{ d: ellD(430, 260, 75, 55) }, { d: ellD(570, 260, 75, 55) }], sh = [[330, 220], [670, 220]];
  return [
    { title: 'Muscles are simple shapes', say: 'Chest = two rounded plates. Shoulders = balls. Arms = beans. No need for every muscle!', strokes: [ell(430, 260, 75, 55, .4, 'HB'), ell(570, 260, 75, 55, .4, 'HB'), ...sh.map(([x, y]) => ell(x, y, 50, 50, .4, 'HB')), ell(300, 360, 40, 80, .4, 'HB', 0, TAU, .2), ell(700, 360, 40, 80, .4, 'HB', 0, TAU, -.2), ...[0, 1, 2].flatMap(k => [ell(465, 360 + k * 55, 32, 24, .35), ell(535, 360 + k * 55, 32, 24, .35)])] },
    { title: 'Shade like spheres', say: 'Each muscle is a little sphere: light on the top left, core shadow on the bottom right.', strokes: [...hatch([355, 205, 505, 315], .8, 5, P(sphereDark(430, 260, 75), .15, .7), 'HB', [ch[0]]), ...hatch([495, 205, 645, 315], .8, 5, P(sphereDark(570, 260, 75), .15, .7), 'HB', [ch[1]]), ...sh.flatMap(([x, y]) => hatch([x - 50, y - 50, x + 50, y + 50], .8, 5, P(sphereDark(x, y, 50), .15, .75), '2B', [{ d: ellD(x, y, 50, 50) }]))] },
  ];
}
function heroCostumeLesson() {
  const cape = bez([380, 150], [[300, 350, 260, 550, 180, 700], [330, 660, 480, 720, 620, 690], [700, 520, 660, 330, 620, 150]]);
  return [
    { title: 'A flowing cape', say: 'Capes hang from the shoulders and flow in S-curves. Draw it bigger than you think!', strokes: [trace(cape.pts, .45, 'HB')] },
    { title: 'Folds', say: 'Folds start at the shoulders and spread out. Shade the inside of each fold darker.', strokes: [...[[420, 170, 300, 690], [480, 170, 430, 700], [560, 170, 560, 700]].map(([a, b, c, d]) => line(a, b, c, d, t => .3 + t * .3, '2B')), ...hatch([180, 150, 700, 720], 1.45, 6, (x, y) => ((x + y * .1) % 120) < 45 ? .55 : .15, 'HB', [{ d: cape.d }])] },
    { title: 'Mask', say: 'A mask wraps around the head over the eyes. Add determined cartoon eyes inside it!', strokes: [ell(780, 200, 90, 105, .35, 'HB'), poly([[690, 190], [870, 190], [860, 240], [790, 230], [770, 230], [700, 240]], .6, '2B'), ...cEye(750, 210, 24, 14, { cl: false, iris: .01, pr: .01, top: [-.1, -.7] }), ...cEye(810, 210, 24, 14, { cl: false, iris: .01, pr: .01, top: [-.7, -.1] })] },
    { title: 'Your emblem', say: 'Design a simple emblem: a shape (shield, diamond or circle) with a symbol inside, like a bolt or a star. Simple is stronger!', strokes: [poly([[780, 420], [880, 460], [860, 580], [780, 640], [700, 580], [680, 460]], .5, 'HB'), poly([[800, 450], [750, 540], [790, 540], [760, 610], [830, 510], [790, 510]], .7, '2B')] },
  ];
}

export const LEVELS = [
  { id: 'warm', name: 'Level 1 · Pencil Control', color: '#7dd3fc' },
  { id: 'see', name: 'Level 2 · Learning to See', color: '#a78bfa' },
  { id: 'form', name: 'Level 3 · Shapes into Forms', color: '#34d399' },
  { id: 'subjects', name: 'Level 4 · Real Subjects', color: '#fbbf24' },
  { id: 'eyes', name: 'Level 5 · The Eyes Course', color: '#f472b6' },
  { id: 'space', name: 'Level 6 · Perspective', color: '#f87171' },
  { id: 'hero', name: 'Level 7 · Design Your Own Superhero', color: '#60a5fa' },
];
const mk = (id, level, title, emoji, minutes, build, extra = {}) => ({ id, level, title, emoji, minutes, build, ...extra });
export const LESSONS = [
  mk('value', 'warm', 'The 7-Step Value Scale', '🎚️', 15, valueScaleLesson, { exercise: { text: 'Now draw a 7-step value scale on your paper.', check: ['Box 1 is plain white paper', 'Each box is a little darker than the one before', 'No two boxes look the same', 'Box 7 is as dark as your pencil can go'] } }),
  mk('gradient', 'warm', 'Smooth Light to Dark', '🌗', 10, gradientLesson, { exercise: { text: 'Shade one long smooth gradient bar on your paper.', check: ['No hard lines between light and dark', 'One end is white, the other is very dark', 'You blended from light to dark'] } }),
  mk('marks', 'warm', 'Hatching, Stippling & Blending', '✏️', 15, techniquesLesson, { exercise: { text: 'Make 5 boxes and fill each one with a different technique.', check: ['Hatching lines are parallel', 'Cross-hatching gets darker with each layer', 'Stipple dots are dots, not dashes', 'Blended box is smooth'] } }),
  mk('texture', 'warm', 'Textures: Wood, Fur, Stone, Grass', '🪵', 15, textureLesson, { exercise: { text: 'Draw 4 squares and fill each with a texture.', check: ['Wood lines curve around a knot', 'Fur strokes flick off light', 'Each stone has a shadow side', 'Grass is darker at the bottom'] } }),
  mk('blind', 'see', 'Blind Contour Drawing', '🙈', 10, blindContourLesson, { exercise: { text: 'Do 3 blind contour drawings of your hand or a leaf. Don\'t peek!', check: ['You looked at the object, not the paper', 'You drew slowly, in one line', 'You did 3 tries'], minutes: 3 } }),
  mk('upside', 'see', 'Upside-Down Drawing', '🙃', 20, upsideDownLesson, { upside: true, exercise: { text: 'Copy the upside-down picture on your paper, then flip it over.', check: ['You kept the picture upside down the whole time', 'You copied lines and angles, not "eyes" or "ears"', 'You flipped it at the end'] } }),
  mk('negative', 'see', 'Negative Space', '🪑', 10, negativeSpaceLesson, { exercise: { text: 'Find a chair or a mug. Shade only the empty spaces around it.', check: ['You drew the gaps, not the object', 'The object came out white', 'The gap shapes match what you see'] } }),
  mk('measure', 'see', 'Measure with Your Pencil', '📏', 10, measuringLesson, { exercise: { text: 'Measure a real bottle or cup with your pencil and draw it.', check: ['Arm was straight and one eye closed', 'You counted how many widths tall it is', 'Your drawing has the same count'] } }),
  mk('sphere', 'form', 'Shade a Sphere (5 Elements of Shading)', '⚪', 20, sphereLesson, { exercise: { text: 'Shade a sphere with all 5 parts of light and shadow.', check: ['Highlight', 'Mid-tone', 'Core shadow', 'Reflected light', 'Cast shadow'] } }),
  mk('cube', 'form', 'Shade a Cube', '🧊', 15, cubeLesson, { exercise: { text: 'Draw and shade a cube. Three faces, three different values.', check: ['Top, front and side are different values', 'Cast shadow points away from the light', 'Edges are crisp'] } }),
  mk('cylinder', 'form', 'Shade a Cylinder', '🥫', 15, cylinderLesson, { exercise: { text: 'Draw a cylinder (a can is a great model) and shade it.', check: ['Bottom ellipse is curved, not flat', 'Shading goes in stripes up and down', 'Reflected light on the dark edge'] } }),
  mk('cone', 'form', 'Shade a Cone', '🍦', 15, coneLesson, { exercise: { text: 'Draw and shade a cone.', check: ['Strokes point toward the tip', 'Bottom is a curve', 'Cast shadow is pointy'] } }),
  mk('apple', 'subjects', 'A Realistic Apple', '🍎', 25, appleLesson, { exercise: { text: 'Put a real apple near a lamp and draw it!', check: ['Shape is wider at the top', 'Dark core shadow on one side', 'Shiny highlight', 'Cast shadow under it'] } }),
  mk('tree', 'subjects', 'A Realistic Tree', '🌳', 25, treeLesson, { exercise: { text: 'Draw a tree, from outside or a photo.', check: ['Leaf clumps, not single leaves', 'Darker under each clump', 'Bark lines go up and down', 'Shadow on the ground'] } }),
  mk('cat', 'subjects', 'A Sitting Cat', '🐈', 25, catLesson, { exercise: { text: 'Draw a cat or dog using shapes first.', check: ['Started with circle and pear shapes', 'Fur strokes follow the body', 'Shadow side is darker'] } }),
  mk('car', 'subjects', 'A Car', '🚗', 25, carLesson, { exercise: { text: 'Draw a car from the side.', check: ['Started with two boxes', 'Tires are the darkest', 'White reflections in the windows', 'Shadow under the car'] } }),
  mk('face', 'subjects', 'A Face in Proportion', '🙂', 25, faceLesson, { exercise: { text: 'Draw a face from the front using the guidelines.', check: ['Eyes are halfway down the head', 'Five eyes wide', 'Nose halfway between eyes and chin', 'Ears line up with brows and nose'] } }),
  mk('eyeball', 'eyes', 'How an Eye Is Built', '🔵', 15, eyeStructureLesson, { exercise: { text: 'Draw the eyeball as a ball, then wrap the lids around it.', check: ['Started with a light circle', 'Top lid curves more than the bottom', 'You drew the tear duct and lid thickness', 'Shadow under the top lid'] } }),
  mk('eye', 'eyes', 'A Realistic Eye: Front View', '👁️', 25, eyeLesson, { exercise: { text: 'Draw an eye. Look in a mirror for help!', check: ['Iris tucks under the top lid', 'Reflection left white', 'Lashes curve outward', 'Eye white is lightly shaded'] } }),
  mk('eye34', 'eyes', 'Eye in 3/4 View', '👀', 20, threeQuarterEyeLesson, { exercise: { text: 'Draw an eye turned to the side.', check: ['Almond is lopsided', 'Iris is an oval', 'Catchlight left white', 'Far lashes are shorter'] } }),
  mk('eyepair', 'eyes', 'A Pair of Eyes', '👁️👁️', 20, eyePairLesson, { exercise: { text: 'Draw two eyes one eye-width apart.', check: ['Gap is one eye wide', 'Both eyes match in size', 'Both look the same way', 'Brows sit above'] } }),
  mk('eyeexp', 'eyes', 'Eye Expressions', '😊', 15, eyeExpressionsLesson, { exercise: { text: 'Draw happy, sad and angry eyes.', check: ['Happy: lower lid pushed up', 'Sad: brows up in the middle', 'Angry: brows pushed down'] } }),
  mk('cateye', 'eyes', 'Cat Eyes', '🐱', 15, catEyeLesson, { exercise: { text: 'Draw a cat eye with a slit pupil.', check: ['Slit pupil is very dark', 'Iris glows lighter at the bottom', 'Thick dark rim', 'Catchlight'] } }),
  mk('dogeye', 'eyes', 'Dog Eyes', '🐶', 15, dogEyeLesson, { exercise: { text: 'Draw a dog eye with fur around it.', check: ['Big brown iris', 'Little white showing', 'Fur strokes go outward'] } }),
  mk('birdeye', 'eyes', 'Bird Eyes', '🐦', 10, birdEyeLesson, { exercise: { text: 'Draw a bird head with a shiny eye.', check: ['Round eye', 'Catchlight', 'Light eye ring'] } }),
  mk('fisheye', 'eyes', 'Fish Eyes', '🐟', 20, fishEyeLesson, { exercise: { text: 'Draw a big glassy fish eye.', check: ['Big round eye', 'Ring around the pupil', 'Huge dark pupil', 'Big catchlight plus a small one', 'Scales around it'] } }),
  mk('storyfish', 'eyes', 'Storybook Eyes: A Friendly Fish', '🐠', 20, storyFishLesson, { credit: 'Inspired by the style of Alvin Adhi, illustrator of be Colorless. Original demo.', exercise: { text: 'Draw your own storybook fish with big sparkly eyes.', check: ['Eye is extra big', 'Two catchlights', 'A brow or smile shows a feeling', 'Eye is the most detailed part'] } }),
  mk('storykid', 'eyes', 'Storybook Eyes: A Kid Character', '🧒', 20, storyKidLesson, { credit: 'Inspired by the style of Alvin Adhi, illustrator of be Colorless. Original demo.', exercise: { text: 'Draw a storybook kid with big, kind eyes.', check: ['Eyes a little below the middle', 'Tall ovals with big irises', 'Brows show the feeling'] } }),
  mk('cartoonlife', 'eyes', 'Bring Any Cartoon to Life', '✨', 25, cartoonLifeLesson, { exercise: { text: 'Draw all 6 expressions: happy, sad, surprised, sleepy, determined and cute.', check: ['Changed the eye shape', 'Moved the pupils', 'Used catchlights', 'Brows match the feeling'] } }),
  mk('cartoonlife2', 'eyes', 'Capstone Challenge: Eyes on Everything', '🏆', 30, cartoonLife2Lesson, { exercise: { text: 'Put cool eyes on a blob, a fish, a monster and a car. Then add eyes to your own cartoon character!', check: ['Blob', 'Fish', 'Monster', 'Car', 'My own cartoon'], minutes: 20 } }),
  mk('onept', 'space', '1-Point Perspective Road', '🛣️', 25, onePointLesson, { exercise: { text: 'Draw a road going into the distance.', check: ['One vanishing point on the horizon', 'Things get smaller far away', 'Far mountains are lighter'] } }),
  mk('twopt', 'space', '2-Point Perspective Building', '🏢', 25, twoPointLesson, { exercise: { text: 'Draw a building corner with two vanishing points.', check: ['Two dots on the horizon', 'Vertical lines stay vertical', 'Windows aim at the vanishing points'] } }),
  mk('hero8', 'hero', 'Hero Proportions: 8 Heads Tall', '📐', 20, heroProportionLesson, { exercise: { text: 'Draw an 8-head hero figure with landmarks.', check: ['8 head-lengths tall', 'Shoulders 2 to 3 heads wide', 'Knees at 6 heads', 'V-shaped torso'] } }),
  mk('heropose', 'hero', 'Dynamic Hero Poses', '🦸', 20, heroPoseLesson, { exercise: { text: 'Draw a flying hero and a landing hero, starting with a line of action.', check: ['Started with a curved line of action', 'Bean shapes for the body', 'Joints as circles', 'Speed lines'] } }),
  mk('heromuscle', 'hero', 'Simple Hero Muscles', '💪', 20, heroMuscleLesson, { exercise: { text: 'Draw a hero chest and arms with simple muscle shapes.', check: ['Simple shapes, not every muscle', 'Shaded like little spheres', 'Light from one side'] } }),
  mk('herocostume', 'hero', 'Capes, Masks & Emblems', '🦹', 25, heroCostumeLesson, { exercise: { text: 'Design YOUR superhero: name, cape, mask, emblem, and determined cartoon eyes!', check: ['Hero has a name', 'Cape flows in S-curves', 'Mask with determined eyes', 'Simple emblem', 'Drawn 8 heads tall'], minutes: 25 } }),
];
export function buildLesson(l) { seed = 7 + l.id.length * 31; return l.build(); }
export const UPSIDE_SOURCE = 'cat';
