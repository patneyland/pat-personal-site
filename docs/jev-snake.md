# Jev on the original arcade

Pat's final direction (2026-09-24): **/arcade-jev looks identical to /arcade, with Jev in a floating window over it.** The separate recording-page redesign was rejected.

## Implementation

Both routes rewrite to the same public/arcade/index.html. The Jev controller exits immediately on /arcade. On /arcade-jev it adds a draggable, collapsible window with keyboard-layout arrow indicators and a scrolling command history. It does not resize the cabinet, move the leaderboard, or mount a second game. The former /arcade/jev.html redirects here.

Jev runs the original real-time Snake engine, at 130ms per cell accelerating to 60ms. There is no wait for the API and no automatic pause on slow or failed inference. A turn changes direction once; the engine keeps moving. Commands log only direction changes.

Default planned mode: Jev chooses whole trajectories (route to the apple plus the escape arrow after eating), queued on exact engine ticks. See "Multi-turn planning" at the end; it replaces the single-segment planner described in older sections.

Late or mismatched plans are discarded. Pause, restart, game over, or switching games invalidates queued plans. A slow model can miss its turn and lose. Reactive mode also runs in real time. The planned segment is visible in the window; exported JSON includes all plans and applied/late/stale/cancelled outcomes, actual turns, boards, and provider costs. Completed runs use the original classic result/save flow with the JEV name. Human input labels JEV + HUMAN. No test writes real leaderboard scores.

## OpenRouter key in the window

Save an OpenRouter key in the floating window. The field is masked, cleared after saving, and collapsed after successful verification. The key is stored only in localStorage for this browser and origin. Forget key removes it and pauses the game. The key is sent in a request header over HTTPS to this site's API and forwarded to OpenRouter; the server neither persists nor logs it. Downloads never contain it. A new Vercel preview origin requires saving the key again.

The server verifies the key with OpenRouter's read-only key endpoint. Decisions use POST https://openrouter.ai/api/alpha/decisions with typesafe/jev-1.13, confirmed against /api/v1/models?output_modalities=decisions. Every inference requests usage.include and reports actual usage.cost. The window totals reported costs; unavailable costs are labeled unknown, never estimated. Late replies after pause or game over cannot control the game, but their costs still count. Download produces the commands JSON and a .cost.json sidecar.

An existing server TYPESAFE_API_KEY remains an optional fallback when no browser key is provided. No workspace OpenRouter key is embedded in the page, persisted by tests, or deployed as a shared player credential.

One real smoke request through this site's API succeeded on 2026-09-24: Jev chose right toward food, model typesafe/jev-1.13-20260917, 174ms, actual cost $0.000018648. This verifies connectivity and the Decisions contract, not full-game performance. No public score was submitted.

## Validation

Browser checks compare /arcade and /arcade-jev cabinet geometry, verify a single original canvas, continuing game movement while responses are delayed, arrow input, stale-response cancellation, classic/JEV score payloads (mocked), and draggable/collapsible controls. See scripts/dev/test-jev-overlay.cjs. API contract tests: scripts/dev/test-jev-api.cjs. Existing cabinet-flow suite also passed.

The earlier scripts/dev/test-jev.cjs tests the rejected prototype and is retained as history, not the current acceptance suite. Its standalone assets are unused by the original arcade.

Saved locally; preview only. Production deployment still needs Pat's approval. The user can now supply an OpenRouter key directly in the floating window.

Key-window acceptance checks: node scripts/dev/test-jev-openrouter.cjs. Uses a fake key and mocked billing; tests masking, verification, persistence, reload, forgetting/rejection, late-response charges, and secret-free downloads.

## First-apple investigation (2026-09-24)

Pat reported Jev could not reach the first apple. Three real normal-speed baseline runs scored 0, 0, and 20. One kept steering right with the apple left, proving a decision-quality problem as well as delay. Explicit action facts alone still scored 0, 0, 0 at normal speed: e.g. a request sent at column 17 was acted on at column 20.

With one decision per cell, two isolated first-apple cases succeeded in 14 and 13 decisions. On the actual original arcade, a real synchronized run then reached 3 apples / score 30 in 31 decisions before being deliberately stopped. Returned cost for that run was $0.001094058. An earlier paced run got one apple before a provider timeout; one request's cost is unknown. Total reported cost across this investigation: $0.006015786, plus that unknown request. No real leaderboard score was submitted. This is evidence for the first-apple fix, not a claim of long-game mastery.

Tests: node scripts/dev/test-jev-paced.cjs verifies exact per-cell application despite delay, pause cancellation, mode locking, paced-score exclusion, and classic-mode selection. API, touch-game, cabinet-flow suites and TypeScript checks also pass. Test outputs and actual cost sidecars are in pat_agent/output/jev-build/.

## Real-time planned turns (2026-09-24)

