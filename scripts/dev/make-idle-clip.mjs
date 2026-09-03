/**
 * Builds the atlas `idle` clip from the current head-on drawings.
 *
 *   node scripts/dev/make-idle-clip.mjs
 *
 * Reads  art/headon/raw/pose-*.png   the same two drawings make-facing.mjs
 *                                    turns into /assets/gary-facing.png
 * Writes art/exports/idle/0001.png ...  build input for `npm run sprites`
 *
 * This exists so the standing figure on /story is the same drawing as the
 * one on /fun. Both now come from art/headon/raw; redraw the poses there,
 * run this, then `npm run sprites`, and every page updates together.
 *
 * Nothing here is chosen by hand. Three things are derived:
 *
 *   box + ground     read off art/exports/walk, the clip he swaps with on
 *                    /story. Same box, same ground row, and a figure exactly
 *                    as tall as the walking figure's ink, so play("idle")
 *                    mid-crossing cannot change his size or footing. This is
 *                    the same trick make-facing.mjs uses against the pacer.
 *   the crop         one ink box covering BOTH poses. They were drawn on a
 *                    shared template, so cropping them together is what
 *                    keeps them in register (see make-facing.mjs).
 *   the head mark    sprites.mjs wants a pure magenta dot at the head
 *                    centre (docs/character-pipeline.md, registration). The
 *                    head is the drawing's one big enclosed region, so the
 *                    dot goes at the centre of the largest hole the ink
 *                    surrounds. No cyan mark: head-on, up is up, exactly as
 *                    the old idle frames had it.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const RAW = path.join(ROOT, "art/headon/raw");
const WALK = path.join(ROOT, "art/exports/walk");
const OUT = path.join(ROOT, "art/exports/idle");

/* -- What size must he be? Ask the walk clip. -------------------------- */

async function alphaBounds(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let y0 = 1e9,
    y1 = -1;
  for (let p = 0; p < info.width * info.height; p++) {
    if (data[p * 4 + 3] < 8) continue; // sprites.mjs's own ink threshold
    const y = (p / info.width) | 0;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { w: info.width, h: info.height, top: y0, bottom: y1 };
}

const walkFrames = fs
  .readdirSync(WALK)
  .filter((f) => f.endsWith(".png"))
  .map((f) => path.join(WALK, f));
const walkBounds = await Promise.all(walkFrames.map(alphaBounds));

const BOX = { w: walkBounds[0].w, h: walkBounds[0].h };
/* groundY, as sprites.mjs will compute it: one past the lowest ink row. */
const groundRow = Math.max(...walkBounds.map((b) => b.bottom));
/* The walking figure's full ink height: tallest frame's top to the ground. */
const FIGURE_H = groundRow + 1 - Math.min(...walkBounds.map((b) => b.top));
const TOP = groundRow + 1 - FIGURE_H;

/* -- The drawings, cropped together ------------------------------------ */

async function inkBox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = 1e9,
    x1 = -1,
    y0 = 1e9,
    y1 = -1;
  for (let p = 0; p < info.width * info.height; p++) {
    const a = data[p * 4 + 3];
    const L = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
    if (a > 20 && L < 160) {
      const x = p % info.width,
        y = (p / info.width) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

const files = fs
  .readdirSync(RAW)
  .filter((f) => /^pose-\d+\.png$/.test(f))
  .sort();
if (!files.length) throw new Error(`no pose-*.png in ${RAW}`);

const boxes = await Promise.all(files.map((f) => inkBox(path.join(RAW, f))));
const union = boxes.reduce((a, b) => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
  };
});

const drawnW = Math.round(union.width * (FIGURE_H / union.height));
if (drawnW > BOX.w)
  throw new Error(
    `figure ${drawnW}px wide does not fit the ${BOX.w}px box; ` +
      `he would lose his arms to the frame edge`,
  );
const LEFT = Math.round((BOX.w - drawnW) / 2);

/* -- Head centre: the biggest region the ink encloses ------------------ */

function headCentre(alpha, w, h) {
  // 0 empty, 1 ink, 2 reachable-from-outside. What stays 0 is enclosed.
  const cell = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (alpha[p] >= 48) cell[p] = 1;
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (cell[p] !== 0) continue;
    cell[p] = 2;
    const x = p % w,
      y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  // Largest enclosed hole, by bounding box. Eyes and mouth are ink islands
  // inside it, so the box is the head circle's own and its centre is fair.
  let best = null;
  const seen = new Uint8Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (cell[p0] !== 0 || seen[p0]) continue;
    let x0 = w,
      x1 = -1,
      y0 = h,
      y1 = -1,
      size = 0;
    const q = [p0];
    seen[p0] = 1;
    while (q.length) {
      const p = q.pop();
      size++;
      const x = p % w,
        y = (p / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const n of [p - 1, p + 1, p - w, p + w]) {
        if (n < 0 || n >= w * h) continue;
        if (cell[n] === 0 && !seen[n]) {
          seen[n] = 1;
          q.push(n);
        }
      }
    }
    if (!best || size > best.size)
      best = {
        size,
        cx: Math.round((x0 + x1) / 2),
        cy: Math.round((y0 + y1) / 2),
      };
  }
  if (!best)
    throw new Error("no enclosed region found; is the head outline broken?");
  return best;
}

/* -- Build the frames -------------------------------------------------- */

fs.mkdirSync(OUT, { recursive: true });
for (const old of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, old));

const report = [];
for (let i = 0; i < files.length; i++) {
  const scaled = await sharp(path.join(RAW, files[i]))
    .extract(union)
    .resize(drawnW, FIGURE_H, { kernel: "lanczos3" })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Ink to coverage, as make-facing.mjs does. RGB is irrelevant to the atlas
  // (sprites.mjs flattens to a mask) but white keeps the file inspectable.
  const { data, info } = scaled;
  const frame = Buffer.alloc(BOX.w * BOX.h * 4);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const L =
        (data[(y * info.width + x) * info.channels] +
          data[(y * info.width + x) * info.channels + 1] +
          data[(y * info.width + x) * info.channels + 2]) /
        3;
      const p = ((TOP + y) * BOX.w + (LEFT + x)) * 4;
      frame[p] = 255;
      frame[p + 1] = 255;
      frame[p + 2] = 255;
      frame[p + 3] = Math.round(255 - L);
    }
  }

  // The registration mark, pure magenta, 3x3, at the derived head centre.
  const alpha = new Uint8Array(BOX.w * BOX.h);
  for (let p = 0; p < BOX.w * BOX.h; p++) alpha[p] = frame[p * 4 + 3];
  const head = headCentre(alpha, BOX.w, BOX.h);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const p = ((head.cy + dy) * BOX.w + (head.cx + dx)) * 4;
      frame[p] = 255;
      frame[p + 1] = 0;
      frame[p + 2] = 255;
      frame[p + 3] = 255;
    }
  }

  const name = String(i + 1).padStart(4, "0") + ".png";
  await sharp(frame, { raw: { width: BOX.w, height: BOX.h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, name));
  report.push(`${name}  head [${head.cx}, ${head.cy}]`);
}

console.log(
  `idle  ${files.length} frames  box ${BOX.w}x${BOX.h}  figure ${drawnW}x${FIGURE_H}` +
    `  ground row ${groundRow} (matched to walk)\n  ` +
    report.join("\n  "),
);
