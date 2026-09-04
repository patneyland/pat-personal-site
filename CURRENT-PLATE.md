# Current Plate — pat-personal-site

**The plate for patrickneyland.com.** What is live, what is half done, and what is
waiting on Pat. Specs for individual pieces live in `docs/`; this file is the state of
the whole thing.

Last touched: 2026-09-03.

---

# SHIPPED: the house on /fun

**Live.** Merged and deployed 2026-09-01. `/fun` shows a drawn house standing at
the right end of the card's top edge, on the same ground line Gary's feet use,
with him pacing in front of it.

It is the first thing built through a new method for turning Pat's pencil
drawings into geometry: read the drawing for what it means, write it down as
numbers on a unit grid, then build from the numbers, never tracing. The method
and this house's schedule are in
[docs/drawing-to-geometry.md](docs/drawing-to-geometry.md). That file is the one
to read before drawing anything else for the site.

**Gary now knocks a hole in whatever is behind him.** He and the house are both
white line art at the same weight on the same ground, so he used to dissolve
into the window mullions where he crossed. He carries a second sheet of himself
filled in the ground colour, drawn under his sprite on the same element, so one
`background-position` keeps both in register and the walk logic is untouched.
Built by `scripts/dev/make-solid.mjs`. This is the piece that makes any future
scenery possible, and it matters more than the house does.

The house is sized and inked off Gary: 1u is his height over 5.5, and the pen is
whatever measures equal to his torso on screen. Change his display height and
the house follows.

## Known gaps

1. **Resolved 2026-09-03: it can no longer be cut off.** The house now sizes
   itself in one CSS expression (`W_EXPR` in `House.tsx`): the Gary-derived
   156 x 178 wherever it fits, scaled down on narrower cards, and the card's
   wrapper holds the house's height open above itself (`HOUSE_HEADROOM`,
   imported as a margin in `Hero.tsx`) so the section's overflow: hidden can
   never clip the roof. Below full size the whole drawing scales, pen
   included, so the line keeps its weight relative to the house; Gary stays
   72px, so a small card shows a smaller house beside the same Gary.
   Verified by screenshot at 320, 375, 390, 414, 480, 640, 768, 1024, 1280,
   1440, 1920 and 2560, each one looked at. Still never on a real phone,
   only emulated widths.
2. **Resolved 2026-09-03: checked against the greeting bubble.** `W_EXPR`
   keeps them apart: on wide cards the house stands clear to the bubble's
   right, on mid-width cards it shrinks until either its left edge clears
   x = 328 or its roof stays below the bubble's underside, and on the
   narrowest cards the bubble flips below the card anyway. Screenshotted
   with the greeting up at 375 through 1440 and with the chat open. The 328
   and 98 in `W_EXPR` encode GREET_W and Gary's height from `GaryPacing.tsx`
   plus the shortest standoff the shared placement rule can give the
   greeting (`src/lib/bubblePlacement.ts`, 2026-09-03: the rule only ever
   stands the bubble higher than the old fixed gap did, so the floor holds);
   change those and these need re-deriving.
3. **The knockout is hard coded to `#0e0e0e`.** It is only invisible on `--bg`.
   Scenery on a page with a different ground needs the sheets regenerated, or
   the layer reworked as a CSS mask.
4. **The source photo lives in pat_agent, not here.** `drawing-to-geometry.md`
   names `PXL_20260831_201732819.jpg` as the evidence. It is in
   `projects/pat-personal-site/sketches/` in the pat_agent repo, which is where
   sketches and working art live from 2026-09-01 on. Resolved, kept here so the
   path is findable.

Full notes: [docs/house-on-fun.md](docs/house-on-fun.md).

---

# ACTIVE: Gary's chat

**Live and on, running a Claude-drafted voice that Pat is replacing.** Shipped
2026-08-31 switched off; switched on 2026-09-01 once the OpenRouter key was set and
`content/gary.md` was filled in.

**The voice in `content/gary.md` is Claude's, not Pat's.** Pat asked for the throwaway
test voice to be committed as a starting point he would then improve. It is the one
place on the site where the copy rule has been knowingly set aside, and only as a
draft. Only the greeting is close to Pat's own words, from how he described it out loud
when the feature was scoped. Everything else is a guess at Gary and should be read as
placeholder until Pat has been through it.

## Where things stand

