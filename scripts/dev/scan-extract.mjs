/**
 * Cuts the individual drawings out of a flatbed scan of a sketchbook page.
 *
 *   node scripts/dev/scan-extract.mjs EPSON001.PDF art/scan-01
 *   node scripts/dev/scan-extract.mjs EPSON002.JPG art/scan-02
 *
 * Krita is the normal way in (docs/character-pipeline.md). This is the other
 * way in: paper, pencil, Epson. It produces the same kind of file the rest of
 * the pipeline already eats, an RGBA PNG whose alpha carries the ink and whose
 * RGB is zero, so it works as a CSS mask on any page background.
 *
 * Four problems have to be solved, in this order.
 *
 *   1. The scanner PDF is a wrapper. One DCTDecode image, full resolution, no
 *      recompression needed. Pull the JPEG out byte for byte rather than
 *      rasterising the page, which would need poppler or ghostscript and would
 *      resample the scan for no reason.
 *
 *   2. Paper is not white and pencil is not black. Both drift across the page,
 *      so a single global threshold either eats light strokes or keeps grain.
 *      A local max filter estimates what the paper is at each pixel, and ink
 *      alpha is how far below its own local paper a pixel sits. Soft, so the
 *      pencil edge survives instead of turning into a jaggy stencil.
 *
 *   3. A landscape page draws one ground line under everything. House, tree and
 *      flag all touch it, so components alone return the whole scene as a
 *      single blob. The ground is found as the one long near horizontal stroke
 *      spanning most of the page, lifted out, and shipped as its own piece.
 *
 *   4. A drawing is still not one component: eyes and a mouth float free inside
 *      a head outline, a window floats inside a house. Grouping by containment
 *      fixes that without dilating enough to weld neighbouring drawings
 *      together, which a large dilation always does.
 *
 * PAGES is per scan, keyed by file name. Rotation is per page because the
 * sheets went through the scanner whichever way round they went through. NAMES
 * is a lookup by where a drawing sits on the page: the geometry is stable, the
 * order components come out in is not. Run a new page with no names and the
 * script prints the coordinates to paste back in.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

const DEFAULTS = {
  rotate: 0,
  noise: 10, // gap from local paper below which it is grain, not graphite
  full: 85, // gap at which a stroke is fully opaque
  seed: 40, // alpha a pixel needs to count as ink for grouping
  close: 3, // dilation that closes stroke breaks, small enough not to weld
  speck: 30, // components under this many ink pixels are scanner dirt
  piece: 250, // groups under this many ink pixels are not drawings
  pad: 10, // transparent margin left around each cut
  ground: false, // lift a full width ground line before grouping
  names: {},
};

const PAGES = {
  /* Sketchbook page of Gary: four expression heads and six figures. Darker
     pencil than the landscapes, and nothing touches anything. */
  "EPSON001.PDF": {
    crop: { left: 0, top: 150, width: 790, height: 1150 },
    names: {
      "61,363": "face-grin",
      "63,533": "face-neutral",
      "61,711": "face-unsure",
      "70,900": "face-surprised",
      "259,221": "figure-smiling-arms-out",
      "474,221": "figure-blank-arms-out",
      "318,612": "figure-small-left",
      "399,609": "figure-small-right",
      "547,620": "figure-head-on-stalk",
      "341,782": "figure-waving",
    },
  },

  /* The landscape: house, tree, flag, clouds, cactus, all on one ground line.
     Light pencil on paper the scanner has already clipped to pure white, so
     the thresholds run far lower than page 1. */
  "EPSON002.JPG": {
    rotate: 90,
    crop: { left: 90, top: 4, width: 1160, height: 780 },
    noise: 6,
    full: 55,
    seed: 22,
    speck: 20,
    piece: 120,
    ground: true,
    /* the leftmost cloud is drawn too faintly to survive as its own prop: its
       outline breaks into arcs at any threshold that does not also pull in the
       paper edge. It is in _page.png. Redraw it darker to get it as a piece. */
    names: {
      "108,291": "tree",
      "288,236": "house",
      "307,97": "cloud-mid",
      "563,132": "cloud-right",
      "567,274": "flag",
      "1010,434": "cactus-barrel",
      "1069,309": "cactus-saguaro",
    },
  },

  /* Mountains, ramps, a ring of fire and a rider. Same ground line. */
  "EPSON003.JPG": {
    rotate: -90,
    crop: { left: 35, top: 12, width: 1170, height: 770 },
    noise: 6,
    full: 55,
    seed: 22,
    speck: 20,
    piece: 120,
    ground: true,
    /* the two peaks overlap on the page, so they come out as one piece. That
       is also the unit you would place, so it is left alone. */
    names: {
      "60,274": "mountains",
      "714,486": "ramp-left",
      "814,337": "ring-of-fire",
      "904,490": "ramp-right",
      "1007,446": "rider",
    },
  },

  /* Climbing studies: a ladder, a pole, and Gary on both. No ground line. */
  "EPSON004.JPG": {
    rotate: -90,
    crop: { left: 60, top: 12, width: 1170, height: 770 },
    noise: 6,
    full: 55,
    seed: 22,
    speck: 20,
    piece: 120,
    /* Gary grips the pole, so he and it are one piece. Cutting them apart
       would take erasing his hands, which is a drawing decision, not a build
       one. */
    names: {
      "75,138": "ladder",
      "313,456": "figure-climbing",
      "492,260": "pole-with-figure",
    },
  },
};

