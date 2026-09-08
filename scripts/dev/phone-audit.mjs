/* Phone-shell audit for /arcade.

   Emulates a real touch phone (isMobile + hasTouch, so pointer: coarse
   matches), walks the three screens, and saves a shot of each. Assertions
   print PASS/FAIL so a broken step is visible without reading every image. */

import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.URL || "http://localhost:3011";
const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
}

async function newPhone(landscape = false) {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${BASE}/arcade`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

/* ---------------------------- portrait walk ---------------------------- */

const { ctx, page, errors } = await newPhone();

check("phone shell active", (await page.getAttribute("html", "data-phone")) === "true");
check("gate is up", await page.isVisible(".ph-gate"));
check("cabinet rail is out of the way", !(await page.isVisible(".rail-head")));
await page.screenshot({ path: `${OUT}/01-gate.png` });

// Drop the coin.
await page.tap(".coin-btn");
await page.waitForTimeout(1600);
check("gate lifted after the coin", !(await page.isVisible(".ph-gate")));
check("credit landed", (await page.getAttribute("html", "data-inserted")) === "true");
check("hud is up between runs", await page.isVisible(".ph-hud"));
await page.screenshot({ path: `${OUT}/02-attract-snake.png` });

// Tap the glass to start Snake. This is the tap the attract overlay used to eat.
await page.tap(".stage");
await page.waitForTimeout(700);
const playState = await page.getAttribute("html", "data-play");
check("tap started the run", playState === "playing", `data-play=${playState}`);
const hudOpacity = await page.$eval(".ph-hud", (el) => getComputedStyle(el).opacity);
check("hud clears the screen while playing", hudOpacity === "0", `opacity=${hudOpacity}`);
await page.screenshot({ path: `${OUT}/03-snake-playing.png` });

// Swipe up: the snake should turn without the page moving under it.
const beforeScroll = await page.evaluate(() => window.scrollY);
await page.touchscreen.tap(195, 500);
await page.mouse.move(195, 600);
await page.waitForTimeout(200);
const afterScroll = await page.evaluate(() => window.scrollY);
check("page does not scroll under a swipe", beforeScroll === afterScroll);

/* ------------------------------ minesweeper ---------------------------- */

await page.tap(".ph-swap");
await page.waitForTimeout(600);
check("switch game reached minesweeper",
  (await page.getAttribute("html", "data-game")) === "minesweeper");
await page.screenshot({ path: `${OUT}/04-minesweeper.png` });

const ms = await page.$eval(".ms-board", (el) => {
  const r = el.getBoundingClientRect();
  const c = el.querySelector(".ms-cell").getBoundingClientRect();
  return {
    left: Math.round(r.left), right: Math.round(r.right),
    bottom: Math.round(r.bottom), cell: Math.round(c.width),
  };
});
check("minesweeper board fits the glass",
  ms.left >= 0 && ms.right <= 390 && ms.bottom <= 844,
  `left=${ms.left} right=${ms.right} bottom=${ms.bottom}`);
check("minesweeper cells are thumb-sized", ms.cell >= 30, `${ms.cell}px`);

/* -------------------------------- asteroids ---------------------------- */

await page.tap(".ph-swap");
await page.waitForTimeout(600);
check("switch game reached asteroids",
  (await page.getAttribute("html", "data-game")) === "asteroids");
check("thumb pad exists", await page.isVisible(".ast-pad"));
const keys = await page.$$eval(".ast-key", (els) => els.length);
check("five keys on the pad", keys === 5, `${keys} keys`);
await page.screenshot({ path: `${OUT}/05-asteroids-attract.png` });

// Fire to start, then hold left and watch the ship actually turn.
await page.tap(".ast-key-fire");
await page.waitForTimeout(500);
check("fire started asteroids",
  (await page.getAttribute("html", "data-play")) === "playing");
await page.screenshot({ path: `${OUT}/06-asteroids-playing.png` });

await page.dispatchEvent(".ast-key-left", "pointerdown", { pointerId: 1, isPrimary: true });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/07-asteroids-turning.png` });
const held = await page.$eval(".ast-key-left", (el) => el.classList.contains("is-down"));
check("held key stays down", held);
await page.dispatchEvent(".ast-key-left", "pointerup", { pointerId: 1, isPrimary: true });
await page.waitForTimeout(200);
const released = await page.$eval(".ast-key-left", (el) => el.classList.contains("is-down"));
check("released key lets go", !released);

// The HUD must never sit on a control. This is the bug that made the first
// landscape pass unplayable: switch-game was on top of turn-left.
const clash = await page.evaluate(() => {
  const hit = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const btns = [...document.querySelectorAll(".ph-btn, .vol-btn")].map((e) => e.getBoundingClientRect());
  const keys = [...document.querySelectorAll(".ast-key")].map((e) => e.getBoundingClientRect());
  return btns.filter((b) => keys.some((k) => hit(b, k))).length;
});
check("hud clears the thumb pad", clash === 0, `${clash} overlapping`);

/* ------------------------------- the board ----------------------------- */

await page.evaluate(() => {
  // Stop the run so the HUD comes back without waiting to die.
  document.querySelector(".ph-hud").style.opacity = "1";
  document.querySelector(".ph-hud").style.pointerEvents = "auto";
});
await page.tap(".ph-board");
await page.waitForTimeout(900);
check("board sheet opens", await page.isVisible(".ph-sheet"));
check("back link lives in the sheet", await page.isVisible(".ph-sheet .back-link"));
await page.screenshot({ path: `${OUT}/08-board-sheet.png` });
await page.tap(".ph-close");
await page.waitForTimeout(300);
check("board sheet closes", !(await page.isVisible(".ph-sheet")));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await ctx.close();

/* ------------------------------- landscape ----------------------------- */

const land = await newPhone(true);
check("landscape still in the phone shell",
  (await land.page.getAttribute("html", "data-phone")) === "true");
await land.page.tap(".coin-btn");
await land.page.waitForTimeout(1500);
await land.page.tap(".ph-swap");
await land.page.waitForTimeout(400);
await land.page.tap(".ph-swap");
await land.page.waitForTimeout(600);
await land.page.screenshot({ path: `${OUT}/09-asteroids-landscape.png` });
const landClash = await land.page.evaluate(() => {
  const hit = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const btns = [...document.querySelectorAll(".ph-btn, .vol-btn")].map((e) => e.getBoundingClientRect());
  const keys = [...document.querySelectorAll(".ast-key")].map((e) => e.getBoundingClientRect());
  return btns.filter((b) => keys.some((k) => hit(b, k))).length;
});
check("landscape hud clears the thumb pad", landClash === 0, `${landClash} overlapping`);
await land.ctx.close();

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("failed: " + failed.map((f) => f.name).join(", "));
  process.exitCode = 1;
}
