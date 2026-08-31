# Current Plate — pat-personal-site

**The plate for patrickneyland.com.** What is live, what is half done, and what is
waiting on Pat. Specs for individual pieces live in `docs/`; this file is the state of
the whole thing.

Last touched: 2026-09-01.

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

**The gate.** `content/gary.md` holds his voice and is Pat's to write. While it is empty
the launcher does not render and `/api/gary` refuses. This is on purpose: the plumbing
can ship without a personality, and a personality Claude invented cannot ship by
accident. Local development ran against a throwaway voice in a file outside the repo,
pointed at by `GARY_VOICE_FILE` in `.env.local`. None of that is his voice and none of it
is committed.

Verified live after the push: all five routes 200, the new sprite serves, `/api/gary`
correctly refuses, the launcher correctly does not render.

Full design and reasoning: [docs/gary-chat.md](docs/gary-chat.md).

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

**Every commit carries a personal gmail address as its git author email**, all 39 of them,
and this repository is public on GitHub. `CLAUDE.md` says that address must never appear
in the repo, and commit metadata is as public as file contents. It comes from the global
git config rather than anything in the project, so it will keep happening.

Not acted on, because the two ways out are both Pat's call: set a GitHub `noreply` address
in `git config user.email` from here on and leave the history alone, or rewrite all 39
commits and force push, which breaks every existing clone and link. Worth a decision
either way.

# Elsewhere

| Where | What |
|---|---|
| [docs/gary-chat.md](docs/gary-chat.md) | the chat: design, decisions and why |
| [docs/character-pipeline.md](docs/character-pipeline.md) | the drawn character: Krita to atlas to runtime |
| [docs/character-session-1.md](docs/character-session-1.md) | the working session that started the character |
| [CLAUDE.md](CLAUDE.md) | how to work in this repo, and the copy rule |
| [design.md](design.md) | colours, type and the per-page worlds |
| [ai-writing-detection.md](ai-writing-detection.md) | the writing prohibitions |
