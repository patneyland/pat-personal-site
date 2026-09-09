# The arcade

Status: **live at `/arcade`.** Built 2026-09-04, three games playable, scores
worldwide. Snake, Minesweeper and Asteroids on a CRT, a dial to change
channel, a coin slot that has to be fed before anything starts, and Gary
working the floor.

---

## It is not a React route, on purpose

Everything lives in `public/arcade/` as one plain HTML document plus six
scripts. `next.config.ts` rewrites `/arcade` to `/arcade/index.html`, because
Next serves `public/` files at their literal path and the page would
otherwise only be reachable as `/arcade/index.html`.

Two reasons it stays whole rather than becoming `src/app/arcade/page.tsx`:

- **Its stylesheet would flatten the rest of the site.** It opens with
  `* { margin: 0 }` and its own `html`/`body` reset. As a React route that CSS
  is global, and `/story` and `/garden` are collateral. Keeping the page
  separate makes the collision impossible rather than something to manage.
- **The games gain nothing from React.** They are canvas and vanilla JS with a
  fixed-timestep loop. A component tree around them is overhead.

The cost is real and worth naming: this page does not inherit the site nav,
the fonts from `layout.tsx`, or Gary's chat. The nav is meant to be hidden
here anyway, the fonts are loaded from Google in the page's own head, and the
back link at the foot of the rail is what stops it being a dead end.

### The files

| file | what it owns |
|---|---|
| `index.html` | the whole page: tokens, CRT layers, bezel, rail, coin, dial, and every game's CSS |
| `cabinet.js` | the machine around the games - dial, mount/unmount, overlays, credit gate, rail, submit |
| `net.js` | Supabase reads and writes, formatting, owner mode |
| `sound.js` | every sound, synthesised at call time |
| `snake.js`, `minesweeper.js`, `asteroids.js` | the games |
| `gary.js` | Gary |
| `mobile.js` | the phone shell - the gate, the HUD, the board sheet |

Scripts are referenced absolutely (`/arcade/sound.js`). They must be: the page
is served at `/arcade` with no trailing slash, so a relative `src` resolves
against `/` and 404s.

---

## The games

Ported from `repos/arcade` (Snake, Minesweeper) or written for this page
(Asteroids). The cabinet owns the chrome; a game only draws and reports.

### Snake

Nokia lineage, 24x24, speeds up 3.5ms per apple from 130ms to a 60ms floor.
The direction queue compares against the tail of the queue rather than the
live direction, so two fast keypresses inside one tick cannot fold the snake
back on itself.

**Deliberately not made "authentic".** There is no authentic Snake to be
faithful to. The lineage splits three ways - Blockade (1976, the arcade
ancestor, two-player), Nibbler (1982, the actual arcade snake, maze-based),
and the Nokia 6110 (1997), which is what everyone pictures. This is the Nokia
one, and even that had discrete speed levels picked before you started rather
than a ramp. Pat's call, 2026-09-05: leave it.

### Minesweeper

10x10, 15 mines, ranked on time. Not an arcade game and it does not pretend to
be one - it is a 1990 Windows game, which is why its sounds are bare PC
speaker with no envelope to speak of.

- Safe first click: mines are placed after it and never under or beside it.
- Right click cycles none -> flag -> question -> none, as Windows did. The
  question mark is a maybe, not a claim: it does not count against the mine
  total and it does not stop you clicking the cell.
- `F` and `Q` toggle marking modes, with a button each on the glass. One mode,
  two buttons: turning one on turns the other off, because a click can only
  mean one thing. Right click was never broken - it was undiscoverable, which
  is what the buttons fixed.
- Chording on a revealed number counts flags only.

Left alone deliberately: the smiley button, the 7-segment LED counters, and
the classic number colours. The timer shows tenths rather than whole seconds
because the leaderboard ranks on time and whole seconds would manufacture
ties.

### Asteroids

Written to the 1979 cabinet. Vector outlines only, momentum that never fully
stops, screen wrap on everything, rocks that split 3 -> 2 -> 2, and 20/50/100
scoring.

What fidelity actually cost:

- **Four bullets on screen, and no auto-fire.** One press is one shot. The cap
  alone does nothing if holding the button empties the magazine for you - the
  two only work together. `e.repeat` swallows the OS key-repeat.
