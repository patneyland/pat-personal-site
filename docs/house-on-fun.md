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

Then open `/fun`. The house stands at the right end of the white card's top
edge, which is the same ground line Gary's feet use. Wait about twelve seconds for his
greeting to drift away and he paces across the front of it.

Verified in Chromium at 1440 x 920: the page renders, no console errors,
`npm run build` passes.

---

## What is on the branch

| File | Change |
|---|---|
| `src/components/ui/House.tsx` | new. The house, as inline SVG |
| `src/components/sections/Hero.tsx` | two lines: the import, and `<House />` above `<GaryPacing />` |
| `src/components/ui/GaryPacing.tsx` | one background layer added under each of his two sprites |
| `scripts/dev/make-solid.mjs` | new. Builds the knockout sheets |
| `public/assets/gary-*-solid.png` | new. Generated, committed |
| `docs/drawing-to-geometry.md` | new. The method and the schedule |

Removing the house is deleting the component and those two lines. The knockout
in `GaryPacing` is worth keeping either way: it costs 4KB and it is what will
let anything else stand behind him later.

---

## The two decisions that are not in the schedule

**Where it stands.** `right: "6%"` of the card, at the far end of his walk.
Chosen by eye, and it is a prop.

**How big it is.** `SCALE = 0.88`, so it stands at 2.5 times Gary rather than
the 2.8 the drawing gives. Also by eye. Set SCALE to 1 for the drawing's own
proportion.

**How its line is inked.** `PEN = 0.27u`, not the 0.19u to 0.23u his sprite
measures. The two are the same weight on screen: an antialiased SVG stroke reads
thinner than the sprite's hard edged ink at the same nominal width, so the pen
was raised until both sampled at 3.5 CSS px in the same screenshot. If Gary's
sprite is ever redrawn, re-measure rather than trusting 0.27.

Everything else, including the resulting 156 x 178 size, follows from the
schedule, `GARY_HEIGHT` and `SCALE`.

---

## How he stays in front of it

He and the house are both white line art at the same weight on the same ground,
so where they cross their lines used to run straight through each other and he
stopped reading as a figure. Dimming the house fixes that and costs the house
its weight, which is not the trade Patrick wanted.

So he carries his own hole. `scripts/dev/make-solid.mjs` writes a second sheet
of him filled solid in the ground colour, and `GaryPacing` draws it as a
background layer underneath his sprite on the same element. One
`background-position` drives both layers, so `gary-step` keeps them in register
and none of the walk logic changed.

The fill is found by flooding in from the edge of each frame and keeping
whatever the flood cannot reach, which is why his head goes solid but the gaps
under his arms and between his legs stay open. That is correct: the house should
show through a gap that is genuinely open.

**The one thing to know:** `GROUND` in that script is hard coded to `#0e0e0e`,
which is `--bg`. The hole is only invisible on that ground. Putting him on a
page with a different background means regenerating the sheets, or reworking
the layer as a CSS mask so the colour comes from the page instead.

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
- **It sizes itself, since 2026-09-03.** 156 x 178, the size Gary gives it, is
  now a maximum: `W_EXPR` in `House.tsx` shrinks the whole drawing (pen
  included) on cards too narrow to hold it or to keep it clear of the greeting
  bubble, and `HOUSE_HEADROOM`, a margin `Hero.tsx` puts above the card,
  reserves the house's height so the section's overflow: hidden can never cut
  the roof off. Verified by screenshot from 320 to 2560 wide.

---

## Not done

- Never opened on a real phone. The 2026-09-03 responsive work was verified in
  emulated viewports from 320 up, greeting bubble included, but no device has
  touched it.
- Nobody has decided whether the house belongs on `/fun` at all, or whether it
  is the first piece of the larger landscape and should wait for that.
