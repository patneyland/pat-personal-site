# Character pipeline

How the drawn figure gets from a Wacom tablet onto the site.

This is the canonical spec. Read it before touching anything under `art/`,
`scripts/sprites.mjs`, or `src/lib/character/`.

---

## The principle

**New content must never require new code.**

The site already works this way: adding a portfolio entry means adding a
markdown file, not editing an array. The character works the same way. A new
action is one Krita file plus one entry in `clips.json`. A new facial
expression is one drawing. Neither touches TypeScript.

If you find yourself editing a component to add a drawing, the pipeline is
wrong, not the drawing.

---

## Four layers

```
art/clips/*.kra          Krita source            you draw
        │  File > Render Animation                MANUAL
        ▼
art/exports/<clip>/      numbered PNG frames     committed, build input
        │  npm run sprites                        AUTOMATED
        ▼
public/assets/character/ atlas.png + manifest    committed, served
        │
        ▼
src/lib/character/       player, ground, director  runtime
```

Only the first arrow is manual. Everything after it is one command.

The runtime never knows a filename. It knows the manifest.

---

## Decisions

These are the load-bearing choices. Each one is here because the obvious
alternative fails at a specific, known point.

### 1. The face is its own layer, composited at runtime

**Actions and expressions multiply.** Twelve actions at eight frames, drawn
happy, surprised, thinking and asleep, is 384 drawings. Nobody finishes that.

Draw the body once and the faces once, and it becomes a sum: 96 body drawings
plus 8 faces. A new expression then works with every action that already
exists, and every action you draw later.

So: **`art/clips/*.kra` contain no face.** The head outline and hair belong to
the body, because they move with it. Only the eyes and mouth live in
`art/faces.kra`, on transparent ground.

Each body frame carries a **head anchor** so the runtime knows where to put the
face. See registration below.

The escape hatch: if a particular action needs a face that cannot be a flat
overlay (a head thrown fully back, a profile view), draw that one with the face
baked in and mark the clip `"face": false`. The runtime skips the overlay. Do
not let one awkward action force the whole system back into multiplication.

### 2. Ship an alpha mask, not artwork

The figure is one ink color. If the atlas is a black PNG, it is invisible on
the dark pages.

So the atlas ships as a **mask**, and the ink color comes from CSS:

```css
.char-body {
  mask-image: var(--atlas);
  -webkit-mask-image: var(--atlas);
  background-color: currentColor;
}
```

One file serves the white page and the dark pages, inherits `currentColor`, and
can be tinted for a ghost or an onion-skin effect without another asset.

The build sets every RGB value to zero and keeps only the alpha channel, which
also compresses far better than the original.

**Cost:** this throws away pencil *tone*. It works because the figure is solid
line with no gradation. If a future drawing needs shading, that clip ships RGBA
instead and sets `"mask": false`.

### 3. DOM sprites, not canvas

```html
<div class="char">
  <i class="char-body"></i>
  <i class="char-face"></i>
</div>
```

Two nested elements, positioned with `transform`, GPU composited, no
`requestAnimationFrame` unless something actually changes. They can be driven
by CSS scroll timelines where the browser supports it, and if JavaScript fails
you get frame zero, which is a valid drawing rather than an empty box.

Canvas wins above roughly twenty simultaneous characters, or when effects need
per-pixel work. Switch then, not before.

### 4. Trim, but record the offset

The packer trims every frame to its ink so the atlas stays small. Trimming
naively destroys registration and the figure jitters. Each frame therefore
stores `o: [ox, oy]`, the trimmed content's position inside the original frame
box, and the runtime adds it back.

This is the single most common sprite pipeline bug. It is silent, and it looks
like bad drawing.

### 5. Locomotion clips carry a stride, everything else carries an fps

```jsonc
"run":  { "kind": "locomotion", "hold": 2, "stride": 224, "loop": true }
"idle": { "kind": "ambient",    "fps": 6,  "loop": true }
"wave": { "kind": "oneshot",    "fps": 12, "loop": false }
```

- `locomotion` takes its phase from **distance traveled**: `phase = (d / stride) % 1`
- `ambient` and `oneshot` take their phase from **time**

Feet only stop slipping when the cycle is a function of distance. Encoding
`kind` in the manifest means the player cannot get this wrong, because it never
has to decide.

`stride` is the distance the body covers in one full cycle, which is **twice**
the distance a planted foot travels relative to the hip. Measure it off the
drawings and type it into `clips.json`.

### 6. The front page stays out of this

`/` is deliberately plain and deliberately light. It must not download a sprite
atlas. The pointing figure there stays a hand-authored SVG, and the atlas
system serves `/fun`, `/story`, `/portfolio` and `/garden` only.

---

## Directory layout

