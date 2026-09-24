# Jev Snake: real-time planning handoff

Prepared September 24, 2026. **Implemented the same day; see "Multi-turn planning" in docs/jev-snake.md.** The text below is the original handoff.

## Start here

Work in `C:/Users/Patri/OneDrive/Documents/repos/pat-personal-site`, not the assistant workspace `pat_agent`. Read `CLAUDE.md`, `CURRENT-PLATE.md`, `design.md`, and `docs/jev-snake.md` there before editing. The existing working tree contains other active work. Preserve it.

Current protected preview:
https://pat-personal-site-9rqsfqcfv-neyland-solutions.vercel.app/arcade-jev?game=snake

The next task is to make Jev plan multiple consequential moves ahead on the full Snake board, especially an escape turn after eating an apple at a wall or corner, while the original game runs continuously at normal speed. Reproduce the edge-apple failure first. Do not spend this task redesigning the website or recreating Snake.

## Pat's requirements

Pat's latest request:

> It needs to know moves in advance because if an apple is at the edge, it needs to be able to move before it actually gets to the edge. So it needs to see the game the same way that I see the game. Not visually, but it needs to understand the entire playing space and understand the consequences.

Earlier explicit requirements:

- "It needs to be in real time or else it's not a good test."
- One arrow press changes direction. Snake then continues until the next turn. Do not represent every cell as another keypress.
- Jev may pre-plan moves and show its plan.
- Use his actual website and original game, visually identical except for the floating Jev window.
- Floating window has the four arrow keys in keyboard layout, highlights actual inputs, and has a scrolling command log. He intends to record it for YouTube.
- An OpenRouter key can be entered, saved, and forgotten in that window.
- Jev should earn its own genuine scores.

Interpretation for implementation: give the model a useful representation of the entire board and future consequences. Screenshots or visual perception are unnecessary. Merely passing all cell coordinates is not enough if the action interface only permits shortsighted choices.

Preserve an honest model test. Distinguish decisions made by Jev from observations, simulations, and execution supplied by code. Do not secretly replace Jev with a deterministic winning Snake bot and present that as model skill. Any assistance beyond the current candidate generation should be documented clearly.

## Current implementation

| File | Responsibility |
| --- | --- |
| `next.config.ts` | `/arcade` and `/arcade-jev` both rewrite to the original `/arcade/index.html`. |
| `public/arcade/index.html` | Loads the Jev controller before cabinet initialization. |
| `public/arcade/jev-controller.js` | Exits on every route except `/arcade-jev`; wraps the existing Snake mount, adds the floating window, manages requests, forecasts, queued turns, logs, keys and costs. |
| `public/arcade/jev-controller.css` | Scoped styling for the floating draggable/collapsible window. |
| `public/arcade/snake.js` | The actual game. Snapshot includes grid, ordered body, food, direction, score, state, tick and tickMs. `api.beforeStep` allows exact-tick turn delivery. |
| `src/app/api/jev/route.ts` | Key verification, state validation, perception facts, candidate segments, Jev request, usage reporting. |
| `public/arcade/cabinet.js` | Original game/results/leaderboard flow; model runs use JEV, mixed runs JEV + HUMAN. |
| `docs/jev-snake.md` | Existing implementation history; older paced-mode sections are historical, not the desired behavior. |

Snake is 24 by 24. Coordinates run from 0 through 23, x right, y down. Body is head first. It starts facing right with head `(8,12)`, body `(7,12),(6,12)`. It moves every 130ms, accelerating by 3.5ms per apple to a 60ms floor. Each apple scores 10 and grows the body by one. Moving into the departing tail cell is legal only when not eating. Reversal is illegal. The original direction queue compares against the last queued direction.

The current UI has two modes, both real time: planned turns (default) and reactive. The earlier one-response-per-cell slowed mode was rejected and removed from the UI. The game does not pause for model requests or errors. Explicit user pause and existing background behavior remain.

### Current planned-turn flow

1. `planNext` predicts a future board by continuing the current direction for a latency allowance: initially 400ms, at least two ticks; updated to 1.3 times the previous full request duration, clamped to 250–1500ms.
2. It sends that predicted board with `plan:true` to `/api/jev`.
3. The server enumerates nonreversing, immediately legal straight segments, up to 23 cells each. It simulates the moving tail, stops before a collision, and stops a segment at the first apple.
4. Each option has direction, distance, endpoint, apple eaten, Manhattan-distance progress, and alignment facts. Jev selects a single segment such as `up_7`.
5. The client queues that turn for the predicted board's exact tick. `sameBoard` requires tick, direction, full body and food to match. Late or mismatched results are discarded.
6. At the scheduled tick, it sends a normal key event only if the direction changes. The original engine continues automatically.
7. For a segment that does not eat, it predicts the endpoint and requests the following segment while the current segment runs.
8. For a segment that eats, it waits for consumption before attempting a fresh forecast/request. **This is the central failure to replace.**

