/**
 * Builds the pointing figure for the front page from Patrick's head-on
 * drawings.
 *
 *   node scripts/dev/make-pointer.mjs
 *
 * Both poses were drawn on the same template, so they are already in register.
 * The one thing that would break that is trimming them independently, so a
 * single crop box taken from the union of both is used for each.
 *
 * The crop's bottom row is his lowest foot pixel, so whatever CSS puts the
 * bottom of this element on is what he stands on. Ink stays black: the front
 * page is white and deliberately plain.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const RAW = path.join(ROOT, "art/headon/raw");
const CELL = { w: 80, h: 108 }; // 2x the display size

const files = fs.readdirSync(RAW).filter((f) => /^pose-\d+\.png$/.test(f)).sort();

/** Ink as coverage: black on white paper becomes black on transparent. */
async function keyed(file) {
  const { data, info } = await sharp(path.join(RAW, file)).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let p = 0; p < info.width * info.height; p++) {
    const L = (data[p*4] + data[p*4+1] + data[p*4+2]) / 3;
    out[p*4+3] = Math.max(0, 255 - Math.round(L));
  }
  return { buf: out, w: info.width, h: info.height };
}

// One crop box for every pose, or they drift apart frame to frame.
let X0 = 1e9, Y0 = 1e9, X1 = -1, Y1 = -1;
const keys = [];
for (const f of files) {
  const k = await keyed(f);
  keys.push(k);
  for (let y = 0; y < k.h; y++)
    for (let x = 0; x < k.w; x++) {
      if (k.buf[(y * k.w + x) * 4 + 3] < 20) continue;
      if (x < X0) X0 = x; if (x > X1) X1 = x;
      if (y < Y0) Y0 = y; if (y > Y1) Y1 = y;
    }
}
const CROP = { left: X0, top: Y0, width: X1 - X0 + 1, height: Y1 - Y0 + 1 };

const cells = [];
for (const k of keys) {
  cells.push(await sharp(k.buf, { raw: { width: k.w, height: k.h, channels: 4 } })
    .extract(CROP).resize(CELL.w, CELL.h, { kernel: "lanczos3" }).png().toBuffer());
}

const out = path.join(ROOT, "public/assets/gary-point.png");
await sharp({ create: { width: CELL.w * cells.length, height: CELL.h, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((input, i) => ({ input, left: i * CELL.w, top: 0 })))
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log(`crop  ${CROP.width}x${CROP.height} at ${CROP.left},${CROP.top}`);
console.log(`gary-point.png  ${CELL.w * cells.length}x${CELL.h}  ${cells.length} frames  ` +
  `${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
