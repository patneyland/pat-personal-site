import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
const directions = ['up', 'down', 'left', 'right'] as const;
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
type Point = { x: number; y: number };
const hits = new Map<string, { start: number; count: number }>();
function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
function point(p: unknown): p is Point {
  if (!p || typeof p !== 'object') return false;
  const { x, y } = p as Point;
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < 24 && y < 24;
}
type Dir = typeof directions[number];
type Plan = { turns: { direction: Dir; steps: number }[]; eats: boolean; escape: Dir | null };
const vec: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// One engine step: tail leaves unless eating; walls and body end the move.
function advance(snake: Point[], food: Point | null, d: Dir) {
  const next = { x: snake[0].x + vec[d][0], y: snake[0].y + vec[d][1] };
  if (!point(next)) return null;
  const eats = !!food && next.x === food.x && next.y === food.y;
  if ((eats ? snake : snake.slice(0, -1)).some(p => p.x === next.x && p.y === next.y)) return null;
  const moved = [next, ...snake];
  if (!eats) moved.pop();
  return { snake: moved, eats };
}
// Cells the snake can keep travelling straight before it would crash. Unknown
// future food is treated as absent.
function clearAhead(snake: Point[], food: Point | null, d: Dir) {
  let cells = snake, n = 0;
  while (n < 23) { const moved = advance(cells, food, d); if (!moved || moved.eats) break; cells = moved.snake; n++; }
  return n;
}
// Free cells connected to the head, counting the current body as walls.
function reachable(snake: Point[]) {
  const blocked = new Set(snake.map(p => p.x + ',' + p.y)), seen = new Set<string>();
  const queue = [snake[0]];
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of Object.values(vec)) {
      const q = { x: p.x + dx, y: p.y + dy }, k = q.x + ',' + q.y;
      if (point(q) && !blocked.has(k) && !seen.has(k)) { seen.add(k); queue.push(q); }
    }
  }
  return seen.size;
}
// Bounded route shapes to the apple: straight, both L shapes, and three-leg
// detours whose first leg is 1-3 cells. Enumeration only; no route is ranked.
function appleRoutes(head: Point, heading: Dir, food: Point) {
  const dx = food.x - head.x, dy = food.y - head.y;
  const h: Dir = dx > 0 ? 'right' : 'left', v: Dir = dy > 0 ? 'down' : 'up';
  const routes: [Dir, number][][] = [];
  if (!dy && dx) routes.push([[h, Math.abs(dx)]]);
  if (!dx && dy) routes.push([[v, Math.abs(dy)]]);
  if (dx && dy) routes.push([[h, Math.abs(dx)], [v, Math.abs(dy)]], [[v, Math.abs(dy)], [h, Math.abs(dx)]]);
  for (const first of directions) {
    for (let n = 1; n <= 3; n++) {
      const [fx, fy] = vec[first], x = head.x + fx * n, y = head.y + fy * n;
      if (fx) { if (dy && food.x !== x) routes.push([[first, n], [v, Math.abs(dy)], [food.x > x ? 'right' : 'left', Math.abs(food.x - x)]]); }
      else if (dx && food.y !== y) routes.push([[first, n], [h, Math.abs(dx)], [food.y > y ? 'down' : 'up', Math.abs(food.y - y)]]);
    }
  }
  return routes.filter(r => r[0][0] !== opposite[heading] && r.every(([, n]) => n > 0));
}
export async function GET(req: NextRequest) {
  const key = req.headers.get('x-openrouter-key');
  if (!key) return reply({ ready: !!process.env.TYPESAFE_API_KEY });
  if (!/^sk-or-[A-Za-z0-9_-]{10,250}$/.test(key)) return reply({ error: 'Enter a valid OpenRouter key.' }, 400);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return reply({ error: response.status === 401 ? 'OpenRouter rejected this key.' : 'Could not verify the OpenRouter key.' }, response.status === 401 ? 401 : 502);
    return reply({ ready: true, provider: 'OpenRouter' });
  } catch { return reply({ error: 'Could not reach OpenRouter. Try again.' }, 504); }
}
export async function POST(req: NextRequest) {
  const openrouterKey = req.headers.get('x-openrouter-key');
  if (openrouterKey && !/^sk-or-[A-Za-z0-9_-]{10,250}$/.test(openrouterKey)) return reply({ error: 'Enter a valid OpenRouter key.' }, 400);
  const key = openrouterKey || process.env.TYPESAFE_API_KEY;
  if (!key) return reply({ error: 'Jev API key is not configured.' }, 503);
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      if (origin !== req.nextUrl.origin && new URL(origin).host !== req.headers.get('host')) {
        return reply({ error: 'Origin not allowed.' }, 403);
      }
    } catch { return reply({ error: 'Origin not allowed.' }, 403); }
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = Date.now();
  for (const [id, hit] of hits) if (now - hit.start > 60_000) hits.delete(id);
  if (!hits.has(ip) && hits.size >= 1000) return reply({ error: 'Please try again shortly.' }, 429);
  const hit = hits.get(ip) || { start: now, count: 0 };
  hits.set(ip, hit);
  if (++hit.count > 360) return reply({ error: 'Move limit reached. Pause for a minute.' }, 429);
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return reply({ error: 'Board too large.' }, 413);
    body = JSON.parse(raw);
  } catch { return reply({ error: 'Invalid board.' }, 400); }
  if (!body || body.grid !== 24 || !Array.isArray(body.snake) || body.snake.length < 3 || body.snake.length > 576 ||
    !body.snake.every(point) || !point(body.food) || !directions.includes(body.direction) ||
    new Set(body.snake.map((p: Point) => `${p.x},${p.y}`)).size !== body.snake.length) {
    return reply({ error: 'Invalid board.' }, 400);
  }
  const direction = body.direction as typeof directions[number];
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const head = body.snake[0] as Point;
  const food = body.food as Point;
  const distance = (p: Point) => Math.abs(p.x - food.x) + Math.abs(p.y - food.y);
  const appleDirections = [food.x < head.x ? 'left' : food.x > head.x ? 'right' : null,
    food.y < head.y ? 'up' : food.y > head.y ? 'down' : null].filter(Boolean);
  // Perception only: compute board facts, never choose the move or plan a route.
  const observations = Object.fromEntries(directions.map(d => {
    const [dx, dy] = vectors[d];
    const next = { x: head.x + dx, y: head.y + dy };
    const eating = next.x === food.x && next.y === food.y;
    const bodyCells = body.snake.slice(0, eating ? undefined : -1) as Point[];
    const collision = next.x < 0 || next.y < 0 || next.x >= 24 || next.y >= 24 ? 'wall' :
      bodyCells.some(p => p.x === next.x && p.y === next.y) ? 'body' : null;
    let clearCells = 0;
    for (let n = 1; n < 24; n++) {
      const x = head.x + dx * n, y = head.y + dy * n;
      if (x < 0 || y < 0 || x >= 24 || y >= 24 || bodyCells.some(p => p.x === x && p.y === y)) break;
      clearCells++;
    }
    return [d, { reverse: d === opposite[direction], collision,
      foodEffect: eating ? 'EATS THE APPLE' : distance(next) < distance(head) ? 'CLOSER TO APPLE' : 'FARTHER FROM APPLE',
      clearCellsAhead: clearCells }];
  }));
  let criteria: Record<string, unknown> = Object.fromEntries(directions.filter(d => d !== opposite[direction]).map(d =>
    [d, { action: 'Press ' + d + ' now', ...observations[d] }]));
  // Planned mode: Jev chooses a whole trajectory. Code only enumerates bounded
  // candidates and simulates their consequences (growth, moving tail, walls,
  // space left). It never ranks, filters for safety, or picks a route; the
  // only candidates left out are ones that collide before they finish.
  const plans: Record<string, Plan> = {};
  const delayTicks = Number.isInteger(body.decisionDelayTicks) ? Math.max(1, Math.min(40, body.decisionDelayTicks)) : 3;
  if (body.plan === true) {
    const options: Record<string, unknown> = {};
    const snake = body.snake as Point[];
    // Straight repositioning segments that stop before the apple.
    for (const d of directions.filter(d => d !== opposite[direction])) {
      let cells = snake;
      for (let n = 1; n < 24; n++) {
        const moved = advance(cells, food, d);
        if (!moved || moved.eats) break;
        cells = moved.snake;
        const end = cells[0], clearAfter = clearAhead(cells, food, d);
        plans[d + '_' + n] = { turns: [{ direction: d, steps: n }], eats: false, escape: null };
        options[d + '_' + n] = { plan: 'press ' + d + ', travel ' + n + ' cells, no apple', eatsApple: false, travelCells: n, end,
          distanceToApple: distance(end), progressTowardApple: distance(head) - distance(end),
          alignedForNextTurn: d === 'left' || d === 'right' ? end.x === food.x : end.y === food.y,
          clearCellsAfterEnd: clearAfter, reachableCellsAtEnd: reachable(cells),
          safeForNextDecision: n + clearAfter > delayTicks };
      }
    }
    // Routes that reach the apple with up to three straight legs, each paired
    // with every legal arrow for the step right after eating.
    for (const legs of appleRoutes(head, direction, food)) {
      let cells = snake, ok = true;
      legs.forEach(([d, n], leg) => {
        for (let i = 1; ok && i <= n; i++) {
          const moved = advance(cells, food, d);
          if (!moved || moved.eats !== (leg === legs.length - 1 && i === n)) ok = false;
          else cells = moved.snake;
        }
      });
      if (!ok) continue;
      const arrive = legs[legs.length - 1][0];
      const name = 'eat_' + legs.map(([d, n]) => d + n).join('_');
      const route = { plan: legs.map(([d, n]) => 'press ' + d + ', travel ' + n).join('; ') + '; eat the apple',
        ticksToApple: legs.reduce((sum, [, n]) => sum + n, 0), turnsBeforeApple: legs.length, headingWhenEating: arrive };
      const turns = legs.map(([d, n]) => ({ direction: d, steps: n }));
      let escapes = 0;
      for (const e of directions.filter(e => e !== opposite[arrive])) {
        const moved = advance(cells, null, e);
        if (!moved) continue;
        escapes++;
        const clear = 1 + clearAhead(moved.snake, null, e), room = reachable(moved.snake);
        plans[name + '_then_' + e] = { turns, eats: true, escape: e };
        options[name + '_then_' + e] = { ...route, eatsApple: true, afterEating: {
          press: e === arrive ? 'nothing, keep heading ' + e : e, clearCellsAhead: clear, reachableCells: room,
          bodyLength: cells.length, roomForBody: room >= cells.length, safeForNextDecision: clear > delayTicks } };
      }
      if (!escapes) {
        plans[name + '_then_trapped'] = { turns, eats: true, escape: null };
        options[name + '_then_trapped'] = { ...route, eatsApple: true, afterEating: { press: null, crashesNextStep: true } };
      }
    }
    // A trapped snake still has to play. Do not freeze it or invent a rescue.
    if (Object.keys(options).length) criteria = options;
  }
  const state = JSON.stringify({ grid: 24, coordinates: 'x increases right; y increases down. Both range 0..23.',
    snake: body.snake, bodyOrder: 'head first, tail last', food, direction,
    appleIs: appleDirections.join(' and ') || 'at head', appleBehind: appleDirections.length === 1 && appleDirections[0] === opposite[direction],
    appleAlignedWithHeadRow: head.y === food.y, appleAlignedWithHeadColumn: head.x === food.x,
    actionFacts: observations,
    ...(body.plan === true ? { decisionDelayTicks: delayTicks, timing: 'The game moves one cell per tick and never waits. Your next decision arrives about decisionDelayTicks moves after it is requested. The next apple appears somewhere random only after this one is eaten.' } : {}) });
  const planned = body.plan === true && Object.keys(plans).length > 0;
  const instructions = planned
    ? 'Choose a whole plan, not just the next key. Options starting eat_ travel to the apple along the listed legs and also fix the arrow pressed on the step right after eating (then_<direction>), because an apple at a wall or corner leaves no time to decide after eating. The snake is one cell longer after eating. Other options travel straight without eating, to reposition. ' +
      'Judge each option by its consequences: afterEating.safeForNextDecision means the snake can keep moving until your next decision arrives; roomForBody means the space it can reach still fits its body; reachableCells is how much open space stays connected. Choosing an escape that is not safeForNextDecision, or has little reachable space, usually loses the game. ' +
      'Prefer an eat_ option whose escape is safeForNextDecision and roomForBody, with many reachableCells and few ticksToApple. If no eat_ option is safe, choose a straight option that is safeForNextDecision with many reachableCellsAtEnd.'
    : 'Choose the next arrow key to eat the apple and survive. Use the supplied actionFacts instead of doing coordinate arithmetic. Never choose a collision when a non-colliding choice exists. Prefer EATS THE APPLE, then CLOSER TO APPLE. If the apple is behind and reversing is forbidden, turn perpendicular now so you can turn toward it next; do not keep moving away. Leave room to turn before a wall or body. The game keeps moving during network delay, so avoid continuing toward an obstacle with very few clear cells. Return one direction.';
  const started = performance.now();
  try {
    const upstream = await fetch(openrouterKey ? 'https://openrouter.ai/api/alpha/decisions' : 'https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ model: openrouterKey ? 'typesafe/jev-1.13' : process.env.JEV_MODEL || 'jev-latest', ...(openrouterKey ? { usage: { include: true } } : {}), state, questions: {
        move: { type: 'choice', instructions, criteria }
      } })
    });
    const result = await upstream.json().catch(() => ({}));
    // Record actual returned cost, including responses whose move is rejected or arrives late.
    if (openrouterKey) console.info('Jev OpenRouter usage', JSON.stringify({ id: result.id || null, cost: result.usage?.cost ?? null, usage: result.usage || null, status: upstream.status }));
    if (!upstream.ok) return reply({ error: upstream.status === 401 ? 'OpenRouter rejected this key. Save a new key.' : upstream.status === 402 ? 'OpenRouter credits are exhausted.' : `Jev request failed (${upstream.status}).`, usage: result.usage, generationId: result.id }, upstream.status === 401 || upstream.status === 402 ? upstream.status : 502);
    const answer = result.answers?.move;
    if (!answer || !Object.hasOwn(criteria, answer.choice)) return reply({ error: 'Jev returned an invalid move.', usage: result.usage, generationId: result.id }, 502);
    const plan = plans[answer.choice];
    return reply({ choice: answer.choice, direction: plan ? plan.turns[0].direction : answer.choice, steps: plan ? plan.turns[0].steps : 1,
      turns: plan ? plan.turns : [{ direction: answer.choice, steps: 1 }], eats: plan ? plan.eats : false, escape: plan ? plan.escape : null,
      candidates: Object.keys(criteria).length, confidence: answer.confidence, probabilities: answer.probabilities,
      model: result.model, generationId: result.id, provider: openrouterKey ? 'OpenRouter' : 'TypeSafe', latencyMs: Math.round(performance.now() - started), usage: result.usage });
  } catch { return reply({ error: 'Jev did not respond. Retrying while the game keeps moving.' }, 504); }
}
