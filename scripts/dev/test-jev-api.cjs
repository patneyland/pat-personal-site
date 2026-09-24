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
  answer = { answers: { move: { choice: 'left' } } };
  assert.equal((await exportsObject.POST(request(board))).status, 502);
  answer = { answers: { move: { choice: 'up' } } };
  context.fetch = async () => { throw Error('fixture failure'); };
  assert.equal((await exportsObject.POST(request(board))).status, 504);
  console.log('PASS: missing key, invalid input, Choice payload, reverse exclusion, invalid provider result, upstream failure. No external API calls.');
})().catch(e => { console.error(e); process.exit(1); });
