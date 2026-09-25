// Record a Jev game on the real engine, then replay it as the /arcade-jev
// attract screen and check the replay reproduces the same game. Also checks
// the plain /arcade never mentions Jev outside his leaderboard row. Choices
// come from the FIXTURE POLICY, not Jev; nothing is written to the real
// leaderboard.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { loadRoute, fixturePolicy, instrumentSnake } = require('./jev-fixture.cjs');
const base = process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // 1. Record: let the fixture eat a few apples, then slow it so it dies for real.
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { sessionStorage.setItem('arcade_credited', '1'); });
    const posts = [];
    await page.route('**/*.supabase.co/**', r => {
      if (r.request().method() === 'POST') { posts.push({ url: r.request().url(), body: r.request().postDataJSON() }); return r.fulfill({ json: { ok: true, improved: true, first: false } }); }
      return r.fulfill({ json: [], headers: { 'content-range': '0-0/0' } });
    });
    await instrumentSnake(page);
    const api = loadRoute(fixturePolicy), control = { delay: 120 };
    await page.route('**/api/jev', async r => {
      if (r.request().method() === 'GET') return r.fulfill({ json: { ready: true } });
      const body = r.request().postDataJSON();
      await new Promise(res => setTimeout(res, control.delay));
      const out = await api.post(body);
      await r.fulfill({ status: out.status, json: out.json }).catch(() => {});
    });
    await page.goto(base + '/arcade-jev?game=snake'); await page.getByText('READY', { exact: true }).waitFor();
    await page.locator('#j-start').click();
    await page.waitForFunction(() => window.__testSnake.snapshot().score >= 40, null, { timeout: 60000 });
    control.delay = 4000;
    await page.waitForFunction(() => window.__testSnake.snapshot().state === 'over', null, { timeout: 60000 });
    const final = await page.evaluate(() => window.__testSnake.snapshot());
    const replay = await page.evaluate(() => { const r = window.__jevRuns; return JSON.parse(JSON.stringify(r[r.length - 1].replay)); });
    assert.equal(replay.score, final.score); assert.equal(replay.ticks, final.tick);
    assert.equal(replay.foods.length, final.score / 10 + 1, 'One apple per score step plus the first');
    await page.getByText('NEW JEV BEST · SAVED TO THE BOARD', { exact: true }).waitFor();
    assert.ok(posts[0].url.endsWith('/rpc/submit_jev_score'));
    assert.deepEqual(posts[0].body.p_replay, replay, 'Recording is posted with the score');
    assert.equal(posts[0].body.p_secret, undefined, 'No owner key needed');
    require('node:fs').writeFileSync('tmp/jev-replay-sample.json', JSON.stringify(replay));
    const kb = Buffer.byteLength(JSON.stringify(replay)) / 1024;
    console.log(`PASS recorded Jev game: score ${final.score}, ${final.tick} ticks, ${replay.moves.length} turns, ${kb.toFixed(1)} KB, posted with the score`);
    await page.close();

    // 2. Replay it as the attract screen on Jev's own page.
    const view = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    view.on('pageerror', e => errors.push(e.message));
    const replayBoard = r => r.fulfill({ json: r.request().url().includes('replay=not.is.null') ? [{ score: replay.score, replay }] : [], headers: { 'content-range': '0-0/0' } });
    await view.route('**/*.supabase.co/**', replayBoard);
    await instrumentSnake(view);
    const started = Date.now();
    await view.goto(base + '/arcade-jev?game=snake');
    await view.waitForFunction(() => document.querySelector('.jev-panel .j-mode').dataset.mode === 'replay');
    assert.equal(await view.locator('.ov-demo-play').isVisible(), false, 'No TRY TO BEAT JEV AND PAT button on the Jev page');
    assert.match(await view.locator('.ov-demo-tag').textContent(), new RegExp('JEV.*' + replay.score.toLocaleString('en-US')));
    await view.waitForFunction(() => window.__testSnake.snapshot().score >= 20);
    const mid = await view.evaluate(() => window.__testSnake.snapshot());
    assert.equal(mid.state, 'idle', 'Replay runs as attract mode');
    await view.screenshot({ path: 'tmp/jev-replay-attract.png' });
    await view.waitForFunction(r => { const s = window.__testSnake.snapshot(); return s.score === r.score && s.tick === r.ticks; }, replay, { timeout: 120000 });
    const end = await view.evaluate(() => window.__testSnake.snapshot());
    assert.deepEqual(end.snake, final.snake, 'Replay ends with the exact recorded body');
    console.log(`PASS replay reproduced the game exactly (score ${end.score}, tick ${end.tick}) in ${((Date.now() - started) / 1000).toFixed(0)}s at game speed`);
    // Loops after the recorded death.
    await view.waitForFunction(() => window.__testSnake.snapshot().tick < 20, null, { timeout: 8000 });
    await view.close();

    // 4. The plain arcade is the plain game. Jev's best run is on offer from
    //    the same mocked board, and the page must still ignore it.
    const plain = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    plain.on('pageerror', e => errors.push(e.message));
    await plain.route('**/*.supabase.co/**', replayBoard);
    await instrumentSnake(plain);
    await plain.goto(base + '/arcade?game=snake');
    await plain.locator('.insert').waitFor({ state: 'visible' });
    await plain.waitForTimeout(4000);
    const still = await plain.evaluate(() => window.__testSnake.snapshot());
    assert.equal(still.state, 'idle', 'Nothing plays itself on the main arcade');
    assert.equal(still.tick, 0, 'No replay is running');
    assert.equal(still.score, 0);
    assert.equal(await plain.locator('.ov-demo-tag').count(), 0, 'No Jev tag on the attract screen');
    assert.equal(await plain.locator('.ov-demo-play').count(), 0, 'No TRY TO BEAT JEV button');
    assert.equal(await plain.locator('.screen-ui[data-demo="on"]').count(), 0);
    assert.ok(!(await plain.locator('.screen-ui').innerHTML()).match(/jev/i), 'The word JEV appears nowhere on the screen');
    assert.equal(await plain.locator('[data-ov="attract"] .ov-title').textContent(), 'SNAKE', 'The ordinary attract sign is showing');
    console.log('PASS /arcade shows the ordinary attract screen with no mention of Jev');
    await plain.close();

    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
