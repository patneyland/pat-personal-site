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
├── design.md              ← design system rules, including per-page worlds
├── content/               ← ALL page content. Patrick edits these, not code.
│   ├── README.md          ← frontmatter formats, written for Patrick
│   ├── resume.md          ← the ENTIRE front page at /
│   ├── portfolio/*.md     ← one file per portfolio tile
│   └── garden/*.md        ← one file per garden entry
├── src/
│   ├── app/
│   │   ├── page.tsx       ← renders Boring (the plain resume)
│   │   ├── fun/           ← the designed home
│   │   ├── story/ portfolio/ garden/
│   │   └── globals.css
│   ├── components/
│   │   ├── sections/      ← Boring, Hero, Story, Portfolio, Garden, Woodworking
│   │   └── ui/            ← BlurFade, Nav
│   └── lib/               ← portfolio.ts, garden.ts (markdown readers)
├── public/assets/         ← the ONLY assets folder the site serves
│   ├── headshot.png       slideshow/  story/  portfolio/
├── scripts/thumbnails.mjs ← npm run thumbnails
└── next.config.ts         ← redirects for retired routes
```

## Pages

Live at https://www.patrickneyland.com.

| Route | What it is |
|---|---|
| `/` | **Boring mode.** A plain resume: Times, black on white, ruled section heads, no nav, no animation. The whole page is `content/resume.md`. It opens with a note inviting you to the designed version. **The plainness is the point. Do not style this page.** |
| `/fun` | The designed home. Photo left, bio and three links right. Sized to fit one screen. |
| `/story` | The polaroid collage. Patrick likes it. **Do not touch it.** |
| `/portfolio` | Tiles from `content/portfolio/`. |
| `/portfolio/woodworking` | Live but has no photos yet. |
| `/garden` | Works in progress from `content/garden/`, marked seed / sprout / growing / ripe. |

`/boring`, `/cool-stuff`, and `/woodworking` redirect to their new homes.

**Each page owns its own palette** (see design.md). The shared parts are the dark ground, the type
scale, `BlurFade`, and `Nav`. Do not flatten the site back to one look.

## Content

**Adding or changing anything on the site means editing a markdown file, not code.** Patrick does
this through the GitHub web UI; Vercel rebuilds on push. `content/README.md` documents every field.

- Only `title` is required. A link with a thumbnail is a complete portfolio entry, and a one
  sentence seed is a complete garden entry. Never imply an entry is unfinished.
- `draft: true` hides an entry without deleting it.
- Raw HTML works inside these markdown files (`sanitize: false` is passed to remark-html). Leave a
  blank line after an opening tag and before the closing one and markdown inside still parses.
- `npm run thumbnails` screenshots any portfolio entry that has a public link.

## Copy & Voice Rules

> **Claude does not write copy for this site.**
>
> Patrick, 2026-08-23: *"I don't want you to write anything. I want the content on this site to be
> 1000% me."* He declined a drafts-and-reacts workflow.
>
> Build structure, layout, and plumbing. When a section needs words, **leave the slot empty and ask
> him**. Do not fill gaps with drafts, sample sentences, or placeholder copy, because placeholders
> ship. This is narrower than general writing help: commit messages, code comments, and analysis
> are still welcome.
>
> Some copy on the live site was written by Claude before this rule existed (portfolio blurbs for
> Tank Wars, Trivia and Woodworking; the second paragraph of the CPA-bench garden entry; the
> Portfolio and Garden section headings and intro lines; the woodworking page paragraph). Patrick
> plans to replace it. Do not add more.

The rules below apply to anything Claude does write, and to editing Patrick's own text.

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
- **Verify in a browser before claiming something works.** A stale `next start` will happily serve
  an old build and make a correct change look broken. Kill the port first, and if a process will
  not die, serve on a different port rather than fighting it.
- **The repo is public.** Patrick's phone number, personal gmail, and home city must never appear
  in it. His resume PDF is excluded by `*.pdf` in `.gitignore`. Scan for all three before any push.
- Ask before pushing, and before deploying to production.
- Commit messages: short, present tense, descriptive (`add hero section`, `update story copy`).
- Do not push to GitHub without Patrick's explicit instruction.

## Assets Needed (Patrick to provide)

- [ ] Headshot (professional or candid — both welcome)
- [ ] Neyland Solutions logo (white version preferred for dark bg)
- [ ] Any project screenshots or demos to showcase
- [ ] Optional: Arizona DOR or academic context photos
