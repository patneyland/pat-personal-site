/**
 * Cuts one drawn figure into limbs so it can be animated by rotation.
 *
 *   node scripts/dev/rig.mjs
 *
 * The pipeline's real answer to a walk cycle is to draw one: six frames in
 * Krita, out through `npm run sprites`, done. This is the other answer, for
 * when there is one drawing and no time to make five more. It splits the ink
 * into body, two arms and two legs, records a pivot for each, and writes paths
 * that a page can rotate about those pivots.
 *
 * It is worth being honest about the trade. Rotating a limb is not the same as
 * drawing it in a new position: the line keeps its original thickness and
 * curve, so the figure moves more evenly, and more mechanically, than Patrick
 * would draw it. It buys motion today without spending the drawing.
 *
 * The cuts are measured off this one figure, in its own pixel coordinates.
 * Another figure needs its own entry, because a rig is a claim about where the
 * joints are and only the drawing can tell you that.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const EPS = 0.7;
const MIN_AREA = 6;

const RIG = {
  source: "art/scan-01/figure-smiling-arms-out.png",
  out: "art/traced/gary-rig.json",

  /* Read off the ink profile of this drawing. The arms are one stroke crossing
     the torso, so "arm" is a horizontal band with the torso column removed;
     the legs already sit in a stride, so they only need splitting down the
     middle. Each limb reaches a few px past its joint so a rotation cannot
     open a gap at the shoulder or hip. */
  shoulder: [84, 219],
  hip: [86, 333],
  armBand: [203, 237], // rows the arm stroke occupies
  armGapL: 80, // arm ink is left of this
  armGapR: 90, // ...or right of this
  legTop: 327, // rows below this are legs
  legSplit: 87, // left leg is left of this
  joint: 8, // radius of the patch that keeps a joint filled
};

/* ── trace (same method as scripts/dev/trace.mjs) ─────────────────────── */
function contours(bits, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bits[y * w + x]);
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const open = (x, y, dir) => {
    if (dir === 0) return at(x, y - 1) === 1 && at(x, y) === 0;
    if (dir === 1) return at(x, y) === 1 && at(x - 1, y) === 0;
    if (dir === 2) return at(x - 1, y) === 1 && at(x - 1, y - 1) === 0;
    return at(x - 1, y - 1) === 1 && at(x, y - 1) === 0;
  };
  const used = new Uint8Array((w + 1) * (h + 1) * 4);
  const edge = (x, y, d) => (y * (w + 1) + x) * 4 + d;
  const loops = [];
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      for (let d = 0; d < 4; d++) {
        if (!open(x, y, d) || used[edge(x, y, d)]) continue;
        const loop = [];
        let cx = x;
        let cy = y;
        let dir = d;
        while (!used[edge(cx, cy, dir)]) {
          used[edge(cx, cy, dir)] = 1;
          loop.push([cx, cy]);
          cx += DX[dir];
          cy += DY[dir];
          let next = -1;
          for (const c of [(dir + 3) % 4, dir, (dir + 1) % 4, (dir + 2) % 4]) {
            if (open(cx, cy, c)) { next = c; break; }
          }
          if (next === -1) break;
          dir = next;
        }
        if (loop.length > 3) loops.push(loop);
      }
    }
  }
  return loops;
}

function area(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return a / 2;
}

function simplify(points, eps) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    const [ax, ay] = points[lo];
    const [bx, by] = points[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1;
    let best = eps;
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = points[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > best) { best = d; far = i; }
    }
    if (far === -1) continue;
    keep[far] = 1;
    stack.push([lo, far], [far, hi]);
  }
  return points.filter((_, i) => keep[i]);
}

function toPath(poly, round = 2) {
  const n = poly.length;
  const f = (v) => Number(v.toFixed(round));
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(poly[n - 1], poly[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const c = poly[i];
    const m = mid(poly[i], poly[(i + 1) % n]);
    d += `Q${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

function traceMask(bits, w, h) {
  const loops = contours(bits, w, h)
    .filter((p) => Math.abs(area(p)) >= MIN_AREA)
    .map((p) => simplify(p, EPS))
    .filter((p) => p.length > 3);
  return loops.map((p) => toPath(p)).join("");
}

/* ── Run ──────────────────────────────────────────────────────────────── */
const src = path.resolve(ROOT, RIG.source);
const { data, info } = await sharp(src).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) ink[i] = data[i * 4 + 3] >= 100 ? 1 : 0;

const [aTop, aBot] = RIG.armBand;
const inArmBand = (y) => y >= aTop && y <= aBot;

const part = (test) => {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ink[y * W + x] && test(x, y)) m[y * W + x] = 1;
    }
  }
  return m;
};

const armL = part((x, y) => inArmBand(y) && x < RIG.armGapL);
const armR = part((x, y) => inArmBand(y) && x > RIG.armGapR);
const legL = part((x, y) => y > RIG.legTop && x <= RIG.legSplit);
const legR = part((x, y) => y > RIG.legTop && x > RIG.legSplit);

/* the body is what is left, plus a patch over each joint so that when a limb
   swings away the shoulder or hip is not a hole */
const near = (x, y, [px, py]) => (x - px) ** 2 + (y - py) ** 2 <= RIG.joint ** 2;
const body = part(
  (x, y) =>
    (!armL[y * W + x] && !armR[y * W + x] && !legL[y * W + x] && !legR[y * W + x]) ||
    near(x, y, RIG.shoulder) ||
    near(x, y, RIG.hip),
);

const parts = { body, "arm-left": armL, "arm-right": armR, "leg-left": legL, "leg-right": legR };
const out = {
  source: RIG.source,
  canvas: [W, H],
  pivots: { shoulder: RIG.shoulder, hip: RIG.hip },
  parts: {},
};

for (const [name, mask] of Object.entries(parts)) {
  let n = 0;
  for (let i = 0; i < W * H; i++) n += mask[i];
  out.parts[name] = { ink: n, d: traceMask(mask, W, H) };
  console.log(`  ${name.padEnd(11)} ${String(n).padStart(5)} ink px  ${(out.parts[name].d.length / 1024).toFixed(1)} KB`);
}

let total = 0;
for (let i = 0; i < W * H; i++) total += ink[i];
const covered = Object.values(out.parts).reduce((s, p) => s + p.ink, 0);
console.log(`\nfigure ink ${total}, parts cover ${covered} (joint patches overlap on purpose)`);

await fs.mkdir(path.dirname(path.resolve(ROOT, RIG.out)), { recursive: true });
await fs.writeFile(path.resolve(ROOT, RIG.out), JSON.stringify(out, null, 1));
console.log(`-> ${RIG.out}`);
