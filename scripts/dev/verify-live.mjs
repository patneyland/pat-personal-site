import { chromium } from "playwright";

const URL = "http://localhost:3000/pullups";
const FEED = "pullup-stats";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });

const hits = [];
page.on("request", (r) => {
  if (r.url().includes(FEED)) hits.push({ t: Date.now(), url: r.url() });
});

await page.goto(URL, { waitUntil: "networkidle" });
const t0 = Date.now();
console.log("loaded. watching for polls for 50s...");
await page.waitForTimeout(50_000);

console.log(`client-side polls seen: ${hits.length}`);
hits.forEach((h, i) => console.log(`  #${i + 1} at +${((h.t - t0) / 1000).toFixed(1)}s`));

// Now prove it stops when the tab is hidden.
const before = hits.length;
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(30_000);
console.log(`polls while hidden (should be 0): ${hits.length - before}`);

await browser.close();
