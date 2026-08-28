/**
 * Traces the extracted drawings into SVG paths.
 *
 *   node scripts/dev/trace.mjs art/scan-02 art/traced/scan-02.json
 *
 * The scans are 200 DPI over a small sketchbook page, so the landscape is only
 * about 1160 px wide. That is fine at 1x and short on a retina screen. Tracing
 * the pencil into outlines makes the size question go away: the drawing becomes
 * resolution independent, and a stroke is then a filled shape that takes its
 * colour from `fill`, exactly like the alpha masks did.
 *
 * How it works, and why each step is there.
 *
 *   1. Threshold the soft alpha into a hard region. Pencil is antialiased and
 *      the trace needs a definite edge. Everything after this is geometry.
 *
 *   2. Marching squares along the boundary between filled and empty, walking
 *      cell to cell, produces closed polygons in half pixel corner coordinates.
 *      Outer edges and the holes inside them both come out; winding tells them
 *      apart and `fill-rule: evenodd` renders them correctly without the tracer
 *      having to know which is which.
 *
 *   3. Ramer Douglas Peucker drops the pixel staircase. Epsilon is in pixels,
 *      so it is a real tolerance rather than a magic number.
 *
 *   4. Emit quadratic curves through the midpoints of the simplified polygon.
 *      Corners get rounded by exactly the amount the polygon was simplified by,
 *      which on a pencil line is what you want: it puts the wobble back.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

const EPS = 0.7; // px of simplification tolerance
const MIN_AREA = 6; // drop traced loops smaller than this many px, ie dirt

/* Where the stroke edge is, per drawing. A fixed cut cannot serve both: at 100
   the house is perfect and the faint clouds shatter into confetti, because a
   lightly drawn cloud never reaches an alpha the house hits everywhere.

   The median of the inked pixels is what separates them, and it separates them
   by a mile: a firmly drawn house or figure sits at 255, a cloud drawn with the
   side of the pencil sits near 65. A high percentile does not work, because the
   faintest cloud still has a few dark specks in it. */
function strokeCut(alpha) {
  const lit = [];
  for (const a of alpha) if (a > 8) lit.push(a);
  if (!lit.length) return 100;
  lit.sort((a, b) => a - b);
  const median = lit[lit.length >> 1];
  return Math.min(100, Math.max(26, Math.round(median * 0.45)));
}

/* ── Boundary walk ────────────────────────────────────────────────────────
   Contours run along the grid *between* pixels, so a boundary never cuts
   through one. From a corner there are four edges you could leave along, and
   an edge is on the contour when it has ink on one side and paper on the
   other. Walking with the ink always on the left closes every loop.

   Each of the four directed edges at a corner is consumed at most once, so the
   walk is bounded by the edge count and cannot spin. Doing it edge wise rather
   than cell wise is also what makes the two ambiguous diagonal cases harmless:
   the turn preference below resolves them the same way every time. */
function contours(bits, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bits[y * w + x]);

  // 0 right, 1 down, 2 left, 3 up
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];

  /* ink on the left of travel, paper on the right */
  const open = (x, y, dir) => {
    if (dir === 0) return at(x, y - 1) === 1 && at(x, y) === 0;
    if (dir === 1) return at(x, y) === 1 && at(x - 1, y) === 0;
    if (dir === 2) return at(x - 1, y) === 1 && at(x - 1, y - 1) === 0;
    return at(x - 1, y - 1) === 1 && at(x, y - 1) === 0;
  };

  const used = new Uint8Array((w + 1) * (h + 1) * 4);
  const edge = (x, y, dir) => (y * (w + 1) + x) * 4 + dir;
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

          /* hug the ink: try the tightest turn first, straight on next */
          let next = -1;
          for (const cand of [(dir + 3) % 4, dir, (dir + 1) % 4, (dir + 2) % 4]) {
            if (open(cx, cy, cand)) {
              next = cand;
              break;
            }
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

/* signed area, both to drop specks and to keep winding meaningful */
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
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far === -1) continue;
    keep[far] = 1;
    stack.push([lo, far], [far, hi]);
  }
  return points.filter((_, i) => keep[i]);
}

/* Quadratic through midpoints: each original vertex becomes a control point and
   the curve passes through the midpoints between them. Closed, smooth, and half
   the coordinates of a cubic. */
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

async function traceFile(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];

  const cut = strokeCut(alpha);
  const bits = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bits[i] = alpha[i] >= cut ? 1 : 0;

  const loops = contours(bits, w, h)
    .filter((p) => Math.abs(area(p)) >= MIN_AREA)
    .map((p) => simplify(p, EPS))
    .filter((p) => p.length > 3);

  /* the ink bounds, not the canvas bounds. Placing a prop in a scene means
     knowing where its ink actually starts, and the transparent margin the cut
     left around it is not part of the drawing. */
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of loops) {
    for (const [x, y] of p) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!loops.length) [x0, y0, x1, y1] = [0, 0, w, h];

  return {
    width: w,
    height: h,
    cut,
    box: [x0, y0, +(x1 - x0).toFixed(2), +(y1 - y0).toFixed(2)],
    d: loops.map((p) => toPath(p)).join(""),
  };
}

/* ── Run ──────────────────────────────────────────────────────────────── */
const [inDir, outFile] = process.argv.slice(2);
if (!inDir || !outFile) {
  console.error("usage: node scripts/dev/trace.mjs <scan-dir> <out.json>");
  process.exit(1);
}

const dir = path.resolve(ROOT, inDir);
const names = (await fs.readdir(dir))
  .filter((f) => f.endsWith(".png"))
  .sort();

const out = {};
for (const f of names) {
  const key = f.replace(/\.png$/, "");
  const traced = await traceFile(path.join(dir, f));
  out[key] = traced;
  const kb = (traced.d.length / 1024).toFixed(1);
  console.log(`  ${key.padEnd(24)} ${traced.width}x${traced.height}  cut ${String(traced.cut).padStart(3)}  ${kb} KB`);
}

await fs.mkdir(path.dirname(path.resolve(ROOT, outFile)), { recursive: true });
await fs.writeFile(path.resolve(ROOT, outFile), JSON.stringify(out, null, 1));
console.log(`\n${names.length} traced -> ${outFile}`);
