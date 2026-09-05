import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
for (const [route, name] of [["/portfolio","portfolio"],["/garden","garden"],["/story","story"]]) {
  await p.goto("http://localhost:3577" + route, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
// nav close-up, to read the legend
await p.goto("http://localhost:3577/garden", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.locator("nav").screenshot({ path: `${out}/nav-in-garden.png` });
await p.goto("http://localhost:3577/portfolio", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.locator("nav").screenshot({ path: `${out}/nav-in-portfolio.png` });
console.log("shot navs");
await b.close();
