# Working session 1: get the character running

Planned 2026-08-25, for whenever Patrick wants to sit down and do it.
Companion to [character-pipeline.md](character-pipeline.md), which is the spec
this session proves out.

---

## The point of the session

**Prove the pipeline end to end with throwaway drawings, then decide who he is
while looking at him on the real pages.**

Not: produce finished animation. The drawings made in this session are test
frames and get deleted. Everything that silently breaks in a sprite pipeline
(registration, trim offsets, the mask, the stride) breaks the same way with two
ugly drawings as with ninety-six good ones, and it is far cheaper to find out
with two.

**Done looks like:** he is on screen on a local page, standing on real text,
and adding a new action needs no code. Nothing is pretty yet.

---

## Before we start, if there is time

Twenty minutes, and if it does not happen we do it in block 0 instead.

1. Install Krita. Confirm the Wacom reports pressure. If it does not:
   Settings → Configure Krita → Tablet Settings, toggle WinTab and Windows Ink.
2. Window → Workspace → Animation.
3. Draw **two frames of anything**, barely different from each other. Content
   does not matter, these are throwaway. Two drawings is the whole ask.
4. File → Render Animation → Image Sequence → PNG, into
   `art/exports/idle/`, four digit numbering.

If step 1 fights back, stop and bring the error. Tablet driver problems are
worth ten minutes of the session and not an hour of an evening.

---

## Block 0 · Setup, only if needed
*20 min, and skipped entirely if the prep above is done*

---

## Block 1 · Make the pipeline real  ✅ DONE 2026-08-25
*~45 min. Mostly me.*

Built ahead of the session against synthetic fixtures, so nothing here is
waiting on a drawing. All four checks pass. `art/exports/idle/` currently holds
a placeholder made from the two arm poses of the front page SVG; Krita will
overwrite it.

I write `scripts/sprites.mjs` and `src/lib/character/player.ts` against his two
frames while he watches the output.

What we are actually hunting for, in order:

| Check | How we know it works |
|---|---|
| Registration extraction | The magenta dot is found, and no magenta survives into the atlas |
| Trim offsets | Frame 1 and frame 2 do not jitter relative to each other |
| The mask | He is black on white and light on the dark pages, from one file |
| `groundY` | His soles land on a line, not near it |

He needs to add a `reg` layer with one magenta dot before this block, which is
thirty seconds of work once Krita is open.

**Deliverable:** `npm run sprites` exists and produces a working atlas. ✅
512x512, 8.3 KB, and a `_selftest` clip whose every number is asserted on each
build so a silent regression fails loudly.

---

## Block 2 · Decide who he is
*~30 min. Together, and this is the real working session.*

This is the part that cannot be specified in advance, because it depends on
what he thinks when he sees it. I put things on screen and he reacts. No lists
of options, no questionnaire.

I will have ready, on a local branch, the same figure:

- **At three sizes** on `/fun` and `/portfolio`, from marginal doodle to
  something that owns the page.
- **At three activity levels**: always moving, mostly still with occasional
  motion, and only appearing at specific moments.
- **In two relationships to the content**: ignoring it, and reacting to it
  (standing on headings, pointing at links, falling off the bottom of a card).

Three questions get answered by looking, not by discussing:

1. How big is he.
2. How often does he move.
3. Does he know the page is there.

Whatever he decides here determines which actions are worth drawing, which is
why it comes before any real drawing.

**Deliverable:** those three answers, written into this file.

---

## Block 3 · Measure the run
*~30 min. Together.*

The moment the thing stops being plumbing.

1. He draws **four rough keys** of a run: contact, down, pass, up. Ugly and
   fast. Fifteen minutes, not an evening.
2. Export, rebuild.
3. We measure the foot travel off his own drawing and put `stride` in
   `clips.json`.
4. Watch the skating disappear.

If the stride is wrong the feet slide, and it is immediately visible, so this
block is self-checking. It is also the block most likely to overrun, and that
is fine.

**Deliverable:** a run cycle in his line, with feet that hold the ground.

---

## Block 4 · What he draws next
*~15 min.*

He decides the actions, from what block 2 settled. I write the `clips.json`
entries so the drawings have somewhere to land the moment they exist, and add
each one to a checklist in this file.

The test that the architecture worked: adding those entries needs no code.

---

## Explicitly not in this session

- Finished artwork. Everything drawn here is a test frame.
- `director.ts`. Behavior comes after there is something to direct.
- Faces. They are cheap once anchors exist, and they are a distraction until
  the body pipeline is proven.
