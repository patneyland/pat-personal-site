// Run with: node scripts/dev/test-recovery.mjs
// Uses the real React components in an isolated browser fixture. All chat and
// Supabase requests are handled locally; nothing reaches the live services.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'pat-site-recovery-'));
const webpackModule = require('next/dist/compiled/webpack/webpack');
webpackModule.init();
await fs.writeFile(path.join(fixture, 'loader.cjs'), `
const ts = require(${JSON.stringify(require.resolve('typescript'))});
module.exports = function(source) {
  return ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
};
`);
await fs.writeFile(path.join(fixture, 'navigation.js'), 'export const usePathname = () => "/fun";');
await fs.writeFile(path.join(fixture, 'entry.tsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GaryProvider, GaryConversation, useGary } from '@/components/ui/GaryChat';
import { LiveDashboard } from '@/components/pullups/LiveDashboard';
function Chat() {
  const { open, setOpen } = useGary();
  const [presenter, setPresenter] = useState(0);
  return <><button onClick={() => setOpen(!open)}>{open ? 'Close panel' : 'Open panel'}</button>
    <button onClick={() => setPresenter(p => p + 1)}>Move panel</button>
    {open && <div id="conversation"><GaryConversation key={presenter} /></div>}</>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode>
  <GaryProvider enabled greeting="Fixture greeting"><Chat /></GaryProvider>
  <div id="dashboard"><LiveDashboard initial={null} /></div>
</React.StrictMode>);
`);
await new Promise((resolve, reject) => {
  const compiler = webpackModule.webpack({
    mode: 'development', devtool: false, context: root,
    entry: path.join(fixture, 'entry.tsx'),
    output: { path: fixture, filename: 'bundle.js' },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      modules: [path.join(root, 'node_modules')],
      alias: { '@': path.join(root, 'src'), 'next/navigation': path.join(fixture, 'navigation.js') },
    },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(fixture, 'loader.cjs') }] },
  });
  compiler.run((error, stats) => compiler.close(() => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
});

const chatRequests = [];
let firstResponse;
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/gary') {
    let body = '';
    for await (const chunk of req) body += chunk;
    chatRequests.push(JSON.parse(body));
    if (chatRequests.length === 3) {
      res.writeHead(503); res.end('Fixture service unavailable'); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    if (chatRequests.length === 1) {
      firstResponse = res;
      res.write('First reply ');
    } else res.end('Reply completed');
  } else if (req.url === '/bundle.js' || req.url === '/net.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(await fs.readFile(req.url === '/net.js'
      ? path.join(root, 'public/arcade/net.js') : path.join(fixture, 'bundle.js')));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Recovery regression checks</title><div id="root"></div><script src="/net.js"></script><script src="/bundle.js"></script>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let feedHealthy = false, boardHealthy = false, feedReads = 0, boardReads = 0;
  const stats = { ok: true, goal: 20, deadline: '2026-12-27', days_left: 100,
    today: '2026-09-12', best_ever: 8, timezone: 'America/Phoenix',
    days: [{ day: '2026-09-12', total: 8, sets: 1, best: 8, reps: [8] }] };
  await page.route('https://pikvadotiruvanjjnfid.supabase.co/**', async route => {
    const url = route.request().url();
    if (url.includes('/functions/')) {
      feedReads++;
      await route.fulfill({ status: feedHealthy ? 200 : 503, json: stats });
    } else {
      boardReads++;
      await route.fulfill({ status: boardHealthy ? 200 : 503,
        headers: { 'content-range': '0-0/1', 'access-control-expose-headers': 'content-range' },
        json: [{ id: 'fixture', player: 'Fixture', score: 8, is_owner: true }] });
    }
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText('No signal.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open panel' }).click();
  const input = page.getByPlaceholder('Ask Gary');
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await input.fill('First question');
  await send.click();
  await page.getByText('First reply', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Open panel' }).click();
  await input.fill('Should wait');
  assert.equal(await send.isDisabled(), true);
  await input.press('Enter');
  await page.getByRole('button', { name: 'Move panel' }).click();
  await input.fill('Second question');
  assert.equal(await send.isDisabled(), true);
  assert.equal(chatRequests.length, 1);
  firstResponse.end('[garden](/garden) [external](https://example.com/?a=1&b=2) '
    + '[unsafe](https://example.invalid/"onmouseover="this.textContent=\'injected\') '
    + '<img src=x onerror=alert(1)> [script](javascript:alert(1))');
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Send"]').disabled);
  assert.equal(await page.locator('#conversation [onmouseover], #conversation [onerror], #conversation img, #conversation script').count(), 0);
  assert.equal(await page.getByRole('link', { name: 'garden', exact: true }).getAttribute('href'), '/garden');
  assert.equal(await page.getByRole('link', { name: 'external', exact: true }).getAttribute('href'), 'https://example.com/?a=1&b=2');
  assert.equal(await page.getByRole('link', { name: 'unsafe', exact: true }).count(), 0);
  await send.click();
  await page.getByText('Reply completed', { exact: true }).waitFor();
  assert.equal(chatRequests.length, 2);
  assert.equal(chatRequests[1].messages.length, 3);
  assert.equal(await page.getByText('First question', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Second question', { exact: true }).count(), 1);
  console.log('PASS: safe links and streaming survive close/reopen and presenter changes');

  await input.fill('Fail this request'); await send.click();
  await page.getByText('Fixture service unavailable', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Open panel' }).click();
  await page.getByText('Fixture service unavailable', { exact: true }).waitFor();
  await input.fill('Retry'); await send.click();
  await page.waitForFunction(() => !document.body.textContent.includes('Fixture service unavailable'));
  assert.equal(chatRequests.length, 4);
  console.log('PASS: failed chat request releases the lock and preserves its error across reopening');

  assert.ok(feedReads > 0);
  await page.clock.install();
  feedHealthy = true;
  await page.clock.fastForward(20_100);
  await page.getByRole('heading', { name: 'Recent days' }).waitFor();
  assert.equal(await page.getByText('No signal.', { exact: true }).count(), 0);
  assert.equal(await page.locator('#dashboard footer').innerText(), stats.timezone);
  feedHealthy = false;
  await page.clock.fastForward(20_100);
  assert.equal(await page.getByRole('heading', { name: 'Recent days' }).count(), 1);
  console.log('PASS: pull-up polling recovers from null initial data and retains data on later failures');

  const failed = await page.evaluate(async () => {
    await window.ArcadeNet.fetchScores('snake', 'classic');
    return window.ArcadeNet.isOffline();
  });
  assert.equal(failed, true);
  boardHealthy = true;
  const recovered = await page.evaluate(async () => {
    const net = window.ArcadeNet;
    const [rows, owner, rank] = await Promise.all([
      net.fetchScores('snake', 'classic'), net.fetchOwnerBest('snake', 'classic'), net.fetchRank('snake', 'classic', 8),
    ]);
    return { rows: rows.length, owner: owner?.id, rank, offline: net.isOffline() };
  });
  assert.deepEqual(recovered, { rows: 1, owner: 'fixture', rank: 2, offline: false });
  assert.equal(boardReads, 4);
  assert.deepEqual(errors, []);
  console.log('PASS: board, owner score, and rank retry after a failed read');
} finally {
  firstResponse?.end();
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(fixture).startsWith('pat-site-recovery-'));
  await fs.rm(fixture, { recursive: true, force: true });
}
