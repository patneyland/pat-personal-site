/**
 * Composites Patrick's face drawings onto the sprite pack's action clips.
 *
 *   node scripts/dev/rebuild-faces.mjs
 *
 * The pack's head is a rigid ellipse (91 x 87 interior, 8.5px ring) that only
 * translates between frames. The original scowl cannot be erased, because its
 * eyebrow runs into the head outline and is therefore joined to it. So the head
 * is redrawn clean on every frame and the new face is stamped on top.
 *
 * One crop box serves every action, which is what keeps the ground line in the
 * same place when you switch between them.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "C:/Users/Patri/AppData/Local/Temp/claude/c--Users-Patri-OneDrive-Documents-repos-pat-personal-site/90033470-5624-461b-a7f4-129549fa17ff/scratchpad/zip/Stick Figure Character Sprites 2D/Fighter sprites";
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "art/faces/sheets");

const ACTIONS = ["walk", "run", "jump"];
const CROP = { left: 190, top: 180, width: 160, height: 220 };
const UP = 2, RING = 8.5;

/** Largest white blob is the head interior. Returns its bounding ellipse. */
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

const N = fs.readdirSync(path.join(ROOT, "art/faces"))
  .filter((f) => /^face-\d+\.png$/.test(f)).length;
const CW = CROP.width * UP, CH = CROP.height * UP;

fs.mkdirSync(OUT, { recursive: true });
const manifest = { cell: [CW, CH], actions: {} };

for (const action of ACTIONS) {
  const files = fs.readdirSync(SRC)
    .filter((f) => new RegExp(`^fighter_${action}_`, "i").test(f)).sort();
  const ells = [];
  for (const f of files) ells.push({ f, E: await headEllipse(f) });
  manifest.actions[action] = { frames: files.length };

  for (let n = 1; n <= N; n++) {
    const face = await sharp(path.join(ROOT, `art/faces/face-${n}.png`))
      .resize(128, 128, { kernel: "lanczos3" }).png().toBuffer();
    const cells = [];
    for (const { f, E } of ells) {
      const full = await sharp(path.join(SRC, f)).ensureAlpha()
        .composite([
          { input: cleanHead(E) },
          { input: face, left: Math.round(E.cx - 64), top: Math.round(E.cy - 64) },
        ]).png().toBuffer();
      cells.push(await sharp(full).extract(CROP)
        .resize(CW, CH, { kernel: "lanczos3" }).png().toBuffer());
    }
    await sharp({ create: { width: CW * cells.length, height: CH, channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(cells.map((input, i) => ({ input, left: i * CW, top: 0 })))
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `${action}-face-${n}.png`));
  }
  console.log(`${action.padEnd(5)} ${files.length} frames x ${N} faces`);
}

fs.writeFileSync(path.join(ROOT, "art/faces/sheets/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n");

const kb = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"))
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
console.log(`\n${N * ACTIONS.length} sheets, ${(kb / 1024).toFixed(2)} MB total`);
