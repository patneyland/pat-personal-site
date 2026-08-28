/**
 * Packs the exported drawings into one atlas and one manifest.
 *
 *   npm run sprites
 *
 * Reads  art/exports/<clip>/*.png   numbered frames straight out of Krita
 *        art/clips.json             hand written per clip metadata
 * Writes public/assets/character/atlas.<hash>.png
 *        public/assets/character/character.json
 *
 * The spec this implements is docs/character-pipeline.md. Read it before
 * changing anything here, particularly decision 04 on trim offsets, which is
 * the one that fails silently.
 *
 * Run with --check to assert the _selftest clip still produces exactly the
 * numbers it is designed to produce. That runs automatically every build.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const EXPORTS = path.join(ROOT, "art", "exports");
const OUT = path.join(ROOT, "public", "assets", "character");

const TOL = 8; // how far a pixel may sit from pure magenta or cyan
const GUTTER = 1; // transparent pixels between packed frames
const MAX_ATLAS = 2048; // beyond this some mobile GPUs refuse the texture
const DEFAULTS = { kind: "ambient", fps: 8, loop: true };

const warnings = [];

/* ── Registration ─────────────────────────────────────────────────────────
   Marks are drawn on their own layer in pure magenta (head center) and pure
   cyan (which way is up). They come out in the same PNG as the drawing, so
   they are found by color, averaged to a centroid, then erased before
   anything else looks at the pixels. */
function extractRegistration(px, w, h) {
  const hits = { magenta: [], cyan: [] };

  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a < 128) continue;

    const isMagenta = r > 255 - TOL && g < TOL && b > 255 - TOL;
    const isCyan = r < TOL && g > 255 - TOL && b > 255 - TOL;
    if (!isMagenta && !isCyan) continue;

    const p = i / 4;
    hits[isMagenta ? "magenta" : "cyan"].push([p % w, Math.floor(p / w)]);
    px[i + 3] = 0; // erase, so it never reaches the atlas or the bounding box
  }

  const centroid = (list) =>
    list.length
      ? [
          list.reduce((s, p) => s + p[0], 0) / list.length,
          list.reduce((s, p) => s + p[1], 0) / list.length,
        ]
      : null;

  const head = centroid(hits.magenta);
  const up = centroid(hits.cyan);
  if (!head) return { head: null, headAngle: null };

  // Angle away from straight up, positive clockwise, in degrees.
  const headAngle = up
    ? +(
        (Math.atan2(up[0] - head[0], head[1] - up[1]) * 180) /
        Math.PI
      ).toFixed(2)
    : null;

  return { head: [Math.round(head[0]), Math.round(head[1])], headAngle };
}

/** Tight bounding box of everything still visible. */
function inkBounds(px, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

async function readClip(name) {
  const dir = path.join(EXPORTS, name);
  const files = (await fs.readdir(dir))
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (!files.length) throw new Error(`${name}: no PNG frames`);

  const frames = [];
  let box = null;
  let lowestInk = -1;

  for (const file of files) {
    const img = sharp(path.join(dir, file)).ensureAlpha();
    const { data, info } = await img
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;

    if (!box) box = [w, h];
    else if (box[0] !== w || box[1] !== h)
      throw new Error(
        `${name}/${file}: ${w}x${h} does not match ${box[0]}x${box[1]}. ` +
          `Every frame of a clip must export at the same size.`,
      );

    const reg = extractRegistration(data, w, h);
    const b = inkBounds(data, w, h);
    if (!b) throw new Error(`${name}/${file}: frame is empty`);
    if (b.y1 > lowestInk) lowestInk = b.y1;

    // Crop to the ink and flatten to a mask: RGB to zero, alpha kept. The
    // color comes from CSS at runtime, so the atlas only carries coverage.
    const cw = b.x1 - b.x0 + 1;
    const ch = b.y1 - b.y0 + 1;
    const mask = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const src = ((y + b.y0) * w + (x + b.x0)) * 4 + 3;
        mask[(y * cw + x) * 4 + 3] = data[src];
      }
    }

    frames.push({
      w: cw,
      h: ch,
      o: [b.x0, b.y0], // decision 04: put it back where it was drawn
      head: reg.head,
      headAngle: reg.headAngle,
      pixels: mask,
    });
  }

  return { name, box, groundY: lowestInk + 1, frames };
}

/* ── Packing ──────────────────────────────────────────────────────────────
   A shelf packer. Frames from one character are similar heights, so rows
   waste very little and the alternative is not worth the code. */
function pack(items, maxWidth) {
  const order = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, rowH = 0, width = 0;

  for (const it of order) {
    if (x + it.w > maxWidth && x > 0) {
      y += rowH + GUTTER;
      x = 0;
      rowH = 0;
    }
    it.x = x;
    it.y = y;
    x += it.w + GUTTER;
    rowH = Math.max(rowH, it.h);
    width = Math.max(width, x - GUTTER);
  }
  return { width, height: y + rowH };
}

const pow2 = (n) => 1 << (32 - Math.clz32(Math.max(1, n - 1)));

/* ── Self test ────────────────────────────────────────────────────────────
   The _selftest clip is drawn at coordinates chosen so every one of these is
   knowable by hand. See scripts/dev/make-fixtures.mjs. */
