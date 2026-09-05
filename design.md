# Design System — Patrick Neyland Personal Site

**Read this before writing any UI code.**

The aesthetic direction is: **editorial dark minimalism with warmth** — inspired by garysheng.com's dark tech aesthetic, but warmer and more human. Patrick bridges two worlds (academic/finance and applied AI), and the design should feel like a serious person who is also approachable.

---

## Aesthetic Direction

- **Tone**: Refined dark. Not cold or corporate — warm, intentional, human.
- **What makes it unforgettable**: The story *moves*. Blur-fade reveals pace the narrative. The reader feels like they're uncovering something, not scanning a resume.
- **One rule**: Every design choice must serve the story. No decoration for decoration's sake.

---

## Color Palette

**Faded Sign**, set 2026-09-05, replacing the warm gold on cool neutrals. Chosen from a
four-option study after an earlier batch of four was rejected; the study is in pat_agent at
`output/pat-site-palettes.html`.

Two rules hold it together and neither is negotiable:

1. **The ground is achromatic.** R = G = B on every ground, surface and border value, in both
   modes. Gary is a pure white alpha mask and the reason `/fun` works is that he sits on a ground
   with no colour in it. A tinted ground puts a hue behind him and he stops being ink.
2. **The ground is near, not pure.** `#121212` rather than `#000`, because a chalky pastel on pure
   black has no shared substrate and the edges shimmer. `#F7F7F7` rather than `#fff` inverted.

The values live in `src/app/globals.css` and are not repeated here, because a palette written down
twice is a palette that drifts. Read them there. What this file records is why they are shaped the
way they are.

### The site has two modes now

Dark is the default because the site was built dark and the black ground is the thing Patrick likes
about `/fun`. Light is reachable two ways: the OS setting, or **the toggle**, added 2026-09-05.
Sun and moon only, showing the mode a click will give you. It sits in the nav, and again in the
bottom corner of the `/fun` card next to the arcade joystick, because `Nav` renders nothing on
`/fun` and a visitor who never leaves that page would otherwise have no way out of the mode their
OS put them in.

The toggle is mostly an escape hatch rather than a way to choose light. Dark is the stronger of the
two palettes and the one the site was designed in; following the OS alone meant a visitor whose
machine says light landed in the weaker version with no way out.

Two things follow from how it is built, and both matter if you touch the palette:

- **`globals.css` has no `prefers-color-scheme` query, on purpose.** An inline script in
  `layout.tsx` reads the OS setting and stamps `data-theme` on `<html>` before first paint, so the
  CSS only ever describes two states and the light palette is written down once. A media query as
  well would mean the same fifteen values in two blocks, and they would drift. The cost is that
  with JavaScript off nobody reaches light mode, which is a safe way to fail.
- **Dark is the default, and the OS is not consulted.** Patrick, 2026-09-05: "I want the default
  to be dark, not computer." Dark is the palette the site was built in and light is the compromise
  version, so nobody gets dropped into it by a setting they made for a different reason.
- **Nothing is stored.** A click holds while you move around the site, since App Router navigation
  leaves the document and its stamp alone, and a hard reload puts you back on dark. Do not add
  `localStorage` or a `prefers-color-scheme` read back without asking.

Two pages opt out completely and must stay that way: `/` boring mode is hardcoded white, black
Times and `#0000ee` and reads no token here, and the arcade is a separate document in
`public/arcade/` with its own reset and its own `color-scheme: dark`. The stamp never reaches it.
Patrick's instruction, 2026-09-05: the arcade stays how it is no matter what.

The hue angles hold across the two modes and the mood does not: faded coral becomes brick,
bleached wheat becomes ochre, powder blue becomes dusty teal, sage becomes moss. That is inherent
to pastels, which have nowhere to go on white except down into earth. It is a known cost, not a
bug.

### On-paper hues, the thing that is easy to get wrong

`/fun`'s card is a white sheet and `/story`'s polaroids are cream, **in both modes**. Those
surfaces are objects, not backgrounds, so they do not invert with the site. Anything drawn on them
needs the light-mode value even while the site is dark. `--hue-fun-paper` exists for exactly this:
painting `/fun`'s link with `--hue-fun` puts a pastel coral on white at about 1.8:1.

### The districts

Each page still gets its own hue, and the nav still works as a legend. What changed is that the
four hues are now drawn from one family instead of being four unrelated choices, and they are CSS
custom properties (`--hue-fun`, `--hue-story`, `--hue-portfolio`, `--hue-garden`) rather than hex
in TypeScript, because a hue that reads on `#121212` does not read on `#F7F7F7`.

