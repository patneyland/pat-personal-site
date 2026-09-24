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
export async function GET() {
  return reply({ ready: !!process.env.TYPESAFE_API_KEY });
}
export async function POST(req: NextRequest) {
  const key = process.env.TYPESAFE_API_KEY;
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
  const criteria = Object.fromEntries(directions.filter(d => d !== opposite[direction]).map(d => [d, `Move one cell ${d}.`]));
  const state = JSON.stringify({ grid: 24, coordinates: 'x increases right; y increases down. Both range 0..23.',
    snake: body.snake, bodyOrder: 'head first, tail last', food: body.food, direction });
  const started = performance.now();
  try {
    const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ model: process.env.JEV_MODEL || 'jev-latest', state, questions: {
        move: { type: 'choice', instructions: 'Choose the next Snake move to survive and eat food. Avoid walls and your body, and avoid trapping yourself. The tail vacates its cell this move unless you eat food. Choose one direction.', criteria }
      } })
    });
    if (!upstream.ok) return reply({ error: `Jev request failed (${upstream.status}).` }, 502);
    const result = await upstream.json();
    const answer = result.answers?.move;
    if (!answer || !Object.hasOwn(criteria, answer.choice)) return reply({ error: 'Jev returned an invalid move.' }, 502);
    return reply({ direction: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities,
      model: result.model, latencyMs: Math.round(performance.now() - started), usage: result.usage });
  } catch { return reply({ error: 'Jev did not respond. Resume to retry.' }, 504); }
}
