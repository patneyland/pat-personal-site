/**
 * Capture a thumbnail for every portfolio entry that links somewhere public.
 *
 *   npm run thumbnails
 *
 * Writes public/assets/portfolio/<slug>.png and adds `image:` to the entry's
 * frontmatter. Run it locally and commit the results, so the site serves
 * static images and never depends on a screenshot service at page load.
 *
 * Already has an `image:`? It is skipped. Pass --force to recapture everything.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "content", "portfolio");
const OUT = path.join(ROOT, "public", "assets", "portfolio");
const FORCE = process.argv.includes("--force");

fs.mkdirSync(OUT, { recursive: true });

const entries = fs
  .readdirSync(CONTENT)
  .filter((n) => n.endsWith(".md"))
  .map((name) => {
    const file = path.join(CONTENT, name);
    const raw = fs.readFileSync(file, "utf8");
    const href = raw.match(/^href:\s*(\S+)\s*$/m)?.[1];
    const hasImage = /^image:\s*\S/m.test(raw);
    return { slug: name.replace(/\.md$/, ""), file, raw, href, hasImage };
  })
  .filter((e) => e.href && e.href.startsWith("http") && (FORCE || !e.hasImage));

if (!entries.length) {
  console.log("Nothing to capture. Use --force to recapture existing thumbnails.");
  process.exit(0);
}

const browser = await chromium.launch();
let captured = 0;

for (const entry of entries) {
  const rel = `/assets/portfolio/${entry.slug}.jpg`;
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(entry.href, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUT, `${entry.slug}.jpg`),
      type: "jpeg",
      quality: 72,
    });

    const next = /^image:\s*.*$/m.test(entry.raw)
      ? entry.raw.replace(/^image:\s*.*$/m, `image: ${rel}`)
      : entry.raw.replace(/^href:\s*(.*)$/m, `href: $1\nimage: ${rel}`);

    fs.writeFileSync(entry.file, next);
    captured += 1;
    console.log(`captured  ${entry.slug}  <-  ${entry.href}`);
  } catch (err) {
    // A dead or slow link should not take the whole run down. The entry simply
    // stays text-only until the next run.
    console.warn(`SKIPPED   ${entry.slug}  (${err.message.split("\n")[0]})`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\n${captured} of ${entries.length} captured. Review them before committing.`);