function selfTest(clip) {
  const expected = {
    box: [64, 64],
    groundY: 40,
    frames: [
      { o: [20, 30], w: 10, h: 10, head: [32, 12], headAngle: 0 },
      { o: [24, 30], w: 10, h: 10, head: [34, 12], headAngle: 33.69 },
    ],
  };

  const fails = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  if (!eq(clip.box, expected.box)) fails.push(`box ${clip.box} != ${expected.box}`);
  if (clip.groundY !== expected.groundY)
    fails.push(`groundY ${clip.groundY} != ${expected.groundY}`);

  expected.frames.forEach((e, i) => {
    const f = clip.frames[i];
    if (!f) return fails.push(`frame ${i} missing`);
    if (!eq(f.o, e.o)) fails.push(`frame ${i} offset ${f.o} != ${e.o}`);
    if (f.w !== e.w || f.h !== e.h)
      fails.push(`frame ${i} size ${f.w}x${f.h} != ${e.w}x${e.h}`);
    if (!eq(f.head, e.head)) fails.push(`frame ${i} head ${f.head} != ${e.head}`);
    if (Math.abs(f.headAngle - e.headAngle) > 0.05)
      fails.push(`frame ${i} headAngle ${f.headAngle} != ${e.headAngle}`);
  });

  if (fails.length) {
    console.error("\n  SELF TEST FAILED");
    fails.forEach((f) => console.error("    " + f));
    console.error(
      "\n  Something in extraction, bounds or trimming changed behavior.\n" +
        "  These numbers are hand checkable: see docs/character-pipeline.md.\n",
    );
    process.exit(1);
  }
  console.log("  self test    registration, bounds, offsets, angle  OK");
}

/* ── Build ────────────────────────────────────────────────────────────── */

const meta = JSON.parse(
  await fs.readFile(path.join(ROOT, "art", "clips.json"), "utf8").catch(() => "{}"),
);

const dirs = (await fs.readdir(EXPORTS, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (!dirs.length) {
  console.error("No clips in art/exports/. Render a sequence out of Krita first.");
  process.exit(1);
}

console.log(`\nReading ${dirs.length} clip${dirs.length === 1 ? "" : "s"}\n`);

const clips = [];
for (const name of dirs) {
  const clip = await readClip(name);
  clips.push(clip);
  console.log(
    `  ${name.padEnd(12)} ${String(clip.frames.length).padStart(2)} frames` +
      `  box ${clip.box[0]}x${clip.box[1]}  ground ${clip.groundY}` +
      (clip.frames[0].head ? "" : "  (no registration mark)"),
  );
  if (name === "_selftest") selfTest(clip);
  else if (!meta[name]) warnings.push(`${name} has no entry in art/clips.json`);
}

// Everything that needs a home in the atlas, self test frames included so the
// packer is exercised by them too.
const boxes = clips.flatMap((c) =>
  c.frames.map((f) => ({ clip: c.name, w: f.w, h: f.h, ref: f })),
);

let dims = pack(boxes, 512);
for (const w of [512, 1024, 2048]) {
  dims = pack(boxes, w);
  if (dims.height <= w) break;
}
const atlasW = pow2(dims.width);
const atlasH = pow2(dims.height);

if (atlasW > MAX_ATLAS || atlasH > MAX_ATLAS) {
  console.error(
    `\nAtlas would be ${atlasW}x${atlasH}, over the ${MAX_ATLAS} limit.\n` +
      `Split into clip groups and lazy load, or cut frames.\n`,
  );
  process.exit(1);
}

const canvas = Buffer.alloc(atlasW * atlasH * 4);
for (const b of boxes) {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      canvas[((b.y + y) * atlasW + (b.x + x)) * 4 + 3] =
        b.ref.pixels[(y * b.w + x) * 4 + 3];
    }
  }
  b.ref.r = [b.x, b.y, b.w, b.h];
}

const png = await sharp(canvas, {
  raw: { width: atlasW, height: atlasH, channels: 4 },
})
  .png({ compressionLevel: 9, palette: false })
  .toBuffer();

const hash = crypto.createHash("sha256").update(png).digest("hex").slice(0, 6);
const atlasName = `atlas.${hash}.png`;

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, atlasName), png);

const manifest = {
  version: 1,
  atlas: `/assets/character/${atlasName}`,
  atlasSize: [atlasW, atlasH],
  mask: true,
  clips: {},
};

for (const c of clips) {
  if (c.name.startsWith("_")) continue; // fixtures are built, never shipped
  manifest.clips[c.name] = {
    ...DEFAULTS,
    ...(meta[c.name] ?? {}),
    box: c.box,
    groundY: c.groundY,
    frames: c.frames.map((f) => {
      const frame = { r: f.r, o: f.o };
      if (f.head) frame.head = f.head;
      if (f.headAngle !== null && f.headAngle !== 0) frame.headAngle = f.headAngle;
      return frame;
    }),
  };
}

await fs.writeFile(
  path.join(OUT, "character.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

const kb = (png.length / 1024).toFixed(1);
console.log(
  `\n  atlas        ${atlasW}x${atlasH}  ${kb} KB  ${atlasName}\n` +
    `  manifest     ${Object.keys(manifest.clips).length} clips, ` +
    `${boxes.length} frames packed\n`,
);

if (+kb > 250)
  warnings.push(`atlas is ${kb} KB, over the 250 KB budget`);

if (warnings.length) {
  console.log("  warnings");
  warnings.forEach((w) => console.log("    " + w));
  console.log();
}