Garden is `#b8ce93` and not the sage the palette study specified. Against the portfolio's powder
blue at the 0.7rem the nav sets its labels, the study's sage was a second grey. Dropping its chroma
and lifting its hue opens the gap. This is rule 2 of `lib/sections.ts` doing its job.

### Tailwind Token Mapping

In `tailwind.config.ts`, map these as:

| Token | CSS Var | Usage |
|---|---|---|
| `bg-bg` | `--bg` | Page background |
| `bg-bg-alt` | `--bg-alt` | Alternating sections |
| `bg-bg-card` | `--bg-card` | Cards, project panels |
| `text-ink` | `--text` | Body text |
| `text-muted` | `--text-muted` | Captions, metadata |
| `text-faint` | `--text-faint` | Dividers, disabled |
| `text-accent` | `--accent` | Highlighted text, links |
| `bg-accent` | `--accent` | Accent buttons |
| `border-edge` | `--border` | Card borders |

---

## Typography

### Font Pairing

| Role | Font | Source | Class |
|---|---|---|---|
| Display / Hero | **Playfair Display** | Google Fonts | `font-display` |
| Heading | **DM Sans** | Google Fonts | `font-heading` |
| Body | **DM Sans** | Google Fonts | `font-body` |
| Mono / Code | **JetBrains Mono** | Google Fonts | `font-mono` |

**Why Playfair Display for hero**: It carries editorial authority — it's the font of serious publications. Combined with a modern sans, it creates tension between "established" (accounting, academia) and "forward" (AI). That tension *is* Patrick's story.

### Type Scale

```css
/* Display — hero name, major statement */
.text-display {
  font-family: var(--font-display);
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.02em;
}

/* Heading 1 — section titles */
.text-h1 {
  font-size: clamp(1.75rem, 4vw, 3rem);
  font-weight: 600;
  line-height: 1.1;
}

/* Heading 2 — subsections */
.text-h2 {
  font-size: clamp(1.25rem, 2.5vw, 1.75rem);
  font-weight: 500;
  line-height: 1.25;
}

/* Body — narrative text */
.text-body {
  font-size: 1.0625rem;   /* 17px */
  line-height: 1.75;
  font-weight: 400;
}

/* Caption / metadata */
.text-caption {
  font-size: 0.8125rem;   /* 13px */
  line-height: 1.5;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
```

---

## Spacing & Layout

```css
/* Section vertical padding */
.section-padding       { padding: 6rem 0; }
.section-padding-hero  { padding: 8rem 0 6rem; }

/* Content containers */
.container        { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
.container-narrow { max-width: 680px;  margin: 0 auto; padding: 0 1.5rem; }
.container-wide   { max-width: 1400px; margin: 0 auto; padding: 0 1.5rem; }
```

---

## Animations

All reveals use **blur-fade**: elements start `opacity: 0; filter: blur(4px)` and animate to visible. Stagger by 100–150ms.

```ts
// BlurFade component props
interface BlurFadeProps {
  delay?: number;    // stagger offset in ms
  duration?: number; // default 600ms
  blur?: string;     // default "4px"
}
```

Scroll-triggered: use Framer Motion `whileInView` with `once: true`.

Hover states on cards: subtle `translateY(-2px)` + border brightens to `--accent-dim`.

---

## Component Patterns

### Hero Section
- Full-viewport height or near it
- Name in `.text-display` / `font-display` — very large
- One-line mission statement below in `font-heading`
- Subtle radial gradient glow behind name (accent color, very low opacity)
- Blur-fade stagger: name → tagline → CTA

### Story Section
- Narrow container (680px max)
- Chapter-style: each beat of the story is a numbered or dated marker
- Left accent bar (2px, gold) on each chapter block
- Body copy at comfortable reading width

### Project Cards
- Dark card surface (`bg-card`)
- Tag in `.text-caption` for category (e.g., "AI Implementation")
- Title in `font-heading`
- Short description in `font-body`
- Link to live demo or Neyland Solutions service page
- Hover: border accent + slight lift

### Neyland Solutions CTA
- Full-width band, slightly lighter bg (`bg-alt`)
- Large centered heading
- Body copy bridging personal → company
- Single button: link to neylandsolutions.com

### Contact / Footer
- Minimal: email, LinkedIn, GitHub
- Neyland Solutions link
- Copyright

---

## Icons

Use `lucide-react` only. Always `strokeWidth={1.5}`. Size: `16` for inline, `20` for standalone.