Click Gary and talk to him. He answers only from a knowledge base generated at build
time out of `content/`, so adding a portfolio entry teaches him about it with no code
change, and he can only link to routes that actually exist. There is no vector database
and there should not be one: the whole corpus is about 7,400 characters, so it fits in
the system prompt on every turn.

The conversation is a hand-drawn thought bubble that comes off him. He stops walking,
turns to face you, and goes back to pacing where he left off when it closes. On `/story`
he is clickable too but does not introduce himself. On `/` he never appears, because
boring mode stays plain.

Runs on **OpenRouter**, currently `anthropic/claude-opus-5`, changed in one line in
`src/lib/gary/model.ts`.

**The bubble is a fresh drawing every time it opens (2026-09-03).** The outline
is now a scalloped walk around a convex rounded-rect spine, built in
`src/lib/bubbleShape.ts`, replacing the union of circles whose oversized corner
lobes made a wide bubble read as a dog bone. There are four distinct recipes
(cumulus, popcorn, hero, billow), one picked at random per open and held
deterministically for its life, so two visits get two different bubbles and no
bubble shivers on re-render. The tail puffs drift and tilt, and vary with the
recipe. Checked by eye at greeting, one line, three lines, long chat, flipped
below him, and the phone sheet, and 1,600 rendered seeds were scanned for fill
holes after two winding bugs were found and fixed. The header comment in
`ThoughtBubble.tsx` records both dead ends so they do not come back.

**The gate.** `content/gary.md` holds his voice and is Pat's to write. While it is empty
the launcher does not render and `/api/gary` refuses. This is on purpose: the plumbing
can ship without a personality, and a personality Claude invented cannot ship by
accident. Local development ran against a throwaway voice in a file outside the repo,
pointed at by `GARY_VOICE_FILE` in `.env.local`. None of that is his voice and none of it
is committed.

Verified live after the push: all five routes 200, the new sprite serves, `/api/gary`
correctly refuses, the launcher correctly does not render.

Full design and reasoning: [docs/gary-chat.md](docs/gary-chat.md).

## The bubble's clearance is ONE rule, in one file (2026-09-03, later)

Pat reported the smallest puffs of the greeting's trail landing on Gary's
head on `/fun` (reproduced at 1440x900). The cause: `/story` had been fixed
to measure the trail it actually draws, but `/fun` still carried its own
fixed `GAP = 48`, and the four recipes reach 45 to 137px, so long trails
overshot him. Two copies of one rule, one of them stale.

**Now there is one.** `src/lib/bubblePlacement.ts` owns everything about
where a bubble stands relative to whoever is speaking:

- `standoff(w, h, draw, tailX, side)` is the clearance rule itself: the
  painted reach of the trail THIS drawing makes (`tailReach` over the same
  pure `buildBubbleShape` call the bubble renders) plus `SPEAKER_MARGIN`
  (12px). The margin is defined once, there.
- `placeBubble({ speaker, draw, w, hMax, hMin, bounds, modes, prev })` is
  the whole anchor decision, lifted out of `StoryGary.tsx` and
  parameterised: which side (above / below / left / right, then a shrunken
  box, then pinned), where the trail exits, and how far off him it stands,
  against the bounds the caller passes. Bounds are the PAINTED drawing's
  clip edges; the solver keeps the layout box inside them by the bleeds.
- `LOBE_BLEED` (44) and `TAIL_BLEED` (138) live there too, with their
  derivations, plus `H_MIN`, `HEAD_FRAC`, `PINNED_CLEAR_X`.
- `rollDraw()` picks the recipe and seed per open for both pages and
  honours `?bubble=N` / `?wobble=N` on either page.

`/story` passes the viewport below the nav as bounds and allows all four
sides. `/fun` passes the card's track sideways and the viewport vertically
(the section is overflow: hidden, so a lobe past the viewport top is
sliced, not just off screen) and allows above / below only. Neither page
carries a clearance, gap, margin or bleed number any more; a grep for one
comes up empty, and the header comments in both say why.

What is still page-specific, and why: the /fun greeting is auto height, so
`ThoughtBubble` gained an optional `onSize` callback and `/fun` re-places
off the real measured box (the outline is built from those same integers);
the sprite half-widths (`WIDTH / 2` on /fun, `height * 0.42` on /story)
are facts about each page's figure, not clearance; and the nav height
(54) is /story's. One behaviour changed on purpose: the /fun chat no
longer grows past 16:9 into a tall sky (it used to reach 420px above him
on tall screens). Every surface now draws the same 480x270 conversation,
shrinking in 20px steps to 160 when the sky is short, which is what
"consistent across the site" means. On a 1080p screen the chat now hangs
below him at full size where it used to sit above him with the trail on
his head.