/* ── The scan ─────────────────────────────────────────────────────────────
   An Epson PDF is one JPEG in a thin PDF shell. Take the stream whole: the
   markers bound it exactly and nothing is re-encoded. */
async function readScan(file) {
  if (!/\.pdf$/i.test(file)) return fs.readFile(file);

  const pdf = await fs.readFile(file);
  const soi = pdf.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  const eoi = pdf.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (soi < 0 || eoi < soi) throw new Error(`no JPEG stream in ${file}`);
  return pdf.subarray(soi, eoi + 2);
}

/* ── Ink ──────────────────────────────────────────────────────────────────
   Separable max filter. Radius has to beat the widest stroke, or the middle
   of a thick line reads as its own paper and comes out hollow. */
function separable(input, w, h, r, pick) {
  const pass = (src, dst, along) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let d = -r; d <= r; d++) {
          const sx = along ? x + d : x;
          const sy = along ? y : y + d;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          acc = pick(acc, src[sy * w + sx]);
        }
        dst[y * w + x] = acc;
      }
    }
  };
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  pass(input, tmp, true);
  pass(tmp, out, false);
  return out;
}

const localPaper = (src, w, h, r) => separable(src, w, h, r, Math.max);
const dilate = (mask, w, h, r) => separable(mask, w, h, r, (a, b) => (a || b ? 1 : 0));

/* Erode along x only. A stroke survives only where it runs horizontally for
   `len` pixels, which is the ground line and almost nothing else. */
function horizontalRuns(mask, w, h, len) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run = mask[y * w + x] ? run + 1 : 0;
      if (run >= len) for (let k = 0; k < run; k++) out[y * w + x - k] = 1;
    }
  }
  return out;
}

/* ── Components ───────────────────────────────────────────────────────── */
function components(mask, ink, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  const found = [];

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      if (!mask[sy * w + sx] || label[sy * w + sx] !== -1) continue;

      const id = found.length;
      const box = { id, x0: sx, y0: sy, x1: sx, y1: sy, ink: 0 };
      let head = 0;
      let tail = 0;
      qx[tail] = sx;
      qy[tail] = sy;
      tail++;
      label[sy * w + sx] = id;

      while (head < tail) {
        const x = qx[head];
        const y = qy[head];
        head++;

        /* the box is measured on real ink, never on the dilated skin, or every
           box grows by the closing radius and the cuts stop being tight */
        if (ink[y * w + x]) {
          box.ink++;
          if (x < box.x0) box.x0 = x;
          if (x > box.x1) box.x1 = x;
          if (y < box.y0) box.y0 = y;
          if (y > box.y1) box.y1 = y;
        }

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (!mask[n] || label[n] !== -1) continue;
            label[n] = id;
            qx[tail] = nx;
            qy[tail] = ny;
            tail++;
          }
        }
      }
      if (box.ink) found.push(box);
    }
  }
  return { label, found };
}

/* A drawing is one big component plus whatever floats inside it. Eyes sit in a
   head, a window sits in a house. Nothing on these pages contains a neighbour,
   which is the property a dilation big enough to reach those eyes destroys. */
function groupByContainment(boxes, slack = 6) {
  const parent = new Map(boxes.map((b) => [b.id, b.id]));
  const find = (a) => {
    while (parent.get(a) !== a) {
      parent.set(a, parent.get(parent.get(a)));
      a = parent.get(a);
    }
    return a;
  };
  const area = (b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);

  for (const inner of boxes) {
    for (const outer of boxes) {
      if (inner.id === outer.id || area(inner) >= area(outer)) continue;
      const within =
        inner.x0 >= outer.x0 - slack &&
        inner.x1 <= outer.x1 + slack &&
        inner.y0 >= outer.y0 - slack &&
        inner.y1 <= outer.y1 + slack;
      if (!within) continue;
      const a = find(inner.id);
      const b = find(outer.id);
      if (a !== b) parent.set(a, b);
    }
  }

  const groups = new Map();
  for (const b of boxes) {
    const key = find(b.id);
    const g =
      groups.get(key) ??
      { members: new Set(), x0: Infinity, y0: Infinity, x1: -1, y1: -1, ink: 0 };
    g.members.add(b.id);
    g.x0 = Math.min(g.x0, b.x0);
    g.y0 = Math.min(g.y0, b.y0);
    g.x1 = Math.max(g.x1, b.x1);
    g.y1 = Math.max(g.y1, b.y1);
    g.ink += b.ink;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/* Writes an RGBA PNG whose alpha is `alphaAt(x, y)` and whose RGB is zero, so
   it masks to whatever colour the page is already using. */
async function writeMask(file, x0, y0, w, h, alphaAt) {
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) px[(y * w + x) * 4 + 3] = alphaAt(x0 + x, y0 + y);
  }
  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
}

