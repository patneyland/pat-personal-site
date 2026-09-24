// Test harness only. Runs the real /api/jev route in Node with a fake upstream
// whose choice comes from a FIXTURE POLICY, never from Jev. Browser tests use it
// to exercise the real candidate generator and the real engine without spend.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadRoute(chooser) {
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/../../src/app/api/jev/route.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exportsObject = {};
  const calls = [];
  const context = { exports: exportsObject, process: { env: { TYPESAFE_API_KEY: 'fixture-key' } }, Response, AbortSignal, performance, console, URL,
    fetch: async (_, opts) => {
      const payload = JSON.parse(opts.body);
      const choice = chooser(payload.questions.move.criteria, JSON.parse(payload.state));
      calls.push({ payload, choice });
      return Response.json({ answers: { move: { choice, confidence: 1 } }, model: 'TEST-FIXTURE-POLICY' });
    } };
  vm.runInNewContext(code, context);
  async function post(body) {
    const req = { headers: new Headers({ host: 'localhost:3217' }), nextUrl: new URL('http://localhost:3217/api/jev'), text: async () => JSON.stringify(body) };
    const res = await exportsObject.POST(req);
    return { status: res.status, json: await res.json() };
  }
  return { post, calls, GET: exportsObject.GET };
}

// Fixture policy: take the eating trajectory with the most room after escape;
// otherwise the non-eating segment with the most progress. Old-format
// candidates (eatsApple on a segment) are handled so the pre-change
// controller can be reproduced with the same harness.
function fixturePolicy(criteria) {
  const entries = Object.entries(criteria);
  const eats = entries.filter(([, v]) => v && (v.eatsApple || v.afterEating));
  const room = v => v.afterEating ? (v.afterEating.reachableCells || -1) * 100 + (v.afterEating.clearCellsAhead || 0) : 0;
  if (eats.length) return eats.sort((a, b) => room(b[1]) - room(a[1]))[0][0];
  const score = v => (v.progressTowardApple || 0) * 10 + (v.alignedForNextTurn ? 5 : 0) + Math.min(v.reachableCellsAtEnd || 0, 50) / 10;
  return entries.sort((a, b) => score(b[1]) - score(a[1]))[0][0];
}

// Rewrites the served engine so a test can decide where food spawns and read
// state. Game rules and timing are untouched.
async function instrumentSnake(page, opts = {}) {
  await page.route('**/arcade/snake.js', async r => {
    const res = await r.fetch();
    let body = await res.text();
    body = body.replace('return {\n      start:', 'return window.__testSnake = {\n      start:');
    body = body.replace('food = free.length ? free[Math.floor(Math.random() * free.length)] : null;',
      'var planned = (window.__foods || []).shift(); food = planned && free.some(function (p) { return p.x === planned.x && p.y === planned.y; }) ? { x: planned.x, y: planned.y } : (free.length ? free[Math.floor(Math.random() * free.length)] : null); (window.__spawned = window.__spawned || []).push(food && { x: food.x, y: food.y, tick: ticks });');
    if (opts.startTickMs) body = body.replace('var START_TICK_MS = 130;', 'var START_TICK_MS = ' + opts.startTickMs + ';');
    if (!body.includes('window.__foods')) throw new Error('Could not instrument snake.js');
    await r.fulfill({ response: res, body });
  });
}

module.exports = { loadRoute, fixturePolicy, instrumentSnake };
