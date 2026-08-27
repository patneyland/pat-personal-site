/**
 * Builds the walk sprite that paces the top edge of the card on /fun.
 *
 *   node scripts/dev/make-pacer.mjs
 *
 * Two things make this sheet different from the review sheets:
 *
 *  - It is inverted for the dark ground. Ink becomes white and the head's
 *    white fill becomes transparent, so the page shows through his head
 *    instead of a pale disc sitting on near-black.
 *  - The cell is cropped so its bottom row IS his lowest foot pixel. Whatever
 *    CSS puts the bottom of this element on is what he stands on, at any size.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "C:/Users/Patri/AppData/Local/Temp/claude/c--Users-Patri-OneDrive-Documents-repos-pat-personal-site/90033470-5624-461b-a7f4-129549fa17ff/scratchpad/zip/Stick Figure Character Sprites 2D/Fighter sprites";
const ROOT = path.resolve(import.meta.dirname, "..", "..");

const FACE = 7;                                   // which of Patrick's drawings
const CROP = { left: 190, top: 180, width: 160, height: 202 };
const CELL = { w: 114, h: 144 };                  // 2x the display size
const RING = 8.5;

async function headEllipse(file) {
  const { data, info } = await sharp(path.join(SRC, file)).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const white = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++)
    if (data[i+3] > 200 && data[i] > 200 && data[i+1] > 200 && data[i+2] > 200) white[p] = 1;
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let p = 0; p < w * h; p++) {
    if (!white[p] || seen[p]) continue;
    const st = [p]; seen[p] = 1; const px = [];
    while (st.length) {
      const q = st.pop(); px.push(q);
      const x = q % w, y = (q / w) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (white[n] && !seen[n]) { seen[n] = 1; st.push(n); }
      }
    }
    if (!best || px.length > best.length) best = px;
  }
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (const q of best) {
    const x = q % w, y = (q / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { cx: (x0+x1)/2, cy: (y0+y1)/2, rx: (x1-x0+1)/2, ry: (y1-y0+1)/2, w, h };
}

const cleanHead = (E) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${E.w}" height="${E.h}">` +
  `<ellipse cx="${E.cx}" cy="${E.cy}" rx="${E.rx + RING/2}" ry="${E.ry + RING/2}" ` +
  `fill="#ffffff" stroke="#000000" stroke-width="${RING}"/></svg>`);

const files = fs.readdirSync(SRC)
  .filter((f) => /^fighter_walk_/i.test(f)).sort();
const face = await sharp(path.join(ROOT, `art/faces/face-${FACE}.png`))
  .resize(128, 128, { kernel: "lanczos3" }).png().toBuffer();

const cells = [];
for (const f of files) {
  const E = await headEllipse(f);
  const composed = await sharp(path.join(SRC, f)).ensureAlpha()
    .composite([
      { input: cleanHead(E) },
      { input: face, left: Math.round(E.cx - 64), top: Math.round(E.cy - 64) },
    ]).png().toBuffer();

  const { data, info } = await sharp(composed).extract(CROP)
    .resize(CELL.w, CELL.h, { kernel: "lanczos3" })
    .raw().toBuffer({ resolveWithObject: true });

  // Invert: darkness becomes coverage, and everything is painted white. The
  // head's white fill lands at alpha 0 and the page shows through it.
  const out = Buffer.alloc(data.length);
  for (let p = 0; p < info.width * info.height; p++) {
    const a = data[p*4+3];
    const L = (data[p*4] + data[p*4+1] + data[p*4+2]) / 3;
    out[p*4] = 255; out[p*4+1] = 255; out[p*4+2] = 255;
    out[p*4+3] = a < 20 ? 0 : Math.round((255 - L) * (a / 255));
  }
  cells.push(await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer());
}

const outPath = path.join(ROOT, "public/assets/gary-pace.png");
await sharp({ create: { width: CELL.w * cells.length, height: CELL.h, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((input, i) => ({ input, left: i * CELL.w, top: 0 })))
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`gary-pace.png  ${CELL.w * cells.length}x${CELL.h}  ` +
  `${cells.length} cells  ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