## Why edge apples fail

This diagnosis follows directly from the code. A dedicated deterministic regression test for it has not yet been added.

- Client `forecast()` returns null as soon as a simulated move eats food, hits a wall, or hits the body. It cannot represent the known post-eating body state with an unknown next food location.
- Server candidate generation also stops at eating. Jev cannot currently return "travel to the apple, then turn up immediately afterward" in one plan.
- `continuePlanning()` waits until the eating segment finishes before asking for another plan. That leaves only one game tick before death when the apple is on the wall and the heading points out of bounds.
- Worse, the next `planNext()` tries to forecast straight ahead for its latency allowance. At a wall this returns null; the code retries every 40ms **without sending a model request**, while Snake continues into the wall. This is a controller dead end, not just a weak model choice.
- Unknown next food does not imply unknown movement consequences. Wall coordinates, the grown body, heading, and legal escape directions are known before eating. The planner should exploit those known facts without inventing the next food location.
- `sameBoard()` currently requires the food to match exactly. A preapproved survival continuation across consumption will need a deliberate validity contract that can tolerate new food while still validating the body, heading, tick and any other facts the action depends on.
- The prompt favors eating or maximizing Manhattan progress. It does not evaluate whether a segment leaves a viable exit, traps the body, or disconnects accessible space.
- Startup also assumes straight travel during the first latency window. Account for the initial action deadline honestly; do not silently freeze the clock to hide it.

Concrete reproduction: heading right on row 12, an apple at `(23,12)`, enough free room above or below. Before reaching the apple, Jev should already have selected an escape turn for the step immediately after eating. The snake must enter `(23,12)` to eat, then turn for the next step rather than attempting `(24,12)`. For a corner apple, there may be only one viable exit after accounting for heading/body. Test all four edges and corners.

## Recommended direction, not a mandated design

Replace the single-segment-only horizon with a model-selected sequence or contingent plan that spans acquisition and escape. Jev is a classifier; verify its supported API schema before assuming it can generate arbitrary text, an unbounded program, or a free-form route.

Possible approaches include classifying bounded candidate multi-turn trajectories, or selecting dependent decisions for explicitly described future states. Regardless of approach:

- Provide the full board, body order, heading, pending inputs, timing/deadlines and simulated consequences that matter for each choice.
- Simulate growth and tail movement accurately through eating. Represent future food as unknown, not a fabricated location.
- Request the exit decision while there is still enough time to receive it. Queue dependent actions by engine tick, not imprecise browser timeouts.
- Preserve a short, model-selected survival continuation while observing and planning toward the newly spawned food.
- Validate action assumptions at execution and invalidate only the affected continuation when an assumption changes.
- Bound candidate counts and request costs. Distinguish model choice from any code-based filtering, scoring, search or fallback.
- Show the upcoming sequence in the existing window and log scheduled versus actual turns, including discarded plans and reasons.
- Never slow the game, clamp the snake at the wall, teleport it, or automatically pause to cover for late inference. Missed deadlines remain real failures.

Do not assume a prompt rewrite alone fixes this. The action representation and scheduling currently cannot express the needed post-apple continuation.

## API, credentials and spend

- OpenRouter endpoint: `https://openrouter.ai/api/alpha/decisions`.
- Current pinned model: `typesafe/jev-1.13`. Previously confirmed through `/api/v1/models?output_modalities=decisions`; verify availability if changing it.
- Payload uses `state`, `questions.move` with `type:'choice'`, `instructions`, and `criteria`. Read `result.answers.move.choice`.
- Every OpenRouter inference must include `usage: {include:true}`. Record actual `usage.cost`, generation ID and unknown costs. Do not estimate spend from token counts.
- The floating window tracks session spend and exports command/plan JSON plus a `.cost.json` sidecar. Discarded or late requests still cost money and are counted.
- User key is masked, stored in localStorage under `arcade-jev-openrouter-key`, sent to the same-origin API in `x-openrouter-key`, and forwarded in Authorization. Never print, export, commit, screenshot, or hardcode it.
- Each immutable preview has a new origin, so the user currently needs to save the key again.
- Optional server fallback: `TYPESAFE_API_KEY`; model env `JEV_MODEL`; endpoint `https://api.typesafe.ai/v1/systemone`.
- For bounded developer tests, the assistant workspace root `.env` has `OPENROUTER_API_KEY`. Read it privately at runtime only. Do not copy it into site assets or deploy it as a public shared credential.
- Current limits: 360 requests/minute/IP in memory, server upstream timeout 15s, browser timeout 20s. Review how batching changes pressure and cost.