Verified in an isolated served build: `/fun` all four recipes, greeting and
chat, above and below him, at 1440x900 / 1280x900 / 1024x900 / 900x800
(and 1440x1300 / 1024x1400 for chat-above), every crop looked at, no puff
touching him; programmatic sweep 10 widths x 2 heights x 4 recipes,
greeting + chat, 96 checks on the final build (plus 160 on the build
before the last fix), zero hits, and after every open a keystroke re-render
left the box exactly where it was; `/story` unchanged: 64 checks (768 at
scroll 0.40 / 0.45 / 0.50 / 0.55, and 720 / 1024 / 1440 at 0 / 0.3 / 0.7 /
1, all four recipes) with zero puffs on him, zero painted pixels outside
x in [0, vw] / y in [nav, vh], frozen, head-on, resumed on close every
time, and a further 273 checks across 6 widths x 13 scroll fractions on
the previous build with the same zeros; 390px sheet, 390px corner panel
and reduced-motion corner panel intact. `tsc` and `next build` clean.

Two loose ends, on purpose. `House.tsx` was out of scope and is untouched,
so its `W_EXPR` comment still names a `GAP` that no longer exists; the
floor it derives (120px) is still valid because the shared rule can only
stand the greeting higher, but the comment wants rewording next time that
file is open. And `/fun` keeps its chosen side per box, not per open: the
remembered side is keyed to whether it was chosen for the greeting or the
chat, so the chat never inherits the greeting's side and a shrunken
above-him chat cannot flip to a full-size below-him one on the next
keystroke (that flip existed for one draft of this change and was caught
by the keystroke re-render check above).

**Do not add a second copy.** If a page needs the bubble somewhere new,
add a mode or a bound to `placeBubble`; never write a gap in the page.

## /story now works like /fun: he stops, faces you, and the bubble is his (2026-09-03)

The corner panel is gone from `/story` wherever Gary is on the board. Clicking
him freezes his crossing on the spot (board coordinates, so he scrolls with the
content), swaps him to the head-on `idle` clip from the atlas (the same two
drawn poses the /fun facing sheet uses), and opens the ThoughtBubble beside
him, portalled to the body as `position: fixed` and re-anchored to him every
frame. Clicked mid-leap he comes down on the nearer end of the arc rather than
hanging in the air (`Pose.ground` in `route.ts`). Close it and he resumes from
exactly where he stood; if the reader scrolled while it was open, he runs a
short 450ms catch-up to wherever the route now puts him instead of teleporting.

**The "same two drawn poses" parenthesis only became true on 2026-09-03.** The
atlas `idle` was still the first-attempt Krita figure (small head, spiky hair)
while every other clip had been redrawn, so stopping him on /story swapped in
an old character. `scripts/dev/make-idle-clip.mjs` now regenerates
`art/exports/idle/` from `art/headon/raw/pose-*.png`, the same drawings
`make-facing.mjs` builds the /fun sheet from. It derives everything: box,
ground row and figure height are read off `art/exports/walk` so the swap
cannot change his size or footing (the old idle stood a full box tall and was
5% bigger than walking Gary), and the magenta head mark goes at the centre of
the largest region the ink encloses, which is the head. `npm run sprites`
repacked the atlas to `atlas.fab94f.png` (1024x512 now the tall old frames
are gone) and the self test passed. Verified in a served build at 1440x900
and 1024x900, several scroll positions each: same drawing on both pages by
eye, frozen rect identical over 1.6s, resume after close, feet on the
polaroid edge, walk and the drawn breath clips untouched. Redraw the poses,
run both scripts, and both pages update together.

Bubble placement is deterministic and sticky: above his head when that clears
the nav, else below his feet, else beside him, else a shorter bubble above or
below (the box shrinks in 20px steps down to 160 before giving up), else
pinned inside the viewport with the trail aimed at wherever he is; the last
choice is kept while it still fits so it cannot flip-flop on the threshold.
Scroll him off screen with the chat open and the bubble pins to the near
viewport edge, still usable.