- **Waves go up by two from four, capping at eleven** (4, 6, 8, 10, 11), and
  rocks get faster alongside: x1.00 at wave 1 rising to a x1.8 ceiling. More
  rocks alone was only half the original's curve.
- **The saucer.** Large is 200 points and fires at nothing in particular;
  small is 1000 and aims, with an error shrinking from 0.40 rad to 0.04 as you
  score. Large only below 3,000, small only above 40,000, weighted between.
  Its shots break rocks without scoring them, a rock takes it out as readily
  as it takes you out, and it warbles the whole time it is on screen.
- **Hyperspace**, on Down / S / Shift. Off the board for a third of a second,
  back somewhere random with no velocity. The drive can fail on re-entry: 12%
  on the first jump of a life, six points worse each jump after, capped at
  42%, reset with a fresh ship. Resolved on arrival rather than departure, so
  you always see where you landed before it goes wrong.
- **A free ship every 10,000 points**, which matters once something is
  shooting back.

Still not authentic: rocks are randomly generated polygons where the original
reused four hand-drawn shapes, and thrust pulses every 85ms where the original
was one continuous rumble.

---

## Scores

Two tables, and they must not be confused:

- `public.arcade_scores` - the Neon Arcade family game night (`repos/arcade`).
  **Nothing on this page reads or writes it.**
- `public.site_arcade_scores` - this page. Public, worldwide.

Supabase project `pikvadotiruvanjjnfid`. The key in `net.js` is a publishable
anon key behind RLS: `SELECT` and `INSERT` only, so a score cannot be edited
or taken back once posted.

### Pat's own scores

The champion strip above the table is **Pat's all-time high, not the world's**.
Others can outrank him on the board below; they cannot take that box. His row
carries a verified badge and is pinned back onto the list at its true rank
when the top ten pushes it off.

He keeps exactly **one row per game**. An owner run updates that row when it
beat it and leaves it alone when it did not, so the board shows him once, at
his best, rather than filling with his attempts. A partial unique index on
`(game, mode) where is_owner` makes that a database rule rather than a
convention.

**Ownership is not forgeable**, which matters on a public board:

- The insert policy is `WITH CHECK (is_owner = false)`. Nobody can declare
  themselves the owner on the way in.
- The only routes to `is_owner = true` are `claim_arcade_score()` and
  `submit_owner_score()`, both `SECURITY DEFINER`, both checking a secret held
  in `public.site_arcade_owner` - a table with RLS on and zero policies, so
  the anon key cannot read it at all.
- The name is reserved outright:
  `CHECK (is_owner or lower(btrim(player)) <> 'pat neyland')`. A visitor
  typing it in any casing is refused by the database, not by the page, so it
  holds against a direct API call too.

Verified against the live key: reading the secret returns empty, inserting as
owner is refused, claiming with a wrong secret returns false, and all four
casings of the reserved name are rejected.

### Turning owner mode on

Visit `/arcade?owner=<secret>` once per browser. The secret goes into
`localStorage` and the query string is scrubbed from the URL immediately, so
it never sits in history or a screenshot. `?owner=off` forgets it. After that
every run submits as `pat neyland` with the field filled and locked, and the
name is stored lowercase (the rail uppercases every name for display).

The secret lives in the database and **is not in this repo**. To rotate it:

```sql
update public.site_arcade_owner set secret = '<new>' where id = 1;
```

Every browser then has to be re-armed with the new link.

---

## Gary

Same drawings and the same walk as the Gary on `/fun`, off the same sheets in
`/assets`, but none of the chat. The React component cannot be imported into a
standalone document, so the walk maths in `gary.js` is carried over from
`GaryPacing.tsx` rather than reinvented - which is why the constants match it.

He starts beside the coin and says to put one in. The coin dropping is his
cue: he walks across to the dial and explains it. Clicking him does not open a
panel; he tells you to get back to the game.

His pace and his size are `/fun`'s exactly - `FPS = 12`, `HEIGHT = 72` - so
his stride and cadence match the Gary on the other page rather than merely
looking similar. **Never raise the translate duration on its own.** Speed is
stride over cycle; change one without the other and his feet slide.