- The front page. It stays plain and keeps its 2KB SVG.

---

## Practical notes from the last session

- **I cannot see the screen.** The loop that worked: he draws and exports, I
  build and screenshot with Playwright, he looks at localhost. Keep that rhythm.
- **`next build` clobbers a running `next dev`.** It rewrites `.next` and the
  dev server starts throwing 500s. If it happens, kill the port, `rm -rf .next`,
  restart.
- **Port 3003 has a stuck process** (PID 41076) that refuses `taskkill /F /T`.
  Use another port, or kill it from an elevated terminal first.
- Two loose files still sit untracked in the repo root, `PXL_20260825_180218028.jpg`
  and `Screenshot 2026-08-25 110345.png`. The repo is public. Decide whether they
  move to `art/` or get ignored before the next commit sweeps them up.

---

## Decisions log

Filled in during the session. Empty until then.

| Question | Answer |
|---|---|
| Size | |
| Activity level | |
| Aware of the page | |
| First actions to draw | |

---

## Session log · 2026-08-26 · the face-swap thread

The session went somewhere the plan above did not anticipate, and the plan is
now partly obsolete. What actually happened:

**Patrick took a CC0 sprite pack for the bodies and draws only the faces.**
That is a good trade: the pack's animation is correctly registered and covers
more actions than he would draw by hand, and the faces are where the character
actually lives. It also means the Krita pipeline in `character-pipeline.md` is
not the active path. He drew in **Procreate on an iPad**, not Krita on the Wacom.

### What exists

| | |
|---|---|
| `art/faces/raw/` | Nine Procreate exports, flattened on white |
| `art/faces/face-1..9.png` | Same, white keyed to transparent, position preserved |
| `art/faces/sheets/` | 27 sheets: 9 faces x walk / run / jump, plus `manifest.json` |
| `art/faces/walk-head-anchors.json` | Head centre per walk frame |
| `art/faces/face-template.png` | Procreate guide: head, crosshair, safe area, ghost of the original face, line-weight bars |
| `scripts/dev/rebuild-faces.mjs` | Composites faces onto actions. Counts faces itself |
| `scripts/dev/build-artifact.mjs` | Packages the review artifact |

Artifact: https://claude.ai/code/artifact/388aa028-00b6-44a4-a9e8-bd06a1af0150

### Measurements worth not re-deriving

- The pack's head is a **rigid ellipse, 91 x 87 interior, 8.5px ring**, identical
  in every frame of every action. It only translates.
- **It is not a circle.** Fitting a circle to it was the bug that left eyebrow
  residue on some frames and not others.
- The original scowl **cannot be erased**: its eyebrow runs into the head outline
  and is joined to it. The head is redrawn clean instead.
- The face sits **+11.3, +6.2 from head centre** at source scale, and drifts
  1.3px x / 2.1px y across the walk. Rigid enough to place, not rigid enough to
  erase against.
- One crop box `{190, 180, 160, 220}` serves walk, run and jump. All three
  occupy y 204..381, so **the jump sprites never leave the ground** — vertical
  displacement is the engine's job.
- Patrick's own pencil figure: **3.8 heads tall** counting hair, head 1.17x
  taller than wide, line weight **1.75% of height**.

### Open, for next time

- [ ] **01 and 02 are off-model.** The other seven use filled oval eyes with
      brows; those two are the older arc-and-dash style. Redraw or retire.
- [ ] **08 and 09 are near-identical** — same ink size, same position, stroke
      within 0.6px. Differentiate or drop one.
- [ ] Faces sit slightly low and right of the original. Reads as looking where
      he is going. Patrick has not ruled either way.
- [ ] **The scene format decision is still open:** does Gary travel horizontally
      through a scene, or does the page scroll vertically past him? Nothing about
      the landscape can be drawn until this is settled.
- [ ] Scene template offered and not yet taken up: 2048 x 1024, ground line at
      y 820, Gary ghosted at 354px.
- [ ] More actions are one word in `ACTIONS`: combo (19 frames), death (10),
      slide (8), dash (6), climb (4).

### Two threads now

This face-swap work and the scan-digitizing work in `art/scan-01..04` are
different approaches to the same character: **the pack's Gary with Patrick's
faces**, versus **Patrick's own drawn Gary**. Both are live. Worth deciding
which one the site actually ships before either goes much further.