```
art/
  README.md                  how to set up Krita, in Patrick's words
  clips.json                 per-clip metadata, hand written
  faces.kra                  every expression, one per frame
  clips/
    idle.kra
    run.kra
    ...
  exports/                   COMMITTED. build input, regenerated by hand
    faces/0001.png ...
    idle/0001.png ...
    run/0001.png ...
scripts/
  sprites.mjs                npm run sprites
public/assets/character/
  atlas.<hash>.png           generated, committed
  character.json             generated, committed
src/lib/character/
  player.ts                  one character, one clip, one phase
  ground.ts                  measures surfaces he can stand on
  director.ts                decides which clip plays where
```

**The block above is the Krita-era plan, and it is no longer what is on disk.**
Patrick draws in Procreate now, over bodies from a CC0 pack, so `clips/*.kra`
and `faces.kra` were never created. What follows is the layout that is real.

### Where drawings actually live

```
art/
  paper-guy/       the original pencil photo, and what was traced from it
  headon/raw/      the head-on pointing poses            -> /assets/gary-point.png
  faces/raw/       Procreate face exports                -> face-N.png -> sheets/
  scan-01..04/     scanned pages, cut into parts         (the other thread)
  exports/         Krita frames from the first attempt   (dormant)
  first-anim/      the very first Krita test             (dormant)
```

**New drawing goes in `art/<thing>/raw/`.** Three rules keep it buildable:

1. `raw/` is yours alone. It holds the untouched export, and no script ever
   writes back into it. Number frames in play order, `0001.png` upward, so a
   script can read the directory sorted and get the timing for free.
2. **Draw every frame on one canvas and export the whole canvas, uncropped.**
   Trimming in Procreate destroys registration between frames, and that cannot
   be recovered afterwards. A script can find one shared crop box across all
   frames, which is what `make-pointer.mjs` does, but only if the frames still
   share an origin.
3. A script in `scripts/dev/` reads `raw/` and writes into `public/assets/`.
   Nothing hand-authored lands in `public/assets/`, so any sprite on the site
   can be rebuilt from the drawings after a redraw.

`art/exports/` is committed on purpose. Krita's animation export is a manual
GUI step, so the PNGs are the earliest point at which the build is
reproducible. They are a few KB each for line art.

**Exception: `art/exports/idle/` is generated, not exported.** Since
2026-09-03 it is built by `scripts/dev/make-idle-clip.mjs` from
`art/headon/raw/pose-*.png`, the same two drawings `make-facing.mjs` turns
into the /fun standing sheet, so the figure who stops to talk is the same
drawing on every page. The script derives its geometry rather than choosing
it: box, ground row and figure height are read off `art/exports/walk` (so
`play("idle")` mid-crossing cannot change his size or footing), the two poses
share one crop box (trimming them separately would break their registration),
and the magenta head mark is placed at the centre of the largest region the
ink encloses, which is the head. Redrawing the head-on poses means running
that script and then `npm run sprites`. Do not export into `idle/` by hand;
the script clears the directory when it runs.

`public/assets/character/` is generated but also committed, so Vercel does not
need `sharp` or a build step. Run `npm run sprites` locally and commit the
result.

---

## Drawing: Krita on a Wacom

Krita is the open source choice. It has real pressure and tilt, an animation
timeline, and onion skinning, and it is the only free desktop tool where all
three are good at once. OpenToonz is more capable and much harder. Pencil2D is
easier and much less capable.

**Wacom on Windows, the one gotcha:** Settings → Configure Krita → Tablet
Settings. If pressure does not respond, toggle between WinTab and Windows Ink.
That fixes it nearly every time.

**Workspace:** Window → Workspace → Animation. That gives you the Timeline and
Onion Skins dockers.

### The layer contract

Every file in `art/clips/` has exactly this structure, top to bottom. The build
depends on it.

| Layer | Contents |
|---|---|
| `reg` | Registration marks only. Pure magenta `#FF00FF` dot at the head center. Optional pure cyan `#00FFFF` dot directly "above" it in head space, which gives head rotation. Hard round brush, no antialiasing, no pressure. |
| `body` | The drawing. Head outline, hair, torso, limbs. **No face.** |

`faces.kra` needs only a `body` layer and one drawing per frame, each on
transparent ground, centered on where the head anchor will be.

### Export

File → Render Animation → Image Sequence → PNG, into
`art/exports/<clip-name>/`, four digit numbering, base name empty.

Export **once**, with both layers visible. The registration dots come out in
the same PNG and the build extracts and deletes them by exact color match.
That is why they must be pure magenta and cyan with a hard brush: no other
pixel in the drawing may be within tolerance of those values.

If color bleed ever becomes a problem, fall back to exporting twice with layer
visibility toggled, into `<clip>/` and `<clip>/reg/`. The build accepts both.

---

## `art/clips.json`

Hand written. The build merges it into the manifest.

```jsonc
{
  "run": {
    "kind": "locomotion",
    "hold": 2,              // frames held per drawing; 2 = on twos
    "stride": 224,          // px advanced per full cycle, at scale 1
    "loop": true
  },
  "idle":  { "kind": "ambient", "fps": 6,  "loop": true },
  "wave":  { "kind": "oneshot", "fps": 12, "loop": false, "next": "idle" },
  "think": { "kind": "ambient", "fps": 4,  "loop": true, "face": false }
}
```

