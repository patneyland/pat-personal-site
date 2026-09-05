/**
 * Build the character atlas's knockout companion: Gary as a solid silhouette,
 * one region per frame, registered pixel for pixel to the atlas he is drawn
 * from.
 *
 * Why this exists. On /fun he already carries his own hole, built by
 * make-solid.mjs, so the house's window mullions do not run through his head.
 * On /story he did not, because that Gary is drawn by lib/character/player.ts
 * off a packed atlas rather than off a uniform sprite sheet, and the grid
 * logic in make-solid.mjs has no cells to work with here. The result was the
 * bottoms of letters showing through his head as he walked past a paragraph.
 *
 * "Wherever he is" means his ink plus anything his ink encloses, same rule as
 * make-solid.mjs: flood in from the border of each frame's own rect and keep
 * whatever the flood could not reach. Gaps that open to the outside stay open,
 * so scenery still shows between his legs.
 *
 * The one difference from make-solid.mjs, and it is an improvement: this
 * writes an alpha mask rather than a sheet painted in the ground colour.
 * player.ts uses it as a mask-image and fills it with background-color, so the
 * hole follows --bg through both modes and this never needs regenerating when
 * the palette moves. make-solid.mjs bakes GROUND in and has already drifted
 * once.
 *
 *   node scripts/dev/make-character-solid.mjs
 *
 * Rerun whenever the atlas is rebuilt. Output is committed.
 */

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const MANIFEST = "public/assets/character/character.json";
const DIR = "public/assets/character";

/** Below this alpha a pixel counts as background for the flood. */
const INK = 24;

/** Flood one frame rect from its border, then keep everything unreached. */
function fillRect(alpha, W, rx, ry, rw, rh, out) {
  const seen = new Uint8Array(rw * rh);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= rw || y >= rh) return;
    const i = y * rw + x;
    if (seen[i]) return;
    if (alpha[(ry + y) * W + rx + x] >= INK) return; // ink stops the flood
    seen[i] = 1;
    stack.push(x, y);
  };

  for (let x = 0; x < rw; x++) { push(x, 0); push(x, rh - 1); }
  for (let y = 0; y < rh; y++) { push(0, y); push(rw - 1, y); }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  let solid = 0;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (seen[y * rw + x]) continue;
      out[(ry + y) * W + rx + x] = 255;
      solid++;
    }
  }
  return solid;
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const atlasPath = `public${manifest.atlas}`;
const [W, H] = manifest.atlasSize;

const { data } = await sharp(atlasPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const alpha = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) alpha[i] = data[i * 4 + 3];

const out = new Uint8Array(W * H);
let frames = 0;
let solid = 0;
const done = new Set();
for (const clip of Object.values(manifest.clips)) {
  for (const f of clip.frames) {
    const key = f.r.join(",");
    if (done.has(key)) continue;
    done.add(key);
    solid += fillRect(alpha, W, f.r[0], f.r[1], f.r[2], f.r[3], out);
    frames++;
  }
}

/* White everywhere, alpha carries the shape. It is only ever used as a mask,
   so the colour channels are never seen. */
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255;
  rgba[i * 4 + 3] = out[i];
}

const name = manifest.atlas.split("/").pop().replace(/\.png$/, "-solid.png");
const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(`${DIR}/${name}`, png);

manifest.atlasSolid = `/assets/character/${name}`;
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

const ink = alpha.reduce((n, a) => n + (a >= INK ? 1 : 0), 0);
console.log(
  `${DIR}/${name}  ${W}x${H}  ${frames} frames  ` +
  `ink ${ink}px -> solid ${solid}px  ${Math.round(png.length / 1024)}KB`,
);
