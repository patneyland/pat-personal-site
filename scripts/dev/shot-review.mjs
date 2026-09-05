/* Screenshot a running local build for design review.
   Usage: npx next start -p <port>, then
          node scripts/dev/shot-review.mjs <outDir> <port> <route>...

   Scrolls the whole page before shooting. BlurFade reveals on whileInView, so
   a fullPage screenshot without scrolling captures everything below the fold
   at opacity 0 and looks like the page is broken. */
import { chromium } from "playwright";
const [out, port = "3578", ...routes] = process.argv.slice(2);
const list = routes.length ? routes : ["/portfolio", "/garden"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
for (const route of list) {
  await p.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle" });
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(1200);
  const name = route.replace(/\//g, "_").replace(/^_/, "") || "home";
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("shot", name);
}
await b.close();
