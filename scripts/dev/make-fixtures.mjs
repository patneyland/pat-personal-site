/**
 * Generates the export fixtures that scripts/sprites.mjs is developed against.
 *
 *   node scripts/dev/make-fixtures.mjs
 *
 * Two clips come out of this, and they are not the same kind of thing.
 *
 *   _selftest  Rectangles at coordinates chosen so every number the build
 *              produces can be asserted exactly. Permanent. If the build ever
 *              stops reproducing these, something silent has broken.
 *
 *   idle       A real placeholder in Patrick's own line, made by rendering the
 *              two arm poses of public/assets/pointing-figure.svg. Stands in
 *              until he draws his own, then gets overwritten by Krita.
 *
 * Both are written exactly as Krita's Render Animation would write them:
 * numbered PNGs, transparent ground, registration marks composited in as pure
 * magenta and cyan so the build has something real to extract.
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "art", "exports");

const MAGENTA = { r: 255, g: 0, b: 255, alpha: 1 };
const CYAN = { r: 0, g: 255, b: 255, alpha: 1 };

/** A hard edged square of solid color, the way a no-antialias brush lands. */
async function dot(size, color) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: color },
  })
    .png()
    .toBuffer();
}

/* ── _selftest ────────────────────────────────────────────────────────────
   64x64 frames. One 10x10 ink square, one magenta registration dot, one cyan
   orientation dot. Every expected value is written down in the table beside
   the build's assertions, so read scripts/sprites.mjs before changing these. */
async function selftest() {
  const dir = path.join(OUT, "_selftest");
  await fs.mkdir(dir, { recursive: true });

  const frames = [
    { ink: [20, 30], mag: [32, 12], cyan: [32, 4] },
    { ink: [24, 30], mag: [34, 12], cyan: [38, 6] },
  ];

  for (const [i, f] of frames.entries()) {
    const ink = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: ink, left: f.ink[0], top: f.ink[1] },
        // Registration dots are 3x3, so the centroid lands on the named pixel.
        { input: await dot(3, MAGENTA), left: f.mag[0] - 1, top: f.mag[1] - 1 },
        { input: await dot(3, CYAN), left: f.cyan[0] - 1, top: f.cyan[1] - 1 },
      ])
      .png()
      .toFile(path.join(dir, String(i + 1).padStart(4, "0") + ".png"));
  }
  console.log("_selftest  2 frames, 64x64");
}

/* ── idle ─────────────────────────────────────────────────────────────────
   The pointing figure has two arm poses that swap on a hold. Rendering each
   one on its own gives exactly the two barely-different drawings the pipeline
   needs to prove registration and trim offsets. */
async function idle() {
  const dir = path.join(OUT, "idle");
  await fs.mkdir(dir, { recursive: true });

  const svg = await fs.readFile(
    path.join(ROOT, "public", "assets", "pointing-figure.svg"),
    "utf8",
  );

  // The head center in viewBox units, and the viewBox origin, both read off
  // the file. Scale 2 keeps the line crisp at the sizes we render at.
  const SCALE = 2;
  const VB_X = -12;
  const HEAD = { x: 34.6, y: 23.6 };
  const head = {
    x: Math.round((HEAD.x - VB_X) * SCALE),
    y: Math.round(HEAD.y * SCALE),
  };

  for (const [i, keep] of ["arm-up", "arm-out"].entries()) {
    const drop = keep === "arm-up" ? "arm-out" : "arm-up";
    // librsvg does not run CSS animations, so both arms would otherwise draw.
    const frozen = svg.replace(
      "</style>",
      `#${keep}{opacity:1!important;animation:none!important}` +
        `#${drop}{opacity:0!important;animation:none!important}</style>`,
    );

    const body = await sharp(Buffer.from(frozen), { density: 72 * SCALE })
      .png()
      .toBuffer();
    const { width, height } = await sharp(body).metadata();

    await sharp(body)
      .composite([
        { input: await dot(3, MAGENTA), left: head.x - 1, top: head.y - 1 },
      ])
      .png()
      .toFile(path.join(dir, String(i + 1).padStart(4, "0") + ".png"));

    if (i === 0) console.log(`idle       2 frames, ${width}x${height}`);
  }
}

await fs.mkdir(OUT, { recursive: true });
await selftest();
await idle();
console.log("\nfixtures written to art/exports/");