**The trail is placed by its own measured reach, and it stops short of his
face (2026-09-03).** Pat reported build-up puffs landing on Gary's face and
trails starting from inconsistent places. The cause was a fixed 78px gap
against a variable trail: the four recipes reach 45 to 137px past the box,
so long-trailed recipes overshot him, and the side placements still ran the
trail off the top or bottom, aimed at nothing. Now `StoryGary` rolls the
recipe and seed itself per open (`?bubble=N` / `?wobble=N` pin them for
checking), measures the exact painted trail with `tailReach` over the same
pure `buildBubbleShape` call the bubble renders, and places the box so the
last puff stops 12px short of his ink, the clearance the approved drawing
already had in the common case. The side modes now run the trail out of the
side edge at his head height, pointing straight at his head; the generator
and `ThoughtBubble` learned left/right exits for it (`tail` prop, plus a
`wobble` prop so the caller and the drawing share one seed, both backwards
compatible). In pinned mode, when the trail cannot stop short of a visible
Gary, it dodges to a column at least 48px off his centre line so no puff can
sit on his face; on very short windows the pinned box itself can still cover
him, which the shrinking above/below modes now make rare. TAIL_BLEED (138)
remains as the worst-case cap that sizes `h` and keeps the viewport clamps
satisfiable; every per-open decision uses the real reach. (Later the same
day this whole solver moved out of `StoryGary.tsx` into
`src/lib/bubblePlacement.ts` so `/fun` runs the identical rule; see the
section above.) Verified in a
served build: all four recipes in all five placements screenshotted and
looked at, no puff on his face anywhere, trail origin consistent (always the
edge facing him, aimed at his head); painted-extent sweep 7 widths x 13
scroll fractions with the chat open, including 768 at 0.40-0.55, zero
clipped, zero face hits; freeze/facing/resume and the 390px fallback
re-checked.

The handover is `claimConversation()` in `GaryChat.tsx`: StoryGary claims the
conversation while his crossing is alive, and `GaryPanel` stands down while
anyone holds a claim. Below 720px, under reduced motion, or with a missing
atlas nothing claims, so the corner panel comes back by itself; verified at
390px via /fun -> /story with the chat open.

Verified by driving a real browser at 720/1024/1280/1440/1920 x4 scroll
positions each: frozen (identical transform over 2s), facing pose, bubble on
screen, clear of him and clear of the nav in all 20 runs, resume after close.
Screenshots in the pat_agent scratchpad under `story/`. Not yet exercised: the
lab page knobs against the frozen state, and no real phone has seen any of it.

The clamp works on the painted shape, not the box. The bubble's SVG is
`overflow: visible` and the lobes are drawn outside their own layout box, so a
first pass that kept the box 40px off the edge still had the lobes sliced flat
at x = 0 around 720-800px wide, mid-board. `LOBE_BLEED` (44), now in
`src/lib/bubblePlacement.ts`, is derived from the caps in `bubbleShape.ts` and cross-checked
against the generator; `TAIL_BLEED` (138) is the cap of the trail's reach over
every recipe and seed, and since 2026-09-03 it is used only to size `h` so the
clamps stay satisfiable, while the clamp on the trail's own side uses the real
measured reach of the drawing being made (`tailReach`). Re-verified on the
painted vectors, 7 widths x 13 scroll fractions with the chat held open, zero
clipped. If the shape generator's lobe depth or tail length changes, these two
numbers need re-deriving.

## Blocked on Pat

1. **Rewrite `content/gary.md` in his own words.** The draft in there is Claude's and is
   live to visitors right now. Every note in that file is inside an HTML comment, so
   anything outside a comment counts as his voice. Keep the headings: the bubble reads
   the greeting out of "His greeting" by name and shows it word for word.

Nothing else is blocked. The rest of the feature is finished and live.

Done, for the record:

- `OPENROUTER_API_KEY` set by Pat in Vercel on 2026-08-31, production target only. Add it
  to Preview as well if branch deploys should ever answer.
- Redeployed and confirmed the key took effect, then again after the voice landed.
  https://vercel.com/neyland-solutions/pat-personal-site/settings/environment-variables

## Worth knowing before you report a bug

**The greeting shows once per browser tab.** It is remembered in `sessionStorage` under
`gary.greeted`, so a second visit in the same tab gets no bubble even though he is
working fine. Use a fresh tab or a private window when checking it. Clicking him always
opens the chat regardless.

## Open decisions (Pat's)