Pat rejected the slowed, one-cell-per-response mode as an unfair test. It has been removed from the UI. A real-time run collected 3 apples / score 30 with 5 direction changes before being deliberately stopped, returned cost $0.000921732 with no unknown costs. This short run verifies live timing and basic planning, not mastery. The old paced test and investigation above are historical. Current acceptance: scripts/dev/test-jev-realtime.cjs.

## Multi-turn planning (2026-09-24, replaces the single-segment planner)

Pat: "it needs to understand the entire playing space and understand the consequences." The old planner could only pick one straight segment and stopped at the apple, so an apple on a wall left one tick to decide the escape, and the forecast dead-ended at the wall without ever sending a request. Reproduced first: right edge and all four corners died exactly one tick after eating.

**What Jev chooses now (route.ts, `plan:true`).** Each option is a whole trajectory:

- `eat_<legs>_then_<dir>`: reach the apple in 1 to 3 straight legs (straight, both L shapes, detours whose first leg is 1 to 3 cells), plus the arrow for the step right after eating. Every legal escape arrow is its own option. A route with no legal escape is still offered as `_then_trapped`.
- `<dir>_<n>`: straight repositioning without eating. These now stop before the apple.

Code enumerates and simulates only: growth, moving tail, walls, clear cells after the escape, reachable open space (body counted as walls), `roomForBody`, and `safeForNextDecision` (clear cells exceed the client's measured `decisionDelayTicks`). Nothing is ranked or filtered for safety; only options that collide before finishing are left out. The next apple is never guessed. The instructions tell Jev what those facts mean and what to prefer; Jev picks. About 40 to 110 options per request.

**Client schedule (jev-controller.js).** A chosen plan becomes keypresses on exact engine ticks, including the escape on the eating tick, all queued before the snake starts travelling. Every tick of the forecast is checked as it happens; a human key, unplanned apple, pause, restart or mismatch drops the rest of the plan and replans from the live board. When the apple is eaten, the new apple is observed immediately (via the engine's status report) and the next request goes out while the escape runs. The request board is the last certain board within the decision lead. The lead is the second-slowest of the last 12 response times × 1.2, plus one tick. Late plans are discarded. The game never waits.

**Tests (fixture policy, not Jev):** `test-jev-edges.cjs` (4 edges, 4 corners on the real engine), `test-jev-schedule.cjs` (apple spawning on the escape path and on the escape cell, 60ms clock, failed requests, human key mid-plan, pause/resume, slow-model death then restart), extended `test-jev-api.cjs` (wall, corner, body-blocked exits, growth vs tail, trapped). Shared harness `jev-fixture.cjs`.

**Real Jev trials** (`trial-jev-edges.cjs`, typesafe/jev-1.13, local dev server, supabase blocked so no scores written):

- Edges and corners, two passes: 16 of 16 eaten and escaped. The escape was chosen at tick 4 or 5, 10 to 25 ticks before eating. $0.006109 + $0.005858.
- Before the latency change: two 60s games stopped at 360 each with no deaths ($0.027000); one 300s game died at 500 ($0.018728).
- After: two 300s games died at 620 and 500 ($0.042786).
- Every death was the same thing: at the 60ms floor a response took 530 to 560ms against a lead of about 480ms, the plan was discarded as late, and the replan could not land before a wall. Missed deadlines are real losses by design.
- Total trial spend: $0.100481, no unknown costs. Outputs are in pat_agent/output/jev-build/ (`edge-trials-*`, `free-trials-1`, `long-trial*`), each with a `.cost.json`.

Open: latency tail at top speed is now the limiting factor, not planning. Options: a wider lead margin, or offering Jev a longer committed continuation after each plan so one late reply is survivable.

## Jev stays off the main arcade (2026-09-25)

Pat: "the main page should just be the normal game, with jev just on the leader board. zero other mention of it."

The attract-screen replay of Jev's best game, the `JEV` tag with its crown, and the `TRY TO BEAT JEV AND PAT` button now exist only on `/arcade-jev`. `cabinet.js` reads `jev-enabled` once into `jevPage` and builds `.ov-demo-tag` and `.ov-demo-play` only when it is set, so on `/arcade` they are absent from the DOM rather than hidden in it - the string JEV does not appear in the cabinet markup at all. `loadReplay` returns null there, so no recording is ever fetched and Snake's attract screen is the plain sign: title, rule, controls, INSERT COIN.

The one place Jev survives on `/arcade` is his leaderboard row, with the verified badge, exactly as before.

`test-jev-replay.cjs` now records on `/arcade-jev`, replays there, checks the button leaves for the real arcade, and then asserts `/arcade` serves Jev's best run from the board and still ignores it: nothing self-plays, no tag, no button, no JEV anywhere in the screen markup. Cabinet-flow, jev-overlay, arcade-share and touch-game suites still pass.