That pace is what dictates where he stands. At 12fps he covers ~60px a
second, so an earlier version that had him crossing the whole page took
eighteen seconds. His two stations were pulled together until the walk was
sensible: about 320px and 5.3s at 1600x1000, 360px and 6.0s at 1920x1080,
200px and 3.3s at 1366x768. The distance is snapped to a whole number of
strides, so he finishes on a planted foot rather than mid-air.

Two things that look like mistakes and are not:

- **He does not stand next to the coin, he calls across to it** from centre
  stage under the screen. Standing beside it would put the walk back over
  fifteen seconds. The coin glows and is labelled; the dial is the control
  that actually needs someone next to it, which is where he ends up.
- **He is mounted inside `.bezel`, not fixed to the viewport.** Fixed to the
  bottom of the window he hung below the cabinet with the bezel's border
  cutting through his torso, and on short viewports where the bezel floats
  mid-column he ended up ~100px beneath it. Absolute inside the bezel, his
  feet sit on its bottom edge at any size, and his x is in bezel coordinates.

His bubble sits beside him rather than above. A 72px figure standing in the
92px chin of the bezel leaves no room overhead without the bubble landing on
the glass. It flips to his other side when it would otherwise run off the
viewport.

---

## Working on it

Serve it properly rather than opening the file. `file://` gives a null origin
and Supabase refuses the POST, so scores cannot be submitted:

```
npm run build && npm start      # then http://localhost:3000/arcade
```

### Headless Chrome cannot test the games

**`performance.now()` does not advance under `--virtual-time-budget`, so the
game loop does not run.** Thirty simulated seconds of Asteroids produced a
score of 0 and no saucers. CSS transitions freeze the same way, which is why
the dial's tick highlight reads as inverted in a headless screenshot and is
correct in a browser. Add `--force-prefers-reduced-motion` when screenshotting
so transitions are skipped rather than frozen mid-way.

Game logic is tested in Node instead, by stubbing `requestAnimationFrame` and
stepping the real loop a frame at a time. That is how one-press-one-shot, the
four-bullet cap, saucer spawning and hyperspace's failure rate were actually
verified. DOM behaviour - the mark cycle, the dial, the flag buttons - tests
fine in headless, because it does not need the clock.

---

## The phone

Built 2026-09-08, because the arcade was about to be handed round the family
and the cabinet is the wrong object on a 390px screen. The bezel, the dial,
the coin slot and the rail are the best of this page on a desktop and they are
all overhead on a phone: by the time they have taken their share there is a
postage stamp left to play in.

On a phone the page becomes three screens instead of one.

1. **The gate.** Full screen, one coin, nothing else reachable. Same rule the
   cabinet always had, no longer competing with a leaderboard for attention.
2. **The game.** The whole viewport. While a run is going there is nothing
   else on screen at all - no HUD, no mute, no back link.
3. **The board.** A sheet over the top, opened from an icon, and only
   reachable between runs. The back link to the site lives in it.

`mobile.js` owns this and it is deliberately thin. It does not reimplement the
cabinet: it **moves the cabinet's own nodes** into the new screens - the coin
module into the gate, the rail into the sheet, the mute button up into the HUD
row - so every handler `cabinet.js` binds keeps working and the board keeps
painting into the same `<ol>` it always did. The switch-game icon clicks the
dial nobody can see any more. Load order matters: `mobile.js` runs before
`cabinet.js` so the nodes are where they belong before the cabinet queries for
them, and `cabinet.js` calls `ArcadePhone.attach()` at the end of its setup to
hand back the screen it built itself.

`?phone=1` forces the shell on a desktop and `?phone=0` forces it off. Both
are for looking at it.

### What counts as a phone

```
(pointer: coarse) and (max-width: 820px),
(pointer: coarse) and (max-height: 560px)
```

Width alone catches an iPad in portrait, and would drop a phone out of the
shell the moment it was turned on its side - 844x390 is wider than any
width-only threshold that a phone should still match. The second clause is
what keeps landscape inside the shell.

### Asteroids had to change, the other two did not

Snake and Minesweeper are square, and a square is the same shape on any
screen. Asteroids is 4:3, and letterboxed into a portrait phone it was
width-limited: everything drew at about half the scale a desktop gets and the
ship was a speck. That is most of why it was the game that felt impossible on
a phone.

