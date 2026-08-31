/**
 * Builds the standing sprite Gary switches to when he stops to talk on /fun.
 *
 *   node scripts/dev/make-facing.mjs
 *
 * Same two drawings as the pointing figure on the front page, from
 * art/headon/raw, so the character who stops to talk is the one Patrick drew
 * rather than anything borrowed. make-pointer.mjs keeps them black for the
 * white front page; this keeps them white for the dark ground above the card.
 *
 * The two poses alternate, which reads as him gesturing while he talks.
 *
 * The hard part is that this sheet is swapped for the walking one mid
 * animation, so anything that does not line up shows as a jump the moment he
 * stops. Two things are matched to the pacer rather than chosen:
 *
 *   figure height   127px inside a 144px cell, so he does not change size
 *   baseline        the cell's bottom row is his lowest foot pixel, so
 *                   whatever CSS puts the bottom of the element on is what he
 *                   stands on, exactly as in make-pacer.mjs
 *
 * He is drawn on paper 1200x1500 with the figure about 963px tall, so the
 * scale factor falls out of those two numbers rather than being guessed.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const RAW = path.join(ROOT, "art/headon/raw");

const CELL = { w: 114, h: 144 }; // 2x the display size, as the pacer is
const FIGURE_H = 127; // measured off gary-pace.png frame 0

/** The drawn ink, ignoring the paper around it. */
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

/* Both poses were drawn on the same template, so they are already in register.
   Trimming them independently is the one thing that would break that, which is
   why a single box covering both is used for each. */
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

const scale = FIGURE_H / union.height;
const drawnW = Math.round(union.width * scale);

const cells = [];
for (const f of files) {
  const scaled = await sharp(path.join(RAW, f))
    .extract(union)
    .resize(drawnW, FIGURE_H, { kernel: "lanczos3" })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Ink becomes coverage, painted white. The paper and the head's white fill
  // both land at alpha 0, so the dark page shows through his head rather than
  // a pale disc sitting on it. Identical to make-pacer.mjs.
  const { data, info } = scaled;
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const L =
      (data[p * info.channels] +
        data[p * info.channels + 1] +
        data[p * info.channels + 2]) /
      3;
    out[p * 4] = 255;
    out[p * 4 + 1] = 255;
    out[p * 4 + 2] = 255;
    out[p * 4 + 3] = Math.round(255 - L);
  }

  const white = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  // Centred across the cell, feet on the cell's bottom row.
  cells.push(
    await sharp({
      create: {
        width: CELL.w,
        height: CELL.h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: white,
          left: Math.round((CELL.w - info.width) / 2),
          top: CELL.h - FIGURE_H,
        },
      ])
      .png()
      .toBuffer(),
  );
}

const outPath = path.join(ROOT, "public/assets/gary-facing.png");
await sharp({
  create: {
    width: CELL.w * cells.length,
    height: CELL.h,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(cells.map((input, i) => ({ input, left: i * CELL.w, top: 0 })))
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(
  `gary-facing.png  ${CELL.w * cells.length}x${CELL.h}  ${cells.length} cells  ` +
    `figure ${drawnW}x${FIGURE_H}  ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`,
);
