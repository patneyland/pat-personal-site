// Multi-turn schedule behaviour on the real engine. Choices come from the
// FIXTURE POLICY over the real candidate generator, never from Jev.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { loadRoute, fixturePolicy, instrumentSnake } = require('./jev-fixture.cjs');
const base = process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';

async function setup(browser, foods, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem('arcade_credited', '1'));
  await page.route('**/*.supabase.co/**', r => r.fulfill({ json: [] }));
  await instrumentSnake(page, opts);
  const api = loadRoute(fixturePolicy), control = { delay: 150, fail: 0, requests: 0 };
  await page.route('**/api/jev', async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: { ready: true } });
    control.requests++;
    const body = r.request().postDataJSON();
    await new Promise(res => setTimeout(res, control.delay));
    if (control.fail > 0) { control.fail--; return r.fulfill({ status: 502, json: { error: 'Fixture upstream failure.' } }).catch(() => {}); }
    const out = await api.post(body);
    await r.fulfill({ status: out.status, json: out.json }).catch(() => {});
  });
  await page.goto(base + '/arcade-jev'); await page.getByText('READY', { exact: true }).waitFor();
  await page.evaluate(f => { window.__foods = f; window.__spawned = []; }, foods);
  return { page, control, errors,
    snap: () => page.evaluate(() => window.__testSnake.snapshot()),
    run: () => page.evaluate(() => { const r = window.__jevRuns; return JSON.parse(JSON.stringify(r[r.length - 1])); }),
    until: (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }) };
}
const alive = s => s.state === 'playing';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // 1. Next apple spawns on the planned escape path: the known continuation
    // stops before it, and the next plan eats it.
    {
      const t = await setup(browser, [{ x: 23, y: 12 }, { x: 23, y: 7 }, { x: 5, y: 20 }]);
      await t.page.locator('#j-start').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 20; });
      assert.ok(alive(await t.snap()), 'Survived an apple on the escape path');
      console.log('PASS apple spawned on the escape path was planned for and eaten');
      await t.page.close();
    }
    // 1b. Apple directly in front of the escape: engine eats it, controller replans.
    {
      const t = await setup(browser, [{ x: 23, y: 12 }, { x: 23, y: 11 }, { x: 23, y: 13 }, { x: 5, y: 20 }]);
      await t.page.locator('#j-start').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 20; });
      const eatTick = (await t.page.evaluate(() => window.__spawned.filter(f => f.tick > 0)))[1].tick;
      await t.until(tk => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.tick >= tk + 8; }, eatTick);
      assert.ok(alive(await t.snap()), 'Survived an apple immediately in front of the escape');
      console.log('PASS apple spawned directly on the escape cell');
      await t.page.close();
    }
    // 2. Accelerated clock: the engine at its 60ms floor, same edge apple.
    {
      const t = await setup(browser, [{ x: 23, y: 0 }, { x: 12, y: 12 }], { startTickMs: 60 });
      await t.page.locator('#j-start').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; });
      const eatTick = (await t.page.evaluate(() => window.__spawned.find(f => f.tick > 0))).tick;
      await t.until(tk => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.tick >= tk + 10; }, eatTick);
      const s = await t.snap(); assert.ok(alive(s)); assert.equal(s.tickMs, 60);
      const plan = (await t.run()).plans.find(p => p.eats);
      assert.ok(plan.decisionDelayTicks >= 3, 'Delay measured in faster ticks');
      console.log('PASS corner apple at the 60ms floor; decision delay ' + plan.decisionDelayTicks + ' ticks');
      await t.page.close();
    }
    // 3. Failed requests retry without pausing; the clock never waits.
    {
      const t = await setup(browser, [{ x: 20, y: 2 }, { x: 12, y: 12 }]);
      t.control.fail = 2;
      await t.page.locator('#j-start').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; });
      const r = await t.run();
      assert.ok(alive(await t.snap()));
      assert.equal(r.plans.filter(p => p.outcome === 'failed').length, 2);
      console.log('PASS two failed requests retried, apple eaten, clock never paused');
      await t.page.close();
    }
    // 4. Human intervention mid-plan invalidates the schedule and labels the run.
    {
      const t = await setup(browser, [{ x: 20, y: 2 }, { x: 12, y: 12 }]);
      await t.page.locator('#j-start').click();
      await t.until(() => window.__jevRuns.length && window.__jevRuns[window.__jevRuns.length - 1].commands.length >= 1);
      const s0 = await t.snap();
      await t.page.keyboard.press(s0.direction === 'up' || s0.direction === 'down' ? 'ArrowRight' : 'ArrowDown');
      await t.until(() => { const r = window.__jevRuns[window.__jevRuns.length - 1]; return r.plans.some(p => /invalidated/.test(p.outcome + ' ' + (p.dropped || ''))); });
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; });
      const hs = await t.snap(); if (!alive(hs)) console.log(JSON.stringify({ s0, hs, plans: (await t.run()).plans.map(p => [p.outcome, p.dropped, p.choice, p.board && p.board.tick, p.observed.tick, p.latencyMs]) }));
      assert.ok(alive(hs), 'Replanned after the human key');
      console.log('PASS human key invalidated the queued plan; Jev replanned and ate');
      await t.page.close();
    }
    // 5. Pause and resume during a queued multi-turn plan.
    {
      const t = await setup(browser, [{ x: 20, y: 2 }, { x: 12, y: 12 }]);
      await t.page.locator('#j-start').click();
      await t.until(() => /PLAN/.test(document.getElementById('j-plan').textContent));
      await t.page.locator('#j-pause').click();
      assert.equal(await t.page.locator('#j-plan').textContent(), '', 'Pause clears the queued turns');
      const paused = await t.snap(); await t.page.waitForTimeout(400);
      assert.deepEqual(await t.snap(), paused);
      await t.page.locator('#j-pause').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; });
      assert.ok(alive(await t.snap()));
      assert.ok((await t.run()).plans.some(p => p.outcome === 'cancelled'));
      console.log('PASS pause cancelled queued turns; resume replanned from the live board');
      await t.page.close();
    }
    // 6. A slow model dies for real; restart discards its in-flight plan.
    {
      const t = await setup(browser, [{ x: 23, y: 12 }, { x: 12, y: 12 }]);
      t.control.delay = 2500;
      await t.page.locator('#j-start').click();
      await t.until(() => window.__testSnake.snapshot().state === 'over');
      t.control.delay = 150;
      await t.page.evaluate(() => { window.__foods = [{ x: 23, y: 12 }, { x: 12, y: 12 }]; });
      await t.page.locator('#j-start').click();
      await t.until(() => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.score >= 10; });
      const eatTick = (await t.page.evaluate(() => window.__spawned.filter(f => f.tick > 0).pop())).tick;
      await t.until(tk => { const s = window.__testSnake.snapshot(); return s.state === 'over' || s.tick >= tk + 8; }, eatTick);
      assert.ok(alive(await t.snap()));
      assert.equal((await t.page.evaluate(() => window.__jevRuns.length)), 2);
      console.log('PASS slow run lost at the wall; restart ran a clean schedule and escaped');
      assert.deepEqual(t.errors, []);
      await t.page.close();
    }
    console.log('PASS: schedule suite. All choices from the fixture policy, not Jev.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