## Verification so far, and its limits

One live real-time run collected three apples / score 30 with five turns before being deliberately stopped. Returned spend: **$0.000921732**, no unknown costs. This demonstrates a short successful run, not robust planning, edge safety, or a completed high score. No real leaderboard score was submitted.

The artifact currently at `C:/Users/Patri/OneDrive/Documents/repos/pat_agent/output/jev-build/synchronized-repeat.json` and its `.cost.json` sidecar contains this latest real-time run despite the historical filename. The same filename was reused; it is not a reliable copy of the earlier paced trial.

Existing checks:

```powershell
node scripts/dev/test-jev-api.cjs
node scripts/dev/test-jev-realtime.cjs
node scripts/dev/test-jev-overlay.cjs
node scripts/dev/test-jev-openrouter.cjs
node scripts/dev/test-touch-games.mjs
npx.cmd tsc --noEmit --incremental false
```

- API tests cover authentication/config validation, choice contracts, reverse exclusion, segment facts, stopping at food, and upstream failures.
- Real-time browser tests cover original clock speed, one input per turn, future-board scheduling, pause invalidation, death during slow inference, and late-plan discard.
- Overlay tests compare original cabinet geometry, check one original canvas, continued motion, mocked classic/JEV score submission, drag and collapse.
- Key tests cover masked storage, reload/forget/rejection, late-response cost accounting and secret-free exports.
- These tests use fixtures and do **not** establish that Jev can solve wall/corner apples. `test-jev-paced.cjs` and the older standalone `test-jev.cjs` are historical and are not current acceptance criteria.
- Browser tests assume `http://127.0.0.1:3217`. A Next dev server was running there; verify before reuse. If needed start `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3217`.
- Latest Vercel preview build, type checks and lint passed. A prior build caught `prefer-const`; that was corrected.

Required new coverage: wall and corner apples; body-blocked exits; growth versus departing-tail occupancy; next food spawning on a planned continuation; accelerated speed; delayed, reordered, failed and stale responses; manual intervention; pause/resume and restart during queued multi-turn plans. Test the actual engine, then run bounded real Jev trials with recorded cost. Do not silently substitute a fixture policy for model results in screenshots or claims.

## Other issues noticed during handoff review

These are secondary to planning and have not been changed in this handoff:

- Local high-score read uses `jev-snake-realtime-best-v1`, but the game-over write still uses `jev-snake-decision-best-v1`. Unify the intended real-time key without mixing in rejected slowed-run scores.
- Timing-label change handler still checks the removed `pace === 'jev'` branch. It currently shows generic original-speed wording when switching modes.
- Planned mode updates the response/model widgets through actual turn logging, so repeated-direction plans can leave those widgets stale.
- API timeout error says "Resume to retry" even though real-time mode continues and retries automatically.
- The current plan log contains a predicted board but does not separately record the full observed board at request send. Better traceability will help distinguish observation, forecast, deadline and execution errors.

## Repository and delivery safeguards

Local Jev commits:

- `5ce8b69` initial prototype and engine/API hooks.
- `324476c` original-site overlay, OpenRouter key support and real-time planner.
- `bebcca5` loader for the overlay on the original arcade page.

These were committed locally, not pushed. The protected preview deploys the entire working tree, so it also contains uncommitted work. A clean checkout of the last commit is not necessarily identical to the current preview.

The working tree has unrelated mobile arcade changes in Snake, cabinet, index, other games, net and CSS; plus Gary chat, pull-up dashboard, docs, tests and temporary artifacts. Do not reset, overwrite, delete, stage all, or commit all. Shared files had Jev-only portions staged separately. Inspect the current diff again before editing or committing.

Website instructions require browser verification and then `npm.cmd run preview` (protected Vercel preview). Do not use `--prod`, push GitHub, disable preview protection, or submit real scores without the required user authorization. Keep the underlying page identical. The old `/arcade/jev.html` redirects here; its standalone assets are obsolete.

When done, deliver the tested preview and concrete evidence that Jev chooses the acquisition-and-escape sequence before the edge deadline while the game clock runs normally. Report any remaining limits honestly.
