# Jev Snake recording view

Path: `/arcade/jev.html`. Standalone recording screen using the same 24×24 Snake engine as the arcade. Nothing links to it from the public arcade yet.

## What is built

- Large board and side console with keyboard-layout arrow indicators.
- Every applied Jev choice flashes its key and adds a numbered command with elapsed time.
- Start, pause/resume, restart, fullscreen, sound, and JSON download of all runs.
- Latest 1,000 commands remain visible; the download retains the full session, including board state, model, confidence, probabilities, usage, and decision latency.
- Completed-run best saved in this browser, separate from the classic public leaderboard.
- API key stays on the server. The endpoint calls TypeSafe directly using Choice and excludes only the forbidden 180-degree reverse. No pathfinding or fallback bot chooses production moves.

## Timing and recording

This is **decision-paced Snake**, not a normal-speed arcade leaderboard attempt. Each response advances one cell. There is a 220ms minimum interval so key presses read on camera. Network delays slow the board; the game does not make up moves while waiting. The page labels this timing and the downloaded log records it.

The game pauses when the tab is hidden. Pause, restart, and navigation abort the browser request and invalidate late replies. An already-running provider request may still finish server-side. API failures pause with a retry control. The API has a 15-second timeout and a per-instance 360-request/minute/IP speed limit. This rate limit is not an account-wide spending cap.

## Connect the model

Set `TYPESAFE_API_KEY` in `.env.local` for local use, and in the Vercel **Preview** environment for a hosted preview. Optional `JEV_MODEL` defaults to `jev-latest`; the response's actual model version is saved in every move. Redeploy after adding preview variables. Do not put keys in client code or Git.

No TypeSafe key was present at implementation time. **No real Jev gameplay, latency, skill, cost, or high score has been measured yet.** Browser tests use explicitly labeled fixture responses, not model results. No scores have been posted to Supabase. The recording page retains Jev's best locally only.

## Validation

- `node scripts/dev/test-jev.cjs` against a local dev server (default port 3217). Browser checks: disconnected state, commands, pause, stale replies, restart, collision, downloads, desktop/mobile geometry. Test images go to `tmp/jev-test/`.
- `node scripts/dev/test-jev-api.cjs`: input validation, server-only missing-key behavior, Choice payload, reverse exclusion, provider errors. No paid API calls.
- TypeScript `tsc --noEmit --incremental false`.

Snake now accepts an optional `{ controlled: true }` mount option and exposes `snapshot()` and `move(direction)`. Ordinary arcade mounting keeps its timed loop and touch controls. Tail-cell occupancy is preserved when moving into the vacating tail cell, and filling the board ends the run.

Remaining: add the key, play and record an actual run, decide whether its earned score should be published on a separate Jev board, then approve production deployment. Do not claim test-fixture screenshots show Jev playing.
