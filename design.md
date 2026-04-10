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

```css
:root {
  /* Backgrounds */
  --bg:         #0e0e0e;   /* near-black, slightly warm */
  --bg-alt:     #161616;   /* subtle section separator */
  --bg-card:    #1c1c1c;   /* card/panel surfaces */

  /* Text */
  --text:       #e8e2d9;   /* warm off-white — not harsh */
  --text-muted: #7a7570;   /* secondary / captions */
  --text-faint: #3d3a38;   /* dividers, disabled */

  /* Accent — amber/gold */
  /* Chosen to echo Patrick's finance/accounting roots, now electrified */
  --accent:     #c9a84c;   /* primary accent: warm gold */
  --accent-dim: #7a6330;   /* muted gold for subtle touches */
  --accent-glow: rgba(201, 168, 76, 0.08); /* background glow */

  /* Borders */
  --border:     #2a2826;
  --border-subtle: #1e1c1a;
}
```

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

---

## What to Avoid

- No purple gradients
- No glassmorphism / backdrop blur cards
- No Inter or Roboto for body text
- No drop shadows on cards (use border instead)
- No decorative elements that don't serve the narrative
- No stock illustrations or generic icons
