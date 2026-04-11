import { chromium } from "playwright";

const BASE_URL = process.env.URL || "http://localhost:3003";

const browser = await chromium.launch();

async function shot(path, url, width, height) {
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400); // let blur-fade animations settle (max delay 0.5s + duration 0.6s = 1.1s)
  await page.screenshot({ path, fullPage: false });
  await page.close();
  console.log(`saved: ${path}`);
}

await shot("screenshots/home-mobile.png",  BASE_URL,          390, 844);
await shot("screenshots/home-desktop.png", BASE_URL,         1440, 900);
await shot("screenshots/story-mobile.png", `${BASE_URL}/story`, 390, 844);

await browser.close();