1. **His personality.** See above. Three things the throwaway voice exposed, worth
   fixing when the real one is written:
   - He is fine at short factual answers and weak the moment a question is about a
     person. "Who is Patrick?" came back as "He's the one whose site this is, and you're
     already on the right page for that." The handoff rule works, the words do not.
   - He needed telling twice, in rules, not to write like a language model. Brevity had
     to become a hard one-or-two-sentence limit and em dashes had to be banned outright
     before he stopped producing them. A real voice should make both unnecessary rather
     than the rules file fighting him.
   - The greeting is shown verbatim rather than generated, so it carries more weight than
     anything else he says.
2. **The rest of the writing rules.** Only the em dash ban from `ai-writing-detection.md`
   made it into his prompt. The full prohibition list is not in there.
3. **The bubble is not in Pat's hand.** Its outline is generated, traced off a CC0
   reference rather than drawn. `scripts/dev/trace.mjs` is the route if it should be his,
   the same way the head-on poses were.
4. **Where Gary can be talked to.** Today: `/fun` and `/story`. Not `/`, not `/portfolio`
   or `/garden` unless a conversation is already open and follows you there.

## Verified in production, 2026-09-01

Driven in a real browser against www.patrickneyland.com, not just curled: on `/fun` the
greeting bubble appears, he stops and faces you, and he answers in the bubble. On
`/story` he is clickable and the chat opens with no greeting. Off-topic questions are
still declined, and the answers stay inside one or two sentences.

Deployment `3087e57`, READY and aliased to production.

Note when checking by hand: `/story` looks like it has no launcher if you grep the
served HTML, because Gary there is mounted by JavaScript once the sprite atlas loads
rather than server rendered. Only a real browser tells you the truth on that page.

## To change: he should not point while he is talking

**Pat, 2026-09-01.** When Gary stops to chat he keeps bending and straightening
his arm. That gesture is the pointing loop, and it belongs on `/`, where he is
pointing at the link to the fun page. Standing in front of someone who is
talking to him, he should not be pointing at anything.

The cause is that the standing sheet *is* the pointing pair.
`public/assets/gary-facing.png` is 228 x 144, two 114 x 144 poses, the same two
drawn poses `gary-point.png` uses on the front page, alternated every 1.6s by
`FACING_CYCLE` in `GaryPacing.tsx`. Nothing distinguishes talking from pointing
because both read from the same art.

The replacement art already exists and is not in this repo. `idle-sheet.png` is
a four frame standing sheet, arms out and slightly varying, no point in it. It
lives in pat_agent at `projects/pat-personal-site/sketches/idle-sheet.png` and
is still the raw scan: 1024 x 400, black line on white, four 256 x 400 cells.

To do it:

1. Process the scan into the site's sprite format, white line on transparent,
   four 114 x 144 cells, the way `gary-pace.png` and `gary-facing.png` are.
2. Generate the knockout companion with `scripts/dev/make-solid.mjs`, or he will
   dissolve into the house the moment he stands in front of it.
3. Point the standing sprite at the new sheet and set `FACING_FRAMES` to 4.
   `gary-point.png` on `/` is untouched: that one is correct as it is.
4. The atlas `idle` clip (his standing pose on /story) is built from the same
   `art/headon/raw/` drawings by `scripts/dev/make-idle-clip.mjs`. If the
   standing art moves to the four-frame sheet, land the new frames in
   `art/headon/raw/` (or repoint that script), run it, then `npm run sprites`,
   or /story will keep gesturing with the pointing pair after /fun stops.

The gesture rate probably wants a look at the same time. 1.6s for two poses was
chosen to read as talking; four frames may want a different cycle.

## Not yet verified

- **The mobile fallback has not been seen on a phone.** Below a 420px card the bubble is
  replaced by a sheet at the bottom of the screen, portalled to the body. It works in a
  narrow browser window; no real device has touched it.
- **Rate limiting is per server instance.** Serverless means each instance keeps its own
  counter, so 12 messages a minute is a speed bump, not a wall. Untested against anything
  deliberately abusive.
- **Nobody but Pat and Claude has used it.** No real visitor has asked Gary anything yet,
  so the questions people actually ask are still unknown.
- **Cost in the wild is unmeasured.** A conversation runs a few cents at
  `anthropic/claude-opus-5`, but that is arithmetic, not an observed bill. OpenRouter's
  activity page is where that shows up.

## Lessons worth keeping

