/* Screenshot a running local build for design review.
   Usage: npx next start -p <port>, then
          node scripts/dev/shot-review.mjs <outDir> <port> <route>... */
import { chromium } from "playwright";
const [out, port = "3578", ...routes] = process.argv.slice(2);
const list = routes.length ? routes : ["/portfolio", "/garden", "/story"];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
for (const route of list) {
  await p.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1400);
  const name = route.replace(/\//g, "_").replace(/^_/, "") || "home";
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log("shot", name);
}
await b.close();
