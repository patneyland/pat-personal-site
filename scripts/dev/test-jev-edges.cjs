// Edge and corner apples on the real engine at normal speed. The choice comes
// from a FIXTURE POLICY run against the real candidate generator, not from Jev:
// this proves the controller can express and execute acquisition + escape
// before the deadline. Real Jev trials are scripts/dev/trial-jev-edges.cjs.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { loadRoute, fixturePolicy, instrumentSnake } = require('./jev-fixture.cjs');
const base = process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';
const scenarios = [
  ['right edge', { x: 23, y: 12 }], ['top edge', { x: 15, y: 0 }], ['bottom edge', { x: 15, y: 23 }], ['left edge', { x: 0, y: 12 }],
  ['top-right corner', { x: 23, y: 0 }], ['bottom-right corner', { x: 23, y: 23 }], ['top-left corner', { x: 0, y: 0 }], ['bottom-left corner', { x: 0, y: 23 }]
];
const only = process.argv[2];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const [name, food] of scenarios.filter(([n]) => !only || n.includes(only))) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => sessionStorage.setItem('arcade_credited', '1'));
      await page.route('**/*.supabase.co/**', r => r.fulfill({ json: [] }));
      await instrumentSnake(page);
      const api = loadRoute(fixturePolicy);
      await page.route('**/api/jev', async r => {
        if (r.request().method() === 'GET') return r.fulfill({ json: { ready: true } });
        await new Promise(res => setTimeout(res, 150)); // plausible network + inference delay
        const out = await api.post(r.request().postDataJSON());
        await r.fulfill({ status: out.status, json: out.json }).catch(() => {});
      });
      await page.goto(base + '/arcade-jev'); await page.getByText('READY', { exact: true }).waitFor();
      await page.evaluate(f => { window.__foods = [f, { x: 12, y: 12 }, { x: 5, y: 5 }]; window.__spawned = []; }, food);
      await page.locator('#j-start').click();
      await page.waitForFunction(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; }, null, { timeout: 15000 });
      const eatTick = await page.evaluate(() => (window.__spawned.find(f => f.tick > 0) || {}).tick);
      const reached = await page.waitForFunction(t => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.tick >= t + 8; }, eatTick, { timeout: 5000 }).then(() => true, () => false);
      const s = await page.evaluate(() => window.__testSnake.snapshot());
      const runs = await page.evaluate(() => window.__jevRuns ? JSON.parse(JSON.stringify(window.__jevRuns)) : null);
      const run = runs && runs[runs.length - 1];
      const plan = run && run.plans.find(p => p.eats);
      const ok = reached && s.state === 'playing' && s.score >= 10 && s.tickMs === 126.5 && !errors.length;
      let detail = `score ${s.score}, state ${s.state}, eat tick ${eatTick}, tick ${s.tick}`;
      if (plan) detail += `; chose ${plan.choice} at request tick ${plan.board.tick}, escape ${plan.escape || 'none'} scheduled for tick ${plan.eatTick}`;
      if (ok && plan) {
        assert.ok(plan.board.tick < eatTick, 'Escape was decided before eating');
        const escape = run.commands.find(c => c.tick === plan.eatTick);
        if (plan.escape) assert.ok(escape && escape.direction === plan.escape, 'Escape key sent at the eating tick');
      }
      console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(20) + detail);
      if (!ok) failures.push(name);
      await page.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
  console.log('PASS: every edge and corner apple eaten and escaped at the original 130ms clock. Choices from the fixture policy, not Jev.');
})().catch(e => { console.error(e); process.exit(1); });
