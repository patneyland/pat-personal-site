# Arcade mobile challenge

Requested 2026-09-24. Scope: the existing standalone arcade, with shared scores
and game rules preserved. Production publication requires Pat's approval.

## Production release (2026-09-24)

Pat approved publication. Live: https://www.patrickneyland.com/arcade
Deployment: `dpl_DJ2wMFwfy41S6npqjWnA6KfRFZyM`.
URL: https://pat-personal-site-aglk9dm25-neyland-solutions.vercel.app

Production build, lint and type checks passed. The three active game/flow suites
passed against the release copy. Live browser verification confirmed automatic
mobile layout, the joystick, actual high scores, and the expanded game menu.
No scores were submitted. The release excludes unfinished Jev work and retains
the recovery fixes already live. Earlier preview-only notes below are historical.

## Asteroids revision: joystick and one game mode (2026-09-24)

Pat requested a small circular thumb joystick instead of directional buttons.
It combines turning and thrust, returns to center on release, and clears held
input on cancellation or pause. Fire and Hyperspace remain separate targets.
Practice mode is removed. Every run uses the normal lives and scoring rules;
players can retry without saving, or choose Save Score and submit their name.
Result sharing controls are removed at Pat's request. Social link metadata remains.

Validated: joystick and game-input checks, optional score submission/retry checks,
and portrait/landscape browser review. Result sharing and practice controls are
absent. Physical simultaneous thumbs still need a real-device check.

This supersedes the practice-mode references in the original plan and its
historical validation below. Local preview only; publication is unchanged.

## Mobile revision: minimal game surface (2026-09-24)

Pat replaced the cabinet-style mobile brief with an app-like game surface.
The phone layout now removes the TV frame, scanlines, CRT effects, header,
coin gate and fixed challenge controls. A single 44px scoreboard icon opens
an expanded score panel containing the game choices, high scores and settings.
The duplicate "Pat's best" label is removed throughout the game UI; the owner
record appears on the scoreboard. Results still acknowledge beating or tying Pat.
Mobile credit is automatic and does not grant desktop coin credit.

The play area uses the viewport below a compact score/status strip, with safe
area insets. Snake uses the available width while preserving its 24x24 grid;
Minesweeper remains square with Reveal/Flag; Asteroids fills the play surface.
The scoreboard pauses action games and closing it explicitly resumes them.
Ranked Minesweeper time continues, with a notice in the panel. Backgrounding
still requires an explicit return to play. Desktop retains its cabinet.

All four logic suites pass after this revision. Direct browser review checked
390x844 and 375x500, immediate game entry, expanded scores, game switching,
and Asteroids practice. The updated portable phone audit is syntax-checked
only. Physical-device checks remain below; this revision is not deployed.

## Implementation (original plan)

- Live owner benchmark on entry and in play; named game choices and links using
  `?game=snake`, `?game=minesweeper`, and `?game=asteroids`.
- Snake turns during the swipe rather than waiting for release. Optional arrow
  buttons retain the same direction queue, grid, speed and scoring.
- Minesweeper Reveal/Flag modes and a secondary question mode. Press highlighting,
  cancellation on leaving the original cell, long-press flags, and a legible board.
- Asteroids combines turning and thrust under the left thumb; Fire and Hyperspace
  are separate right-thumb actions. No auto-fire or changes to simulation constants.
- Pause and mute remain reachable. Action games pause on loss of focus and need
  an explicit resume. Minesweeper hides its board while paused, but ranked elapsed
  time continues, including time spent outside the app.
- Asteroids practice ends at 30 seconds of active play or the first life lost.
  Practice results cannot enter the submission flow.
- Results compare against the owner benchmark captured at the start of that run.
  Retry is primary; saving is optional and only opens the keyboard on request.
  Unsaved results survive retries in session storage where available.
- Result sharing prepares a PNG before native sharing is invoked. Link copying,
  manual-copy fallback and image download remain available. Share cancellation is
  respected. Links always use the public arcade URL and exclude owner credentials.
- A static 1200 x 630 PNG supplies the social preview. It contains no hardcoded
  scores that would become stale. The same preview applies to all three game links.

## Validation

Logic checks run without a browser against the actual game event handlers and
animation loops with controlled clocks:

```
node scripts/dev/test-touch-games.mjs
node scripts/dev/test-asteroids-mobile.mjs
node scripts/dev/test-cabinet-flow.mjs
node scripts/dev/test-arcade-share.cjs
```

The social image can be rebuilt using the existing Sharp dependency:

```
node scripts/dev/build-arcade-preview.cjs
```

Local browser review uses an in-memory leaderboard. Test saves never write to
the public leaderboard. Its scores are fixtures, not Pat's actual records.

Completed: full Next.js build (including lint and type validation), all four
logic suites, syntax checks, and interactive browser review at 320x568, 375x500,
390x844, 844x390 and 1440x900. Checked coin entry, choices, ready Minesweeper,
practice/pause/resume, result scrolling, intentional name focus, failed save,
reload/restore and successful retry against the fixture service. A deterministic
local Snake food fixture shortened the result-flow review; it is not shipped.

The portable `scripts/dev/phone-audit.mjs` was updated for the new UI and mocked
score service. It is syntax-checked but was not run in this session. Browser
interaction was checked directly instead. Native multi-touch, keyboard resizing
and native sharing still require the physical-device checks below.

The original site already had unrelated uncommitted recovery fixes. They remain
untouched. Only arcade files, its tests and project notes were changed here.

## Review status

Changes are local and production is unchanged. The Vercel preview upload was
blocked by automatic approval review pending explicit approval to upload the
site source/assets to the existing project. Prepared deployment excludes local
secrets and scratch files. Local actual-site arcade preview:
`http://127.0.0.1:3019/arcade` (while the review server is running on this PC).

## Device sign-off before the LinkedIn post

- iPhone Safari and Android Chrome: portrait, landscape, safe areas, sound/mute,
  interruptions, explicit resume, and thumb reach during an actual game.
- LinkedIn's in-app browser on both devices: coin entry, game selection, each
  control layout, retry, name entry without zoom, save, and sharing fallback.
- Real simultaneous touch: hold diagonal thrust in Asteroids while tapping Fire;
  release/cancel each thumb independently. Test near system navigation edges.
- Minesweeper: tap, long hold, slide cancellation, flag toggle, chording, timed win.
- Snake: quick turns, accidental reverse input, optional arrows, and swipe feel.
- Open the deployed challenge URL in LinkedIn's Post Inspector after production
  publication to refresh its cached social image before sharing the post.

Browser viewport previews and logic tests do not replace these physical-device
checks. A preview deployment is for review, not evidence of production release.