So **on a touch screen the field takes the shape of the box and keeps its
area.** 800x600 becomes roughly 540x890, which is the same 480,000 square
units: the same rock density, the same room to run, the same distance a bullet
crosses before it dies. Shrinking the rocks or zooming the camera would have
changed the game; this changes the window onto it. The field is reshaped at
mount and on a rotation, and **only while nothing is flying** - the shape must
never change under a ship that is already moving. Desktop is untouched and
stays 800x600.

The pad is five keys: turn left and right under the left thumb, hyperspace,
thrust and fire under the right. Held keys capture the pointer, so a thumb
that slides off the button still delivers its `pointerup` - without that the
ship turns forever, which is the classic way a touch pad goes wrong.

**Fire stays one press one shot**, the same rule the keyboard has. The
four-bullet cap is what makes the game bite and auto-fire while held would
quietly delete it. If it reads as stiff under a thumb that is the knob to
turn, and it is a decision rather than an oversight.

### Three touch bugs that were live on every screen, not only phones

- **The attract screen ate the tap.** `.overlay[data-ov="attract"]` sits over
  `.stage` and had no `pointer-events: none`, so the tap - and on a desktop
  the click - that every game reads as "start" never reached the game. Only
  the keyboard worked. Fixed for every pointer, not just touch.
- **A swipe in Snake scrolled the page** at the same time as it turned the
  snake. `touch-action: none` on the stage and the canvas.
- **A long press in Minesweeper raised the selection callout** on top of the
  flag it had just planted, and quick tapping double-tap-zoomed the board.
  `-webkit-touch-callout: none` and `touch-action: manipulation` on the cells.

`PRESS R TO PLAY AGAIN` is a real button now rather than a line of text, so a
thumb has something to press. It still says the R key on a desktop.

### The HUD is at the top centre, and that is not an accident

The two icons started in the bottom corners, where a thumb wants them. That
put switch-game directly on top of Asteroids' turn-left key in portrait and
on the fire key in landscape: a button that changes game when you meant to
steer. The status line owns the top left and right, so the top centre is the
one place nothing else wants. The HUD is only ever up between runs, so the
stretch costs nothing. `scripts/dev/phone-audit.mjs` asserts the two never
overlap, in both orientations.

### Checking it

```
npm run dev -- --port 3011
URL=http://localhost:3011 OUT=shots node scripts/dev/phone-audit.mjs
```

Emulates an iPhone with `isMobile` and `hasTouch` set - which is what makes
`pointer: coarse` match - walks the gate, all three games, the pad and the
sheet, and saves a shot of each. Twenty-five assertions, and the ones that
earn their keep are the geometric ones: the Minesweeper board fitting inside
the glass, and the HUD clearing the thumb pad. Both of those were broken when
they were first written, and neither is visible in a passing screenshot
without looking at it.

### Still not done

- **Only Snake has been played on a real phone** (2026-09-08, and it holds up:
  gate, full-screen run and swipe). Minesweeper and Asteroids are still
  emulated Chromium at two viewport sizes, and `100dvh`, the safe-area insets,
  `backdrop-filter` on the HUD buttons and whether WebAudio comes through the
  ringer switch are all unverified on a device.
- **Snake does not fill the screen** and is not meant to: a 24x24 grid is
  square, so it takes the width and centres. The dead space above and below is
  the cost of not reshaping a grid whose scores are on a shared board.
- **Mute is only reachable between runs**, since it lives in the HUD now. That
  follows from the rule that a run owns the whole screen, and it may be the
  wrong trade.

---

## Decided against

- **Porting the page into the app router.** See the top of this file.
- **Making Snake authentic.** There is no original to be authentic to, and the
  arcade one is a different game.
- **Whole-second Minesweeper timing.** It would manufacture ties on a
  leaderboard that ranks on time.
- **A smiley button and LED counters for Minesweeper.** Recognisable, but they
  fight the cabinet the rest of the page is committed to.
- **A separate `/arcade/phone` route.** One document, one set of games, one
  leaderboard. The phone shell is a skin over the same cabinet, and the day
  they diverge is the day one of them starts rotting.
- **Auto-fire while the fire key is held.** See above: the four-bullet cap is
  the game.
