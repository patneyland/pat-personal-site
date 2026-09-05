/* Capture Gary's placement across viewports for review. */
import { chromium } from "playwright";
const out = process.argv[2], port = process.argv[3] || "3600";
const widths = [{ w: 1440, h: 900, n: "desktop" }, { w: 1024, h: 800, n: "laptop" },
                { w: 768, h: 900, n: "tablet" }, { w: 390, h: 844, n: "phone" }];
const b = await chromium.launch();
for (const route of ["/portfolio", "/garden"]) {
  const slug = route.slice(1);
  for (const v of widths) {
    const p = await b.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
    await p.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle" });
    await p.evaluate(async () => {
      const step = window.innerHeight * 0.7;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200));
      }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${out}/${slug}-${v.n}.png`, fullPage: true });
    const g = p.locator("button[title='Ask Gary about this site']").first();
    if (await g.count()) {
      const box = await g.boundingBox();
      if (box) {
        await p.screenshot({ path: `${out}/${slug}-${v.n}-closeup.png`,
          clip: { x: Math.max(0, box.x - 220), y: Math.max(0, box.y - 80),
                  width: Math.min(v.w, box.width + 280), height: box.height + 150 } });
        console.log(`${slug} ${v.n}: gary at x=${Math.round(box.x)} y=${Math.round(box.y)} ${box.width}x${box.height}, viewport ${v.w}`);
      }
    } else { console.log(`${slug} ${v.n}: NO GARY`); }
    await p.close();
  }
}
await b.close();