One exception, and it should stay the only one: `AtariJoystick.tsx`, the arcade's mark in the nav
and on the `/fun` card. Lucide has `Gamepad2`, which is an Xbox pad and forty years wrong for that
page, and `Joystick`, which is a generic stick on a flat base. The CX40 is a specific object and
its single corner button is the whole tell. It is drawn on lucide's own 24x24 grid at the same
stroke weight so it sits level with the icons beside it. Draw the next one only if a real object
is being depicted; reach for lucide for anything that is a UI control.

---

## What to Avoid

- No purple gradients
- No glassmorphism / backdrop blur cards
- No Inter or Roboto for body text
- No drop shadows on cards (use border instead)
- No decorative elements that don't serve the narrative
- No stock illustrations or generic icons

---

## Per-Page Visual Worlds

**This section overrides the single-palette rule above.** Patrick wants sections of the site to
look dramatically different from one another, as a way of showing his interest in design. That is
a deliberate departure, not drift. Do not flatten the pages back to one look.

### The rule: vary the skin, never the skeleton

Every page shares:

- The dark ground, so moving between pages is a hue shift rather than a mode shift
- The nav (`src/components/ui/Nav.tsx`), same position, same treatment
- The type scale and the four font variables from `layout.tsx`
- `BlurFade` as the only reveal motion, staggered 0.06 to 0.1

Each page may define its own palette and texture, and nothing else.

### How a world is declared

One local constant at the top of the page's component file. Never in `globals.css`, because a
page-specific colour in the global sheet is how the worlds start bleeding into each other.

```ts
/* The garden world. */
const G = {
  ground: "#101a13",
  ink: "#e0e9d9",
  inkSoft: "#8fa286",
  accent: "#9ecb7e",
  edge: "rgba(158,203,126,0.2)",
  edgeHot: "rgba(158,203,126,0.55)",
};
```

Where a world spans more than one route, put the constant in its own module and import it. See
`src/components/sections/gardenTheme.ts`, shared by the plot and the reading pages.

Give any page world a `minHeight: 100vh`. Short pages otherwise let the global background show
below the world, which reads as a rendering bug.

### Current worlds

| Route | World |
|---|---|
| `/` | Boring mode. Hardcoded white, black Times and `#0000ee`. Reads no token here and must not |
| `/fun` | One white card on the achromatic ground. Faded coral, brick on paper |
| `/story` | Paper and polaroid collage, hand-drawn arrow connectors. Bleached wheat |
| `/portfolio` | Powder blue, dusty teal in light |
| `/garden` | Sage, moss in light. The greenhouse was cut 2026-09-04; the hue is all that tells it apart |
| `/arcade` | A standalone document in `public/arcade/` with its own reset. Off the system on purpose |
| `/portfolio/woodworking` | Workshop. Not built yet |

**Cohesion beat separation, 2026-09-05.** Patrick asked for the four designed pages to read as one
place: `/portfolio` and `/garden` felt AI generated and `/fun` and `/story` had a palette he did
not like. The neutrals are now global and identical on all four and the districts differ only by
hue. `docs/refinement.md` section 0 argues via Lynch that districts are more legible when they look
nothing alike, and that is a real cost being paid deliberately: the wayfinding is carried by the
nav legend, which survives. Colour was never the problem on `/portfolio` and `/garden` anyway. That
is a structural problem and it is still open.

### Direction still open

The eventual visual language is **hand drawing**, not technical drafting. A blueprint direction
was explored and rejected. The language already exists in `Story.tsx`, which has a working system
of named frames, computed hand-drawn arrow paths, and a separate edge set for narrow screens.
Extend that rather than inventing something new.

**The hard constraint: the drawing is the frame, never the content.** Drawn elements are borders,
arrows, annotations, and marginalia. Titles and body copy stay in real type at real sizes. This
site has to keep working as a portfolio.

Still undecided: how much wobble, whether Patrick draws on paper or iPad, and whether to replace
Caveat with his own handwriting via Calligraphr.

### The handwriting belongs to Gary

Set 2026-09-04. `--font-hand` is Gary's voice and nothing else's. He is the only
one on this site who writes by hand, so handwriting on the page means he is
speaking.

It used to also set the story's page name, the polaroid captions and the torn
note's heading. Those moved to Playfair and to italic DM Sans, the same
photo-caption treatment `/fun` already uses. Do not reach for `--font-hand` for
a heading, a label or a caption again; if it is not Gary talking, it is not the
hand.

This also holds the font count down. The site loads five faces already
(Playfair, DM Sans, JetBrains Mono, Caveat, EB Garamond), and `/fun` alone uses
four of them. The next typographic decision here should subtract, not add. When
Patrick's own handwriting arrives it replaces Caveat rather than joining it.