**A gate that can fail open is not a gate.** The first version of the voice check
stripped comments and headings and measured what was left. The notes-to-Pat in
`content/gary.md` were neither, so they sailed through, opened the gate, and the model
adopted Claude's instructions as its personality. The fix was structural, not a better
heuristic: every note in that file now lives inside an HTML comment, so anything outside
one is by definition Pat's.

**Two dev servers in one folder corrupt each other.** Both write the same `.next`, and
the symptom is phantom 404s on routes whose files are present and untouched. This cost
real debugging time while another agent was working in the same tree. One server, or one
worktree each. The same applies to running `next build` while a dev server is up.

**Hand-drawn means fewer and bigger, not wobblier.** The first thought bubble had twenty
near-identical bumps on a rectangle and read as a doily. A real one is six to a dozen
lobes, each a large fraction of the shape, biggest two or three times the smallest.

## Tooling built

| Script | Purpose |
|---|---|
| `scripts/dev/make-pacer.mjs` | the walking sprite for the top edge of the `/fun` card |
| `scripts/dev/make-facing.mjs` | the standing sprite he swaps to when he stops to talk |
| `scripts/dev/make-idle-clip.mjs` | the atlas `idle` clip, from the same head-on drawings, so /story stops to the same figure |
| `scripts/dev/make-pointer.mjs` | the pointing figure on the plain front page |
| `scripts/thumbnails.mjs` | screenshots any portfolio entry with a public link |

`make-pacer.mjs` and `make-facing.mjs` both read a CC0 sprite pack that lives **outside
the repo** in a temp folder. If it has been cleaned up, unzip
`stick_figure_character_sprites_2d.zip` again and repoint `SRC`. The generated PNGs are
committed, so this only matters when changing a sprite.

---

# SHIPPED: Gary crossing the story page

**Live on production, `9e296f5` through `e236c97`.** He starts on the first polaroid,
runs the top edge of each card and leaps between them as you scroll, and finishes on the
torn note, where he gets his breath back and then paces it for as long as you stay.

Owns `src/lib/character/`, `src/components/ui/StoryGary.tsx` and `src/app/lab/`. The chat
later added 35 lines to `StoryGary.tsx` to make him clickable, so that one file has two
authors in it. The collage itself is unchanged apart from the `data-surface` hooks the
layer reads: it was not restyled and should not be.

## Where things stand

**Position is a pure function of `scrollY`, not a simulation.** That is the decision the
rest hangs off. Scrolling back up needs no rewind logic, because the same function
returns the same place and only the sign of the reader's travel changes, which is exactly
what sets his facing. One accumulator survives, the gait, and it counts *unsigned*
distance so his legs cycle forward while his body retraces.

Surfaces are arc-length parameterised polylines read off the layout, which is what makes
the torn note's `clip-path` polygon a genuinely walkable jagged edge instead of a straight
line with a landing pinned to it. Cards are measured through `offsetLeft`/`offsetTop`
chains rather than `getBoundingClientRect`, because `BlurFade` holds them at `y: 12` and
the rect would put his feet through the paper.

Staying inside the frame is solved rather than tuned. A fall drifts upward against the
viewport before gravity catches up, so departure anchors are solved backwards from the
margin. Headroom measures 80 to 83px against a floor of 74 at 1280x900, 1280x720 and
1920x1080.

Three clips are drawn rather than borrowed, in `scripts/dev/make-story-clips.mjs`, because
nothing in the sprite pack is out of breath: `drop`, `puff` and `rise`. The body is six
strokes at the pack's own measured weights, under the same generated head, so they arrive
through the same door as the rest.

## Known limits

- **The crest is skippable on the two short hops.** `fiscalsim -> asu` and
  `neyland -> realstuff` do their whole rise in 25 to 40 scroll pixels, so a fast flick of
  the wheel can jump straight past it. Inherent to scroll-driven animation, not a defect.
- **Pacing does not carry back into the scroll.** Pace for a while, then scroll up, and he
  snaps back to where he first stopped. There are 140px of scroll before it happens and
  the page is moving when it does, so it is well hidden. Fixing it properly means feeding
  the pace position back into the route, which is real complexity for a case you have to
  work at to see.
- **Below 720px wide he does not render at all.** Deliberate: the cards stack into one
  column and the leaps would be vertical drops down a corridor barely wider than he is.
- **Reduced motion parks him standing on the first card.** Checked only in an emulated
  browser, never on a machine with the OS setting actually on.
