import { chromium } from "playwright";

const OUT = process.argv[2];
const URL = `http://localhost:${process.argv[3] ?? 3000}/pullups`;

const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const page = await browser.newPage({ viewport: { width: 820, height: 1400 } });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/pullups-${theme}.png`, fullPage: true });
  await page.close();
}
// and one with a bar hovered, to prove the readout works
const page = await browser.newPage({ viewport: { width: 820, height: 1400 } });
await page.goto(URL, { waitUntil: "networkidle" });
const bars = page.locator("figure svg g rect[fill='transparent']");
const n = await bars.count();
if (n > 0) { await bars.nth(n - 3).hover(); await page.waitForTimeout(400); }
await page.locator("figure").screenshot({ path: `${OUT}/pullups-hover.png` });
await browser.close();
console.log("shots written");
