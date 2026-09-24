# Jev on the original arcade

Pat's final direction (2026-09-24): **/arcade-jev looks identical to /arcade, with Jev in a floating window over it.** The separate recording-page redesign was rejected.

## Implementation

Both routes rewrite to the same public/arcade/index.html. The Jev controller exits immediately on /arcade. On /arcade-jev it adds a draggable, collapsible window with keyboard-layout arrow indicators and a scrolling command history. It does not resize the cabinet, move the leaderboard, or mount a second game. The former /arcade/jev.html redirects here.

Jev runs the original real-time Snake engine, at 130ms per cell accelerating to 60ms. There is no wait for the API and no automatic pause on slow or failed inference. A turn changes direction once; the engine keeps moving. Commands log only direction changes.

Default planned mode forecasts the board at an upcoming tick. Jev classifies all legal straight segments (direction plus distance) for that board, and its selected turn is queued for that exact tick. A request for the next segment runs while the current segment plays. Forecasts simulate the original body/tail movement, but never invent future random food. After eating, planning uses a fresh observation. The code enumerates choices; Jev selects direction and distance. It does not secretly choose a route, prevent an actual crash, or slow the clock.

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