A clip missing from this file gets `{ kind: "ambient", fps: 8, loop: true }`
and a build warning. Nothing silently breaks.

---

## `character.json`

Generated. Never edited by hand.

```jsonc
{
  "version": 1,
  "atlas": "/assets/character/atlas.9f3c21.png",
  "atlasSize": [1024, 1024],
  "scale": 2,                    // atlas is drawn at 2x; runtime halves it
  "mask": true,
  "clips": {
    "run": {
      "kind": "locomotion",
      "hold": 2,
      "stride": 224,
      "loop": true,
      "box": [120, 190],         // untrimmed frame size; the coordinate system
      "groundY": 186,            // the ground plane inside box: lowest ink + 1
      "frames": [
        {
          "r": [0, 0, 86, 150],  // rect in the atlas
          "o": [17, 12],         // offset inside box (see decision 4)
          "head": [44, 22],      // face anchor, in box coords
          "headAngle": -3        // degrees, omitted when there is no cyan dot
        }
      ]
    }
  },
  "faces": {
    "happy":     { "r": [512, 0, 40, 30], "o": [4, 6] },
    "surprised": { "r": [552, 0, 40, 30], "o": [4, 6] }
  }
}
```

`box` and `groundY` are what make placement work. Standing him on something is
"put `groundY` on the surface", at any size, which is the general form of what
the front page SVG does by having its viewBox trimmed to the soles.

---

## `scripts/sprites.mjs`

One command, `npm run sprites`. Dependency: `sharp`.

Responsibilities, in order:

1. **Read** every directory under `art/exports/`.
2. **Extract registration.** Scan raw RGBA for pixels within tolerance 8 of
   `#FF00FF` and `#00FFFF`. Centroid of each blob gives `head` and, if cyan is
   present, `headAngle`. Then zero the alpha on those pixels so they never
   reach the atlas.
3. **Record `box`** as the exported frame size, per clip.
4. **Find `groundY`**: one past the lowest inked row across all frames of the
   clip, so it names the ground plane rather than the last row of ink. He
   stands on the same ground in every frame, so one number per clip.
5. **Trim** each frame to its ink bounding box, recording `o`.
6. **Flatten to mask**: set RGB to `0,0,0`, keep alpha.
7. **Pack.** Shelf packer is sufficient: sort by height descending, lay out in
   rows, power of two canvas, 1px transparent gutter between frames to stop
   bilinear bleed. Fail the build above 2048x2048 rather than shipping an atlas
   that some mobile GPUs will refuse.
8. **Hash** the atlas bytes into the filename.
9. **Merge** `clips.json` and write `character.json`.
10. **Report**: total frames, atlas dimensions, file size, and any clip missing
    from `clips.json`.

---

## Runtime

```ts
const char = await Character.load('/assets/character/character.json');
char.mount(el);                       // creates the two <i> elements
char.play('run', { face: 'happy' });
char.advance(px);                     // locomotion clips consume distance
char.tick(dt);                        // ambient and oneshot clips consume time
char.standOn(surfaceY);               // aligns groundY to a measured surface
```

`ground.ts` measures every `[data-ground]` element once, in document
coordinates, and re measures on resize and on `document.fonts.ready`. Never
during scroll.

`director.ts` is the only file that knows anything about the page. It maps
scroll progress to distance, asks `ground` what is under him, and picks the
clip. Keeping it separate means the character can be dropped into a new page
without touching the player.

---

## Budgets

| Thing | Limit | If exceeded |
|---|---|---|
| Atlas dimensions | 2048 x 2048 | Split per clip group, lazy load with IntersectionObserver |
| Atlas transfer | 250 KB | Cut frame count before cutting quality; on twos is already the answer |
| Frames per clip | 12 | You are probably animating something that should be two clips |
| Simultaneous characters | 20 | Move to canvas |

Preload the atlas and `await img.decode()` before the first reveal, or the
first frame pops in late.

---

## Build order

Do not draw twelve actions before the pipeline runs end to end.

1. **One clip, two frames, no face.** Draw `idle` as two drawings. Get
   `npm run sprites` producing an atlas and get it on screen. This proves
   registration, trimming, offsets and masking, which is where all the bugs
   are.
2. **`run` plus `ground.ts`.** Now the stride arithmetic and the surface
   measurement are live. This is the hardest part and it is worth having alone.
3. **Faces.** Add `faces.kra` and the overlay. Cheap once anchors exist.
4. **`director.ts`.** Behavior last, when there is something to direct.

---

## Reduced motion and failure

`prefers-reduced-motion: reduce` holds every clip on frame zero. That is why
frame zero of every clip must be a drawing that reads well standing still.

If the atlas fails to load, the character elements stay empty and the page is
unchanged. Nothing on any page may depend on him to make sense.
