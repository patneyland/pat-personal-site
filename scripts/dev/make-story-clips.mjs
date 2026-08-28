/**
 * Derives the clips the story page needs: run, jump, fall and land.
 *
 *   node scripts/dev/make-story-clips.mjs
 *
 * Same source and same treatment as scripts/dev/make-pacer.mjs, which built
 * the walk that paces the card on /fun: the sprite's own head is replaced by a
 * clean ellipse, one of Patrick's drawn faces is dropped into it, and the
 * result is inverted so ink becomes alpha coverage.
 *
 * Two things are different here, and both matter.
 *
 *  - Every clip is cut from ONE crop rectangle. The pack draws all its actions
 *    standing on the same line, so a shared crop means a shared ground row,
 *    which means switching from run to jump does not make him hop a few pixels.
 *  - The output is frames on disk, not a finished sheet. `npm run sprites`
 *    packs them, so these clips arrive through the same door as a drawing.
 *
 * A fall is not in the pack, so it is built out of frames that were drawn for
 * other things. `fighter_hit` has the arms coming up over the head, which is
 * what a stick figure does on the way down, but its four frames only span
 * "arms up" to "arms slightly less up" and cycling them reads as a shiver
 * rather than a windmill. The other half of the rotation comes from elsewhere:
 * one frame with the arms straight down and one with them thrown back. That is
 * what an entry like "jump:1" is for.
 *
 * Faces are per clip, which is the whole point of drawing them separately: he
 * grins on the ground, sets his jaw to launch, and goes wide eyed on the way
 * down, and none of that cost a body drawing.
 *
 * The last two clips have no source frames at all. Nothing in the pack is out
 * of breath, so `puff` and `rise` are drawn here from a joint table. That is
 * affordable because the body is only six strokes: a tube for the torso and a
 * capped line per limb, at the pack's own weights, under the same generated
 * head. The pose is a lerp between the pack's stand and a doubled over crouch,
 * so `rise` is that same drawing walked back to nothing, and it hands off to
 * the walk without a jump.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = "C:/Users/Patri/AppData/Local/Temp/claude/c--Users-Patri-OneDrive-Documents-repos-pat-personal-site/90033470-5624-461b-a7f4-129549fa17ff/scratchpad/zip/Stick Figure Character Sprites 2D/Fighter sprites";
const ROOT = path.resolve(import.meta.dirname, "..", "..");

/* Union of the ink across run, jump and hit, with a little air. Row 381 of the
   source is the line every action stands on; in this crop that is row 185. */
const CROP = { left: 180, top: 196, width: 156, height: 190 };
const CELL = { w: 117, h: 143 };                   // 0.75x, then CSS scales it
const RING = 8.5;

/* Which source frames make which clip, in the order they play, and which of
   Patrick's faces he wears while he does it. Face 7 is the one from /fun. */
const CLIPS = {
  stand: { group: "fighter_Idle", order: [0,1,2,3,4,5,6,7], face: 7 },
  // rotated so the passing pose leads: see the gait reset in StoryGary
  walk:  { group: "fighter_walk", order: [5,6,7,0,1,2,3,4], face: 7 },
  run:   { group: "fighter_run",  order: [0,1,2,3,4,5,6,7], face: 7 },
  jump:  { group: "fighter_jump", order: [0, 1, 2], face: 9 },   // crouch, drive, rise
  // up, coming down, straight down, thrown back: one full turn of the arms
  fall:  { group: "fighter_hit",  face: 4,
           order: [3, 1, "fighter_jump:1", "fighter_air_attack:0"] },
  land:  { group: "fighter_jump", order: [3, 4], face: 4 },      // tuck, then absorb
};

/* --- The drawn clips ---------------------------------------------------- */

const LIMB = 7;          // measured off the pack's legs at this resolution
const TORSO_OUT = 29;    // the torso is a black tube with a white core
const TORSO_IN = 15;
const HEAD_R = { rx: 45.5, ry: 43.5 };   // the white fill, before the ring

/* Two poses, in the source's own 512 space. Ground is row 379. Everything
   between them is a straight lerp, which is enough because the joints were
   picked to travel in roughly straight lines. */
const UP = {                                     // the pack's stand, rebuilt
  head: [253, 270], shoulder: [253, 316], hip: [253, 348],
  knee: [[240, 364], [267, 364]], foot: [[236, 379], [271, 379]],
  elbow: [[238, 318], [268, 318]], hand: [[222, 321], [286, 321]],
};
/* His feet are the same two points in both poses, so nothing slides while he
   bends: only the knees, the hips and the arms travel. */
const OVER = {                                   // hands on knees, blown
  head: [256, 300], shoulder: [256, 326], hip: [255, 350],
  knee: [[231, 362], [280, 360]], foot: [[236, 379], [271, 379]],
  elbow: [[233, 344], [278, 343]], hand: [[230, 360], [281, 358]],
};

/* He is nearly all head, so a bent body disappears behind it: at this size the
   only parts of a crouch the reader ever sees are the knees, the feet and the
   last inch of forearm. The heave is therefore drawn where it can be seen. The
   ribs and the head lift on the breath and the hands stay put on the knees,
   which is what makes it read as breathing rather than as bouncing. */
