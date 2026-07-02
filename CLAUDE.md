# Patrick Neyland — Personal Site

This is a collaborative workspace between Patrick and Claude. Read this file at the start of every session before touching any code.

---

## Project Purpose

A personal website for **Patrick Neyland** — AI leader, founder of [Neyland Solutions](https://neylandsolutions.com), and former accounting/financial economics academic who pivoted to applied AI consulting.

The site tells Patrick's story. It is not a resume or a portfolio dump. It is a narrative about how an accounting student got hooked on AI and decided to help the institutions that can't figure it out themselves.

## Patrick's Story (source of truth for all copy)

1. **Accounting undergrad** — started in traditional finance/accounting track
2. **Master's in Financial Economics** — halfway through, ChatGPT launched. Got hooked immediately.
3. **PhD in Accounting** — wanted to research AI's effect on the accounting profession. Hit a wall: not enough data yet, AI is too new.
4. **Arizona Department of Revenue encounter** — working with them, asked how they were using AI. Answer: "We don't have bandwidth." Realized the gap: institutions *want* AI but can't navigate it alone.
5. **Founded Neyland Solutions** — to help companies and institutions implement AI so they can do better work. Pragmatic, not theoretical.

## Positioning

- AI leader who bridges **traditional professional disciplines** and **applied AI**
- Not a researcher — a builder and implementer
- Target audience on this personal site: peers, collaborators, potential clients, press
- Links to [neylandsolutions.com](https://neylandsolutions.com) as the company arm

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Same as Gary Sheng's site; great for Vercel |
| Styling | Tailwind CSS | Works with design tokens in design.md |
| Animations | Framer Motion | Blur-fade reveals, scroll triggers |
| Icons | lucide-react | Consistent, clean |
| Deployment | Vercel | Hosting |
| Code | GitHub | Source control |

## Design Reference

See `design.md` for all color tokens, typography rules, and component patterns.
**Always read `design.md` before writing any UI code.**

The aesthetic inspiration is [garysheng.com](https://www.garysheng.com/):
- Dark, intentional, story-driven
- Large bold type for impact
- Blur-fade progressive reveals
- Minimal distractions — let the narrative breathe

## File Structure

```
pat-personal-site/
├── CLAUDE.md              ← you are here
├── design.md              ← design system rules
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx       ← single-page story
│   │   └── globals.css
│   └── components/
│       ├── sections/      ← Hero, Story, Projects, CTA, Contact
│       └── ui/            ← reusable primitives (BlurFade, etc.)
├── public/
│   └── assets/            ← logos, photos (Patrick adds these; the ONLY assets folder the site serves)
│       ├── slideshow/     ← Hero slideshow photos
│       └── story/         ← Journey/story page photos
└── tailwind.config.ts
```

## Sections (Page Flow)

1. **Hero** — Name, one-line mission, subtle animated background
2. **Story** — Narrative arc: accounting → econ → ChatGPT → PhD → DOR encounter → Neyland Solutions
3. **Projects / Built** — 3–5 things Patrick has built that demonstrate AI in practice
4. **Neyland Solutions CTA** — Bridge to the company; explains how to work together
5. **Contact / Connect** — Simple, low-friction

## Copy & Voice Rules

**Full prohibition list is in `ai-writing-detection.md`. Read it before writing any copy.**

The short version:

- **No em dashes.** Use commas for parentheticals, colons to introduce lists or explanations, parentheses for supplementary info. If you use even one em dash, revise.
- **No "leverage"** as a verb. Say "use," "apply," or describe the actual impact.
- **No AI verbs:** delve, utilize, facilitate, foster, bolster, underscore, streamline, enhance, navigate.
- **No AI adjectives:** robust, comprehensive, pivotal, transformative, cutting-edge, seamless, holistic.
- **No filler intensifiers:** truly, ultimately, essentially, fundamentally, incredibly, really, very.
- **No AI opening phrases:** "In today's...", "In an era of...", "It's worth noting that..."
- **No AI structure:** "It's not just X, it's also Y", "By doing X, you can Y", "Whether you're a X, Y, or Z..."
- Read every sentence aloud. If it sounds unnatural in speech, rewrite it.

## Collaboration Rules

- Do not add features not requested. Stick to what Patrick asks.
- When Patrick provides new content (copy, images), place images in `public/assets/` and update the relevant section files. Next.js only serves files from `public/`, so images must live there to appear on the site.
- Always check `design.md` before proposing any color, font, or spacing choice.
- When Patrick approves a section, mark it ready for build.
- Commit messages: short, present tense, descriptive (`add hero section`, `update story copy`).
- Do not push to GitHub without Patrick's explicit instruction.

## Assets Needed (Patrick to provide)

- [ ] Headshot (professional or candid — both welcome)
- [ ] Neyland Solutions logo (white version preferred for dark bg)
- [ ] Any project screenshots or demos to showcase
- [ ] Optional: Arizona DOR or academic context photos
