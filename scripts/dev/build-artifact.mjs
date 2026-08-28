/**
 * Injects the sprite sheets and face swatches into the artifact template.
 *
 *   node scripts/dev/build-artifact.mjs
 *
 * Reads the sheets built by rebuild-faces.mjs, base64s them into a single
 * self-contained HTML file (artifacts cannot fetch external hosts), and writes
 * it next to the template.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SP = "C:/Users/Patri/AppData/Local/Temp/claude/c--Users-Patri-OneDrive-Documents-repos-pat-personal-site/90033470-5624-461b-a7f4-129549fa17ff/scratchpad";
const FACES = path.join(ROOT, "art/faces");
const SHEETS_DIR = path.join(FACES, "sheets");

const b64 = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");

const manifest = JSON.parse(fs.readFileSync(path.join(SHEETS_DIR, "manifest.json"), "utf8"));
const N = fs.readdirSync(FACES).filter((f) => /^face-\d+\.png$/.test(f)).length;

const SHEETS = {};
for (const [action, meta] of Object.entries(manifest.actions)) {
  SHEETS[action] = {
    frames: meta.frames,
    sheets: Array.from({ length: N }, (_, i) =>
      b64(path.join(SHEETS_DIR, `${action}-face-${i + 1}.png`))),
  };
}

const swatchSrc = [];
for (let n = 1; n <= N; n++) {
  const buf = await sharp(path.join(FACES, `face-${n}.png`))
    .trim({ threshold: 10 }).resize({ height: 130, fit: "inside" })
    .png({ compressionLevel: 9 }).toBuffer();
  swatchSrc.push("data:image/png;base64," + buf.toString("base64"));
}

const pad = (i) => String(i + 1).padStart(2, "0");
const figures = Array.from({ length: N }, (_, i) =>
  `    <figure class="walker">\n      <div class="guy"></div>\n` +
  `      <figcaption>${pad(i)}</figcaption>\n    </figure>`).join("\n");
const swatches = swatchSrc.map((src, i) =>
  `    <figure class="swatch">\n      <img src="${src}" alt="Expression ${pad(i)}">\n` +
  `      <figcaption>${pad(i)}</figcaption>\n    </figure>`).join("\n");

let html = fs.readFileSync(path.join(SP, "faces-template.html"), "utf8");
html = html.replace("<!--FIGURES-->", () => figures);
html = html.replace("<!--SWATCHES-->", () => swatches);

const marker = "<script>";
const at = html.indexOf(marker);
if (at < 0) throw new Error("no <script> block in the template");
html = html.slice(0, at + marker.length) +
  "\nvar SHEETS = " + JSON.stringify(SHEETS) + ";" +
  html.slice(at + marker.length);

const out = path.join(SP, "five-faces.html");
fs.writeFileSync(out, html);
console.log(`${N} faces x ${Object.keys(SHEETS).length} actions`);
console.log(`${(html.length / 1024 / 1024).toFixed(2)} MB -> ${out}`);
