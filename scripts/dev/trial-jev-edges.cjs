// REAL Jev trials (costs money). Runs the actual /api/jev route against
// OpenRouter with the key in OPENROUTER_API_KEY (never printed or saved), on
// the real engine at normal speed. Only the first apple position is placed by
// the harness; everything after is the engine's own random food.
//   node scripts/dev/trial-jev-edges.cjs <out.json> [edges|free] [seconds]
const { chromium } = require('playwright');
const fs = require('node:fs');
const { instrumentSnake } = require('./jev-fixture.cjs');
const base = process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';
const key = process.env.OPENROUTER_API_KEY;
if (!/^sk-or-[A-Za-z0-9_-]{10,250}$/.test(key || '')) { console.error('OPENROUTER_API_KEY missing or malformed.'); process.exit(1); }
const [out, mode = 'edges', seconds = '45'] = process.argv.slice(2);
const edges = [
  ['right edge', { x: 23, y: 12 }], ['top edge', { x: 15, y: 0 }], ['bottom edge', { x: 15, y: 23 }], ['left edge', { x: 0, y: 12 }],
  ['top-right corner', { x: 23, y: 0 }], ['bottom-right corner', { x: 23, y: 23 }], ['top-left corner', { x: 0, y: 0 }], ['bottom-left corner', { x: 0, y: 23 }]
];
const scenarios = mode === 'free' ? Array.from({ length: Number(process.env.RUNS || 2) }, (_, n) => ['free run ' + (n + 1), null]) : edges;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [], requests = [];
  let total = 0, unknown = 0;
  try {
    for (const [name, food] of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await page.addInitScript(k => { sessionStorage.setItem('arcade_credited', '1'); localStorage.setItem('arcade-jev-openrouter-key', k); }, key);
      await page.route('**/*.supabase.co/**', r => r.fulfill({ json: [] })); // never write real scores
      await instrumentSnake(page);
      await page.route('**/api/jev', async r => {
        const res = await r.fetch();
        if (r.request().method() === 'POST') {
          const json = await res.json().catch(() => ({}));
          const cost = json.usage && json.usage.cost;
          if (typeof cost === 'number') total += cost; else unknown++;
          requests.push({ scenario: name, status: res.status(), cost: typeof cost === 'number' ? cost : null, generationId: json.generationId || null, choice: json.choice || null, latencyMs: json.latencyMs, candidates: json.candidates });
          return r.fulfill({ response: res, json });
        }
        return r.fulfill({ response: res });
      });
      await page.goto(base + '/arcade-jev'); await page.getByText('READY', { exact: true }).waitFor({ timeout: 20000 });
      await page.evaluate(f => { window.__foods = f ? [f] : []; window.__spawned = []; }, food);
      await page.locator('#j-start').click();
      const deadline = Date.now() + Number(seconds) * 1000;
      if (food) {
        await page.waitForFunction(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; }, null, { timeout: 30000 }).catch(() => {});
        const eat = await page.evaluate(() => (window.__spawned.find(f => f.tick > 0) || {}).tick);
        if (eat != null) await page.waitForFunction(t => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.tick >= t + 8; }, eat, { timeout: 10000 }).catch(() => {});
      } else {
        while (Date.now() < deadline && (await page.evaluate(() => window.__testSnake.snapshot().state)) === 'playing') await page.waitForTimeout(250);
      }
      const snap = await page.evaluate(() => window.__testSnake.snapshot());
      const eatTick = await page.evaluate(() => (window.__spawned.find(f => f.tick > 0) || {}).tick ?? null);
      if (snap.state === 'playing') await page.locator('#j-pause').click();
      const run = await page.evaluate(() => { const r = window.__jevRuns; return JSON.parse(JSON.stringify(r[r.length - 1])); });
      const firstEat = run.plans.find(p => p.eats && p.outcome !== 'late' && p.outcome !== 'failed');
      const escaped = food ? snap.score >= 10 && (snap.state === 'playing' || snap.tick >= eatTick + 8) : null;
      const r = { scenario: name, food, score: snap.score, endedBy: snap.state === 'over' ? 'death' : 'stopped by harness', ticks: snap.tick, tickMs: snap.tickMs, eatTick, escaped,
        firstEatingPlan: firstEat ? { choice: firstEat.choice, requestTick: firstEat.board.tick, eatTick: firstEat.eatTick, escape: firstEat.escape, decisionDelayTicks: firstEat.decisionDelayTicks, latencyMs: firstEat.latencyMs } : null,
        plans: run.plans.length, outcomes: run.plans.reduce((m, p) => { m[p.outcome] = (m[p.outcome] || 0) + 1; return m; }, {}), turns: run.commands.length, run };
      results.push(r);
      console.log(`${name.padEnd(20)} score ${snap.score} ${r.endedBy} tick ${snap.tick}` + (food ? ` escaped=${escaped}` : '') + (r.firstEatingPlan ? ` · ${r.firstEatingPlan.choice} decided for tick ${r.firstEatingPlan.requestTick}, eat ${r.firstEatingPlan.eatTick}` : '') + ` · plans ${JSON.stringify(r.outcomes)}`);
      await page.close();
    }
  } finally {
    await browser.close();
    const cost = { usd: total, unknownRequests: unknown, requests };
    fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), model: 'typesafe/jev-1.13 via /api/jev', mode, results, cost }, null, 2));
    fs.writeFileSync(out.replace(/\.json$/, '.cost.json'), JSON.stringify(cost, null, 2));
    console.log(`TOTAL cost $${total.toFixed(6)} over ${requests.length} requests` + (unknown ? `, ${unknown} unknown` : ''));
  }
})().catch(e => { console.error(e); process.exit(1); });
