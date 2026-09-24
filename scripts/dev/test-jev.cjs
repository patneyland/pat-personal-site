const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.JEV_TEST_URL || 'http://127.0.0.1:3217';
const artifacts = path.resolve(__dirname, '../../tmp/jev-test');
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/arcade/jev.html');
    await page.getByText('NOT CONNECTED', { exact: true }).waitFor();
    assert.equal(await page.locator('#start').isDisabled(), true);
    await page.screenshot({ path: path.join(artifacts, 'jev-desktop.png') });
    let directions = [], slow = false, call = 0;
    await page.route('**/api/jev', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { ready: true } });
      const b = route.request().postDataJSON();
      const head = b.snake[0], food = b.food;
      // Deterministic fixture controller, never a claimed Jev result.
      const dir = directions.shift() || (head.x < food.x && b.direction !== 'left' ? 'right' : head.x > food.x && b.direction !== 'right' ? 'left' : head.y < food.y && b.direction !== 'up' ? 'down' : 'up');
      call++;
      if (slow) await new Promise(r => setTimeout(r, 600));
      await route.fulfill({ json: { direction: dir, confidence: .9, model: 'TEST-FIXTURE', latencyMs: 100 } }).catch(() => {});
    });
    await page.reload();
    await page.getByText('READY', { exact: true }).waitFor();
    await page.locator('#start').click();
    await page.waitForFunction(() => Number(document.getElementById('moves').textContent) >= 4);
    assert.ok(await page.locator('.command').count() >= 4);
    assert.equal(await page.locator('#model').textContent(), 'TEST-FIXTURE');
    await page.locator('#pause').click();
    const count = await page.locator('#moves').textContent();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#moves').textContent(), count, 'pause must stop moves');
    assert.equal(await page.locator('#status').textContent(), 'PAUSED');
    slow = true;
    await page.locator('#pause').click();
    await page.waitForTimeout(100);
    await page.locator('#pause').click();
    await page.waitForTimeout(750);
    assert.equal(await page.locator('#moves').textContent(), count, 'late answer after pause must be discarded');
    slow = false; directions = Array(20).fill('right');
    await page.locator('#restart').click();
    await page.getByText('GAME OVER', { exact: true }).first().waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#moves').textContent(), '16');
    assert.equal(await page.locator('#pause').isDisabled(), true);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    const log = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(log.runs.length, 2);
    assert.equal(log.runs[1].moves.length, 16);
    assert.equal(log.runs[1].moves[0].direction, 'right');
    assert.equal(log.runs[1].result, 'game-over');
    await page.locator('#restart').click();
    await page.waitForFunction(() => Number(document.getElementById('moves').textContent) >= 3);
    await page.locator('#pause').click();
    await page.evaluate(() => document.getElementById('notice').textContent = 'LAYOUT TEST · scripted inputs, not Jev results');
    await page.screenshot({ path: path.join(artifacts, 'jev-layout-test.png') });
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
      const board = await page.locator('#board').boundingBox();
      assert.ok(board.width > 250 && board.height > 200);
      await page.screenshot({ path: path.join(artifacts, 'jev-' + viewport.width + '.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: disconnected state, live command display, pause, stale response cancellation, restart, collision, downloadable full log, desktop/mobile geometry. Mocked Jev only.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