- **No real phone has seen any of it.**

## Waiting on Pat

1. **The sprite pack lives outside the repo, in a Windows temp folder.**
   `scripts/dev/make-story-clips.mjs` reads from it, and Windows will clear it on its own
   schedule. The packed atlas is committed so the site is safe, but once that folder goes
   the clips cannot be rebuilt from source. Moving it somewhere permanent is a two minute
   job; it ships a `License.txt` and `.gitignore` already excludes the zip.
2. **The Playwright verification harness was never committed.** Frame safety, footing and
   facing sweeps, written and thrown away several times over. Worth keeping as
   `npm run gary:check` if this is going to be touched again.

## Lessons worth keeping

**A number that looks like the thing it controls but is not.** The jump arc is
`y = (drop + rise)u^2 - rise*u`, so `rise` is a throw coefficient and the apex it actually
buys is `rise^2 / (4 * (drop + rise))`. At `rise = 40` over a 541px drop that is 0.69px:
he ran off every edge and fell. Worse, the comment above the constant had reasoned its way
to 40 and then recorded the result as deliberate, which is how a bug survives a reading.
The fix was to tune the height and solve the coefficient, and to solve it *per hop*, since
one shared coefficient reads flatter over a longer drop and was giving the widest gaps the
smallest hops.

**Facing read off the reader is meaningless the moment the reader stops.** Deriving it
from scroll direction is right while the page moves and undefined once it does not. It bit
twice at opposite ends of the page: a moonwalk on every return leg of the pacing, and then
standing at the top wearing the direction he came home in. Both ends now take facing from
the pose. If a third place appears where he stands still, that is the rule it will need.

**A drawing's ground contact is part of its timing.** The jump clip is crouch, drive,
rise, and only the third frame leaves the paper, but the arc started at the top of the
crouch, so he climbed while still folded up and read as being lifted rather than jumping.
The boundary is now derived from the clip's own frame count rather than typed, so the two
cannot drift apart.

**Verify the committed tree, not the working tree.** Two files, `src/app/layout.tsx` and
`src/components/ui/GaryPacing.tsx`, were coupled to the chat while the chat was still
uncommitted, so a local build proved nothing about what would deploy. The check that works
is a throwaway `git worktree` at the commit with the other work genuinely absent.

**The first hop was never inside the guarantee.** The first card sits near the top of the
document, so the departure the frame solve asks for is off the top of the page and gets
clamped, and the headroom guarantee is silently discarded with it. It went unnoticed until
a change made it visible. Where a departure is clamped the hop now gets *quicker* rather
than lower: less scroll is less climb against the frame and it costs nothing in board
space.

## Tooling built

| Script | Purpose |
|---|---|
| `scripts/sprites.mjs` | packs `art/exports/*` into the atlas and `character.json` (`npm run sprites`) |
| `scripts/dev/make-story-clips.mjs` | every clip on the story page, including the three drawn ones |
| `scripts/dev/rig.mjs` | rig for the traced drawings |
| `scripts/dev/trace.mjs` | traces a scan into an outline |
| `scripts/dev/scan-extract.mjs` | pulls drawings out of a flatbed scan |
| `scripts/dev/make-fixtures.mjs` | fixtures for the sprite packer's self test |

---

# Repo-wide, unresolved

**Every commit carries a personal gmail address as its git author email**, without
exception, and this repository is public on GitHub. `CLAUDE.md` says that address must never appear
in the repo, and commit metadata is as public as file contents. It comes from the global
git config rather than anything in the project, so it will keep happening.

Not acted on, because the two ways out are both Pat's call: set a GitHub `noreply` address
in `git config user.email` from here on and leave the history alone, or rewrite the whole
history and force push, which breaks every existing clone and link. Worth a decision
either way. The count only goes up while it is left.

# Elsewhere

| Where | What |
|---|---|
| [docs/gary-chat.md](docs/gary-chat.md) | the chat: design, decisions and why |
| [docs/character-pipeline.md](docs/character-pipeline.md) | the drawn character: Krita to atlas to runtime |
| [docs/character-session-1.md](docs/character-session-1.md) | the working session that started the character |
| [CLAUDE.md](CLAUDE.md) | how to work in this repo, and the copy rule |
| [design.md](design.md) | colours, type and the per-page worlds |
| [ai-writing-detection.md](ai-writing-detection.md) | the writing prohibitions |