/* ── Run ──────────────────────────────────────────────────────────────── */
const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("usage: node scripts/dev/scan-extract.mjs <scan.pdf|jpg> <out-dir>");
  process.exit(1);
}

const page = { ...DEFAULTS, ...(PAGES[path.basename(input)] ?? {}) };
if (!page.crop) throw new Error(`no PAGES entry for ${path.basename(input)}`);

const out = path.resolve(ROOT, outDir);
const source = await readScan(path.resolve(ROOT, input));
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, `page${path.extname(input).toLowerCase().replace(".pdf", ".jpg")}`), source);

const { data: grey, info } = await sharp(source)
  .rotate(page.rotate)
  .extract(page.crop)
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;

const paper = localPaper(grey, w, h, 18);
const alpha = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const a = (paper[i] - grey[i] - page.noise) / (page.full - page.noise);
  alpha[i] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
}

const ink = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) ink[i] = alpha[i] >= page.seed ? 1 : 0;

/* the whole page, cleaned. This is the scene as drawn, which is a different
   and equally wanted thing from the props that make it up. */
await writeMask(path.join(out, "_page.png"), 0, 0, w, h, (x, y) => alpha[y * w + x]);

/* ── Ground ───────────────────────────────────────────────────────────────
   Find it on a vertically thickened copy, so a hand drawn line that wanders a
   pixel still reads as one long horizontal run. */
const standing = new Uint8Array(ink);
let groundIds = new Set();
if (page.ground) {
  const runs = horizontalRuns(dilate(ink, w, h, 1), w, h, 40);
  const { label: rl, found: rf } = components(runs, runs, w, h);
  const spans = rf.filter((b) => b.x1 - b.x0 > w * 0.5);

  if (!spans.length) {
    console.warn("  no ground line found; every prop will stay welded to it");
  } else {
    const keep = new Set(spans.map((b) => b.id));
    const band = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) band[i] = keep.has(rl[i]) ? 1 : 0;
    const fat = dilate(band, w, h, 3);
    for (let i = 0; i < w * h; i++) if (fat[i] && ink[i]) standing[i] = 0;

    await writeMask(path.join(out, "ground.png"), 0, 0, w, h, (x, y) =>
      fat[y * w + x] ? alpha[y * w + x] : 0,
    );
    groundIds = keep;
    console.log(`  ground.png                     ${w}x${h}  lifted`);
  }
}

/* ── Props ────────────────────────────────────────────────────────────── */
const { label, found } = components(dilate(standing, w, h, page.close), standing, w, h);
const solid = found.filter((b) => b.ink >= page.speck);
const pieces = groupByContainment(solid)
  .filter((g) => g.ink > page.piece)
  .sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);

const unnamed = [];
for (const [i, g] of pieces.entries()) {
  const key = `${g.x0},${g.y0}`;
  const name = page.names[key];
  if (!name) unnamed.push(key);

  const x0 = Math.max(0, g.x0 - page.pad);
  const y0 = Math.max(0, g.y0 - page.pad);
  const x1 = Math.min(w - 1, g.x1 + page.pad);
  const y1 = Math.min(h - 1, g.y1 + page.pad);

  const file = `${name ?? `piece-${String(i).padStart(2, "0")}`}.png`;
  /* keep only this group's own pixels. Boxes overlap where drawings lean into
     each other, and without this the neighbour's arm rides along in the cut. */
  await writeMask(path.join(out, file), x0, y0, x1 - x0 + 1, y1 - y0 + 1, (x, y) =>
    g.members.has(label[y * w + x]) ? alpha[y * w + x] : 0,
  );
  console.log(`  ${file.padEnd(30)} ${x1 - x0 + 1}x${y1 - y0 + 1}  ${g.ink} ink px`);
}

console.log(`\n${pieces.length} drawings -> ${path.relative(ROOT, out)}`);
if (unnamed.length) {
  console.log(`unnamed, add to PAGES names: ${unnamed.join("  ")}`);
}