function pose(bend, breath) {
  const L = (a, b) => a + (b - a) * bend;
  const P = (a, b) => [L(a[0], b[0]), L(a[1], b[1])];
  const p = {
    head: P(UP.head, OVER.head),
    shoulder: P(UP.shoulder, OVER.shoulder),
    hip: P(UP.hip, OVER.hip),
    knee: [P(UP.knee[0], OVER.knee[0]), P(UP.knee[1], OVER.knee[1])],
    foot: [P(UP.foot[0], OVER.foot[0]), P(UP.foot[1], OVER.foot[1])],
    elbow: [P(UP.elbow[0], OVER.elbow[0]), P(UP.elbow[1], OVER.elbow[1])],
    hand: [P(UP.hand[0], OVER.hand[0]), P(UP.hand[1], OVER.hand[1])],
  };
  const lift = 12 * breath * bend;
  p.head[1] -= lift;
  p.shoulder[1] -= lift * 0.7;
  p.hip[1] -= lift * 0.25;
  p.elbow[0][1] -= lift * 0.4;
  p.elbow[1][1] -= lift * 0.4;
  return p;
}

const stroke = (a, b, w, c) =>
  `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="${c}" stroke-width="${w}"` +
  ` stroke-linecap="round" fill="none"/>`;

/* Limbs, then the torso over them, then the head over everything: the same
   stacking order the pack draws in, which is why his neck never shows. */
const bodySvg = (p) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">` +
  [0, 1].flatMap((i) => [
    stroke(p.hip, p.knee[i], LIMB, "#000000"),
    stroke(p.knee[i], p.foot[i], LIMB, "#000000"),
    stroke(p.shoulder, p.elbow[i], LIMB, "#000000"),
    stroke(p.elbow[i], p.hand[i], LIMB, "#000000"),
  ]).join("") +
  stroke(p.hip, p.shoulder, TORSO_OUT, "#000000") +
  stroke(p.hip, p.shoulder, TORSO_IN, "#ffffff") +
  `<ellipse cx="${p.head[0]}" cy="${p.head[1]}" rx="${HEAD_R.rx + RING / 2}"` +
  ` ry="${HEAD_R.ry + RING / 2}" fill="#ffffff" stroke="#000000"` +
  ` stroke-width="${RING}"/></svg>`);

/* bend, breath, face. Face 2 is the flat eyed one and face 3 has the mouth
   open, so alternating them is the pant. `drop` is the knees going, `rise` is
   the same three positions back the other way, ending on 7, the grin he wears
   everywhere else, at a bend the walk can take over from. */
const DRAWN = {
  drop: [[0.15, 0.15, 7], [0.55, 0.50, 2], [0.90, 0.85, 3]],
  puff: [
    [1, 0.00, 2], [1, 0.35, 3], [1, 0.85, 3],
    [1, 1.00, 3], [1, 0.70, 3], [1, 0.25, 2],
  ],
  rise: [[0.72, 0.55, 3], [0.38, 0.30, 2], [0.08, 0.10, 7]],
};

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

const faces = new Map();
const faceFor = async (n) => {
  if (!faces.has(n))
    faces.set(n, await sharp(path.join(ROOT, `art/faces/face-${n}.png`))
      .resize(128, 128, { kernel: "lanczos3" }).png().toBuffer());
  return faces.get(n);
};

const fresh = (name) => {
  const dir = path.join(ROOT, "art", "exports", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * One composed 512 frame to one file on disk: the shared crop, the shared
 * cell, and then darkness becomes coverage. The head's white fill lands at
 * alpha 0, so the page shows through it and the atlas carries alpha only.
 */
async function bake(composed, dir, i) {
  const { data, info } = await sharp(composed).extract(CROP)
    .resize(CELL.w, CELL.h, { kernel: "lanczos3" })
    .raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let p = 0; p < info.width * info.height; p++) {
    const a = data[p*4+3];
    const L = (data[p*4] + data[p*4+1] + data[p*4+2]) / 3;
    out[p*4+3] = a < 20 ? 0 : Math.round((255 - L) * (a / 255));
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, String(i + 1).padStart(4, "0") + ".png"));
}

for (const [name, { group, order, face: faceNo }] of Object.entries(CLIPS)) {
  const face = await faceFor(faceNo);
  const files = fs.readdirSync(SRC).filter((f) => f.startsWith(group + "_")).sort();
  const dir = fresh(name);

  for (let i = 0; i < order.length; i++) {
    // A plain number indexes this clip's own group; "group:n" borrows a frame
    // from another one, which is how the fall gets its full arm swing.
    const ref = order[i];
    const [g, n] =
      typeof ref === "string" ? [ref.split(":")[0], +ref.split(":")[1]] : [group, ref];
    const file = fs.readdirSync(SRC).filter((f) => f.startsWith(g + "_")).sort()[n];
    if (!file) throw new Error(`${g} has no frame ${n}`);
    const E = await headEllipse(file);
    const composed = await sharp(path.join(SRC, file)).ensureAlpha()
      .composite([
        { input: cleanHead(E) },
        { input: face, left: Math.round(E.cx - 64), top: Math.round(E.cy - 64) },
      ]).png().toBuffer();

    await bake(composed, dir, i);
  }
  console.log(`  ${name.padEnd(5)} ${order.length} frames  face ${faceNo}  <- ${group}`);
}

for (const [name, frames] of Object.entries(DRAWN)) {
  const dir = fresh(name);
  for (let i = 0; i < frames.length; i++) {
    const [bend, breath, faceNo] = frames[i];
    const p = pose(bend, breath);
    const composed = await sharp({
      create: { width: 512, height: 512, channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([
      { input: bodySvg(p) },
      { input: await faceFor(faceNo),
        left: Math.round(p.head[0] - 64), top: Math.round(p.head[1] - 64) },
    ]).png().toBuffer();
    await bake(composed, dir, i);
  }
  console.log(`  ${name.padEnd(5)} ${frames.length} frames  drawn`);
}
