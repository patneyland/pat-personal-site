# The house on /fun

**Branch: `house-on-fun`. Committed, not pushed, not merged.**

The first thing built through `drawing-to-geometry.md`. Read that file first:
it holds the schedule, and every number in `House.tsx` comes from it.

---

## How to see it

```
git checkout house-on-fun
npm run dev
```

Then open `/fun`. The house stands on the left of the white card's top edge,
which is the same ground line Gary's feet use. Wait about twelve seconds for his
greeting to drift away and he paces across the front of it.

Verified in Chromium at 1440 x 920: the page renders, no console errors,
`npm run build` passes.

---

## What is on the branch

| File | Change |
|---|---|
| `src/components/ui/House.tsx` | new. The house, as inline SVG |
| `src/components/sections/Hero.tsx` | two lines: the import, and `<House />` above `<GaryPacing />` |
| `docs/drawing-to-geometry.md` | new. The method and the schedule |

Removing it is deleting the component and those two lines. Nothing else in the
page knows it exists.

---

## The two decisions that are not in the schedule

**Where it stands.** `left: "7%"` of the card. Chosen by eye, and it is a prop.

**How its line is inked.** `PEN = 0.27u`, not the 0.19u to 0.23u his sprite
measures. The two are the same weight on screen: an antialiased SVG stroke reads
thinner than the sprite's hard edged ink at the same nominal width, so the pen
was raised until both sampled at 3.5 CSS px in the same screenshot. If Gary's
sprite is ever redrawn, re-measure rather than trusting 0.27.

Everything else, including the 177 x 202 size, follows from the schedule and
from `GARY_HEIGHT`.

---

## The one open problem

**He disappears when he walks across the front of it.**

Gary is white line art. So is the house, now at his exact weight, on the same
near-black ground. For the two or three seconds per lap where he crosses the
door, his head and body outlines merge into the window mullions and he stops
reading as a separate figure. The screenshots that show this are in the artifact
from the session that built it.

This is a value problem, not a geometry problem, and there are three ways out:

1. **Push the house back.** `<House ink="rgba(255,255,255,0.42)" />`. One prop,
   already supported, and it works: verified. Cost is that the house then reads
   lighter than Gary, which is the thing Patrick asked to stop.
2. **Give Gary a halo.** Draw him over a slightly wider knockout of the ground
   colour so he always cuts a silhouette out of whatever is behind him. Keeps
   both at full weight. Costs a second sprite layer or a CSS filter.
3. **Move the house out of his path.** Stand it far enough left that he turns
   around before he reaches it, or put it past the end of his track.

Not decided. Patrick has seen 1 and asked for full weight instead, so 2 and 3
are the live options.

---

## Things worth knowing before changing it

- **The house cannot live inside Gary's track.** `GaryPacing` renders a strip
  that is `height: 72px` with `overflow: hidden`, so anything taller than him is
  cut off at his crown. `House` is a sibling behind that strip inside the same
  wrapper, which is what lets it share the baseline without touching how he
  walks.
- **`GARY_HEIGHT` is duplicated** in `House.tsx` and `GaryPacing.tsx`. If his
  display height changes, both need it. That duplication is deliberate rather
  than a shared constant only because the two files have no other reason to be
  coupled; a shared constant would be an improvement, not a regression.
- **The house is `aria-hidden` and `pointerEvents: none`.** It is scenery. It
  must never sit between a reader and Gary's click target.
- **Nothing about it is responsive.** It is a fixed 177 x 202 px at every card
  width, because it is sized off Gary and he is a fixed height too. On a narrow
  phone the card is much smaller than the house is wide. Untested below about
  700px, and that is the first thing to check.

---

## Not done

- Never opened on a phone. See above.
- Not checked against the greeting bubble, which draws over the same area in the
  first ten seconds. In the session's screenshots it covered the roof.
- Nobody has decided whether the house belongs on `/fun` at all, or whether it
  is the first piece of the larger landscape and should wait for that.
