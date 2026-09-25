const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(__dirname + '/../../src/app/api/jev/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const env = {}, exportsObject = {};
let called = 0, payload;
let answer = { answers: { move: { choice: 'up', confidence: .8 } }, model: 'fixture' };
const context = { exports: exportsObject, process: { env }, Response, AbortSignal, performance, console, URL,
  fetch: async (_, opts) => { called++; payload = JSON.parse(opts.body); return Response.json(answer); } };
vm.runInNewContext(code, context);
const board = { grid: 24, snake: [{x:8,y:12},{x:7,y:12},{x:6,y:12}], food: {x:10,y:10}, direction: 'right' };
function request(body) { return { headers: new Headers({ host: 'localhost:3217', origin: 'http://localhost:3217' }), nextUrl: new URL('http://localhost:3217/api/jev'), text: async () => JSON.stringify(body) }; }
(async () => {
  assert.equal((await exportsObject.POST(request(board))).status, 503);
  env.TYPESAFE_API_KEY = 'fixture-key';
  assert.equal((await exportsObject.POST(request({ ...board, snake: [] }))).status, 400);
  assert.equal(called, 0);
  const response = await exportsObject.POST(request(board));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).direction, 'up');
  assert.equal(payload.model, 'jev-latest');
  assert.deepEqual(Object.keys(payload.questions.move.criteria), ['up', 'down', 'right']);
  answer = { answers: { move: { choice: 'up_2' } } };
  const planned = await exportsObject.POST(request({ ...board, plan: true }));
  const plan = await planned.json();
  assert.equal(plan.direction, 'up'); assert.equal(plan.steps, 2);
  assert.ok(payload.questions.move.criteria.up_2.alignedForNextTurn);
  assert.equal(payload.questions.move.criteria.right_2.progressTowardApple, 2);
  assert.ok(!Object.keys(payload.questions.move.criteria).some(k => k.startsWith('left_')));
  // Segments now stop before the apple; eating is a route with a chosen escape.
  answer = { answers: { move: { choice: 'eat_right2_then_up' } } };
  const appleBoard = { ...board, plan: true, food: {x:10,y:12}, decisionDelayTicks: 3 };
  const eat = await (await exportsObject.POST(request(appleBoard))).json();
  assert.deepEqual(eat.turns, [{ direction: 'right', steps: 2 }]); assert.equal(eat.eats, true); assert.equal(eat.escape, 'up');
  let c = payload.questions.move.criteria;
  assert.equal(c.right_2, undefined, 'Straight segments never run through the apple');
  assert.ok(c.right_1 && c.eat_right2_then_right && c.eat_right2_then_up && c.eat_right2_then_down);
  assert.equal(c.eat_right2_then_up.afterEating.bodyLength, 4, 'Growth is simulated');
  assert.equal(JSON.parse(payload.state).decisionDelayTicks, 3);
  // Wall apple: travelling right into (23,12) leaves only up/down after eating.
  answer = { answers: { move: { choice: 'eat_right15_then_down' } } };
  await exportsObject.POST(request({ ...board, plan: true, food: {x:23,y:12}, decisionDelayTicks: 4 }));
  c = payload.questions.move.criteria;
  assert.equal(c.eat_right15_then_right, undefined, 'No escape through the wall');
  assert.equal(c.eat_right15_then_up.afterEating.clearCellsAhead, 12);
  assert.equal(c.eat_right15_then_up.afterEating.safeForNextDecision, true);
  // Corner apple arrived at heading up: only left remains.
  const corner = { grid: 24, snake: [{x:23,y:3},{x:23,y:4},{x:23,y:5}], food: {x:23,y:0}, direction: 'up', plan: true, decisionDelayTicks: 4 };
  answer = { answers: { move: { choice: 'eat_up3_then_left' } } };
  await exportsObject.POST(request(corner));
  c = payload.questions.move.criteria;
  assert.deepEqual(Object.keys(c).filter(k => k.startsWith('eat_up3_')), ['eat_up3_then_left']);
  // Body-blocked exit: a hook of body beside the apple removes that escape.
  const hook = { grid: 24, snake: [{x:5,y:5},{x:4,y:5},{x:4,y:4},{x:5,y:4},{x:6,y:4},{x:7,y:4},{x:8,y:4},{x:9,y:4},{x:10,y:4}], food: {x:7,y:5}, direction: 'right', plan: true };
  answer = { answers: { move: { choice: 'eat_right2_then_down' } } };
  await exportsObject.POST(request(hook));
  c = payload.questions.move.criteria;
  assert.equal(c.eat_right2_then_up, undefined, 'Body above the apple blocks up');
  assert.ok(c.eat_right2_then_down && c.eat_right2_then_right);
  // Growth versus departing tail: without eating the tail cell is free, after eating it is not.
  const loop = { grid: 24, snake: [{x:5,y:5},{x:6,y:5},{x:6,y:6},{x:5,y:6}], food: {x:20,y:20}, direction: 'up', plan: true };
  answer = { answers: { move: { choice: 'up_1' } } };
  await exportsObject.POST(request(loop));
  assert.ok(payload.questions.move.criteria.down_1 === undefined && payload.questions.move.criteria.left_1, 'Tail cell handling');
  const tailFood = { grid: 24, snake: [{x:5,y:6},{x:5,y:5},{x:6,y:5},{x:6,y:6},{x:6,y:7},{x:5,y:7}], food: {x:4,y:6}, direction: 'down', plan: true };
  answer = { answers: { move: { choice: 'eat_left1_then_down' } } };
  await exportsObject.POST(request(tailFood));
  c = payload.questions.move.criteria;
  assert.ok(c.eat_left1_then_down && c.eat_left1_then_left && c.eat_left1_then_up, 'Escapes after a grown body');
  // A route whose every escape crashes is still offered, marked as trapped.
  const trap = { grid: 24, snake: [{x:1,y:1},{x:2,y:1},{x:2,y:0}], food: {x:0,y:1}, direction: 'left', plan: true };
  answer = { answers: { move: { choice: 'eat_left1_then_up' } } };
  await exportsObject.POST(request(trap));
  c = payload.questions.move.criteria;
  assert.ok(c.eat_left1_then_up && c.eat_left1_then_down && !c.eat_left1_then_left);
  const box = { grid: 24, snake: [{x:1,y:0},{x:2,y:0},{x:2,y:1},{x:1,y:1},{x:0,y:1},{x:0,y:2}], food: {x:0,y:0}, direction: 'left', plan: true };
  answer = { answers: { move: { choice: 'eat_left1_then_trapped' } } };
  const trapped = await (await exportsObject.POST(request(box))).json();
  assert.equal(trapped.escape, null); assert.equal(payload.questions.move.criteria.eat_left1_then_trapped.afterEating.crashesNextStep, true);
  answer = { answers: { move: { choice: 'left' } } };
  assert.equal((await exportsObject.POST(request(board))).status, 502);
  answer = { answers: { move: { choice: 'up' } } };
  context.fetch = async () => { throw Error('fixture failure'); };
  assert.equal((await exportsObject.POST(request(board))).status, 504);
  // Pat's site key pays when a visitor has none; a visitor's own key wins.
  env.JEV_OPENROUTER_KEY = 'sk-or-site-fixture-key-000';
  const ready = await (await exportsObject.GET({ headers: new Headers() })).json();
  assert.equal(ready.ready, true); assert.equal(ready.provider, 'site');
  let seen;
  context.fetch = async (url, opts) => { seen = { url, auth: opts.headers.Authorization, body: JSON.parse(opts.body) };
    return Response.json({ answers: { move: { choice: 'right_1' } }, usage: { cost: 0.0003 }, id: 'gen-site' }); };
  const siteReq = (body, extra = {}) => ({ headers: new Headers({ host: 'localhost:3217', 'x-forwarded-for': '10.0.0.9', ...extra }), nextUrl: new URL('http://localhost:3217/api/jev'), text: async () => JSON.stringify(body) });
  const paid = await (await exportsObject.POST(siteReq({ ...board, plan: true }))).json();
  assert.equal(seen.url, 'https://openrouter.ai/api/alpha/decisions'); assert.equal(seen.auth, 'Bearer sk-or-site-fixture-key-000');
  assert.equal(seen.body.model, 'typesafe/jev-1.13'); assert.deepEqual(seen.body.usage, { include: true });
  assert.equal(paid.paidBy, 'site'); assert.equal(paid.provider, 'OpenRouter'); assert.equal(paid.usage.cost, 0.0003);
  await exportsObject.POST(siteReq({ ...board, plan: true }, { 'x-openrouter-key': 'sk-or-visitor-fixture-key-1' }));
  assert.equal(seen.auth, 'Bearer sk-or-visitor-fixture-key-1', 'A visitor key is used before the site key');
  context.fetch = async () => Response.json({ error: 'no credit' }, { status: 402 });
  const broke = await exportsObject.POST(siteReq({ ...board, plan: true }));
  assert.equal(broke.status, 503); assert.match((await broke.json()).error, /own OpenRouter key/);
  context.fetch = async () => Response.json({ answers: { move: { choice: 'right_1' } } });
  let limited = 0;
  for (let i = 0; i < 130; i++) if ((await exportsObject.POST(siteReq({ ...board, plan: true }, { 'x-forwarded-for': '10.0.0.77' }))).status === 429) limited++;
  assert.equal(limited, 10, 'Site-paid moves are capped at 120 a minute per visitor');
  delete env.JEV_OPENROUTER_KEY;
  console.log('PASS: missing key, invalid input, Choice payload, reverse exclusion, apple routes with escapes, wall/corner/body-blocked exits, growth vs tail, trapped route, site-paid key (priority, usage, credit-out message, per-visitor cap), invalid provider result, upstream failure. No external API calls.');
})().catch(e => { console.error(e); process.exit(1); });
