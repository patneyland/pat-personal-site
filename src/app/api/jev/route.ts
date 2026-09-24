import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
const directions = ['up', 'down', 'left', 'right'] as const;
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
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
  // Jev selects both the direction and distance. Enumerate straight segments,
  // not a chosen route; simulate tail movement and stop at unknown next food.
  const plans: Record<string, { direction: string; steps: number }> = {};
  if (body.plan === true) {
    const options: Record<string, unknown> = {};
    for (const d of directions.filter(d => d !== opposite[direction])) {
      const cells = body.snake.map((p: Point) => ({ ...p })) as Point[];
      const [dx, dy] = vectors[d];
      for (let n = 1; n < 24; n++) {
        const end = { x: cells[0].x + dx, y: cells[0].y + dy };
        const eats = end.x === food.x && end.y === food.y;
        if (!point(end) || cells.slice(0, eats ? undefined : -1).some(p => p.x === end.x && p.y === end.y)) break;
        cells.unshift(end); if (!eats) cells.pop();
        const id = d + '_' + n;
        plans[id] = { direction: d, steps: n };
        options[id] = { press: d, travelCells: n, end,
          eatsApple: eats, distanceToApple: distance(end),
          progressTowardApple: distance(head) - distance(end),
          alignedForNextTurn: d === 'left' || d === 'right' ? end.x === food.x : end.y === food.y };
        if (eats) break;
      }
    }
    // A trapped snake still has to play. Do not freeze it or invent a rescue.
    if (Object.keys(options).length) criteria = options;
  }
  const state = JSON.stringify({ grid: 24, coordinates: 'x increases right; y increases down. Both range 0..23.',
    snake: body.snake, bodyOrder: 'head first, tail last', food, direction,
    appleIs: appleDirections.join(' and ') || 'at head', appleBehind: appleDirections.length === 1 && appleDirections[0] === opposite[direction],
    appleAlignedWithHeadRow: head.y === food.y, appleAlignedWithHeadColumn: head.x === food.x,
    actionFacts: observations });
  const started = performance.now();
  try {
    const upstream = await fetch(openrouterKey ? 'https://openrouter.ai/api/alpha/decisions' : 'https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ model: openrouterKey ? 'typesafe/jev-1.13' : process.env.JEV_MODEL || 'jev-latest', ...(openrouterKey ? { usage: { include: true } } : {}), state, questions: {
        move: { type: 'choice', instructions: (body.plan === true && Object.keys(plans).length ? 'Choose a straight travel segment, including its distance, toward eating the apple. The real-time game keeps moving. Prefer a segment that eats the apple. Otherwise maximize progressTowardApple and finish alignedForNextTurn so your following segment can eat it. Do not pass the apple alignment. If the apple is behind, choose a one-cell perpendicular turn so the next turn can head toward it. You control the turn and how many cells to travel before your next planned turn. ' : '') + 'Choose the next arrow key to eat the apple and survive. Use the supplied actionFacts instead of doing coordinate arithmetic. Never choose a collision when a non-colliding choice exists. Prefer EATS THE APPLE, then CLOSER TO APPLE. If the apple is behind and reversing is forbidden, turn perpendicular now so you can turn toward it next; do not keep moving away. Leave room to turn before a wall or body. The game keeps moving during network delay, so avoid continuing toward an obstacle with very few clear cells. Return one direction.', criteria }
      } })
    });
    const result = await upstream.json().catch(() => ({}));
    // Record actual returned cost, including responses whose move is rejected or arrives late.
    if (openrouterKey) console.info('Jev OpenRouter usage', JSON.stringify({ id: result.id || null, cost: result.usage?.cost ?? null, usage: result.usage || null, status: upstream.status }));
    if (!upstream.ok) return reply({ error: upstream.status === 401 ? 'OpenRouter rejected this key. Save a new key.' : upstream.status === 402 ? 'OpenRouter credits are exhausted.' : `Jev request failed (${upstream.status}).`, usage: result.usage, generationId: result.id }, upstream.status === 401 || upstream.status === 402 ? upstream.status : 502);
    const answer = result.answers?.move;
    if (!answer || !Object.hasOwn(criteria, answer.choice)) return reply({ error: 'Jev returned an invalid move.', usage: result.usage, generationId: result.id }, 502);
    return reply({ direction: plans[answer.choice]?.direction || answer.choice, steps: plans[answer.choice]?.steps || 1, confidence: answer.confidence, probabilities: answer.probabilities,
      model: result.model, generationId: result.id, provider: openrouterKey ? 'OpenRouter' : 'TypeSafe', latencyMs: Math.round(performance.now() - started), usage: result.usage });
  } catch { return reply({ error: 'Jev did not respond. Resume to retry.' }, 504); }
}
