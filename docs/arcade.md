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

Two things that look like mistakes and are not:

- He steps at **24fps**, double the 12 he paces at on `/fun`. Speed is stride
  over cycle, so crossing the page at 12 took fifteen seconds. Never raise the
  translate duration on its own or his feet slide.
- He stands clear of the back link rather than beside the coin plate, because
  the link sits directly under the coin and he was standing on it.

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

## Decided against

- **Porting the page into the app router.** See the top of this file.
- **Making Snake authentic.** There is no original to be authentic to, and the
  arcade one is a different game.
- **Whole-second Minesweeper timing.** It would manufacture ties on a
  leaderboard that ranks on time.
- **A smiley button and LED counters for Minesweeper.** Recognisable, but they
  fight the cabinet the rest of the page is committed to.
