/**
 * Build the knockout sheets: Gary as a solid silhouette in the page's ground
 * colour, one cell per frame, registered to the sheets he already walks with.
 *
 * Why this exists. Gary is white line art and so is the scenery behind him, on
 * the same near-black ground. When he walks in front of the house their lines
 * cross and he stops reading as a figure: the window mullions run straight
 * through his head. Dimming the scenery fixes it and costs the scenery its
 * weight, which is not the trade Patrick wanted.
 *
 * So instead he carries his own hole. This writes a sheet that is opaque
 * wherever he is, transparent everywhere else, painted the colour of the
 * ground. GaryPacing draws it as a second background layer underneath his
 * sprite, on the same element, so the existing gary-step animation moves both
 * with one clock and the walk logic does not change at all.
 *
 * "Wherever he is" means his ink plus anything his ink encloses. That is what
 * makes his head solid rather than a ring: the fill is found by flooding in
 * from the edges of each cell and keeping whatever the flood could not reach.
 * Gaps that open to the outside stay open, which is correct and is why the
 * house still shows between his legs and under his arms.
 *
 *   node scripts/dev/make-solid.mjs
 *
 * Regenerate whenever the pacing or facing sheets are redrawn. The output is
 * committed, because the site must not need a build step to serve it.
 */

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

/** Must match --bg in globals.css. The hole is only invisible on that ground. */
const GROUND = [14, 14, 14];

/** Below this alpha a pixel counts as background for the flood. */
const INK = 24;

const SHEETS = [
  { src: "public/assets/gary-pace.png", out: "public/assets/gary-pace-solid.png", frames: 8 },
  { src: "public/assets/gary-facing.png", out: "public/assets/gary-facing-solid.png", frames: 2 },
];

/**
 * Mark every pixel of one cell reachable from its border without crossing ink.
 *
 * Iterative on purpose: a 114x144 cell recurses deep enough to blow the stack.
 */
function floodOutside(alpha, W, H, x0, cellW) {
  const outside = new Uint8Array(cellW * H);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cellW || y >= H) return;
    const i = y * cellW + x;
    if (outside[i]) return;
    if (alpha[y * W + x0 + x] >= INK) return; // ink stops the flood
    outside[i] = 1;
    stack.push(x, y);
  };

  for (let x = 0; x < cellW; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(cellW - 1, y); }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return outside;
}

for (const { src, out, frames } of SHEETS) {
  const buf = await readFile(src);
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: C } = info;
  const cellW = W / frames;
  if (!Number.isInteger(cellW)) {
    throw new Error(`${src}: ${W}px does not divide into ${frames} frames`);
  }

  const alpha = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += C, p++) alpha[p] = data[i + 3];

  const outPixels = Buffer.alloc(W * H * 4, 0);
  let solid = 0;

  for (let f = 0; f < frames; f++) {
    const x0 = f * cellW;
    const outside = floodOutside(alpha, W, H, x0, cellW);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < cellW; x++) {
        if (outside[y * cellW + x]) continue; // background stays clear
        const o = (y * W + x0 + x) * 4;
        outPixels[o] = GROUND[0];
        outPixels[o + 1] = GROUND[1];
        outPixels[o + 2] = GROUND[2];
        outPixels[o + 3] = 255;
        solid++;
      }
    }
  }

  const png = await sharp(outPixels, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out, png);

  const pct = ((solid / (W * H)) * 100).toFixed(1);
  console.log(`${out}  ${W}x${H}  ${frames} frames  ${pct}% solid  ${Math.round(png.length / 1024)}KB`);
}
