# Editing the site without touching code

Everything on **Portfolio** and **The Garden** is a markdown file in this folder.
Add a file, commit it, and Vercel rebuilds in about a minute.

You never need a terminal. On github.com, open this folder, hit **Add file → Create new
file**, name it, paste, and commit. That works from a phone.

---

## Portfolio → `content/portfolio/`

Filename becomes the slug. `tank-wars.md`, `ms-financial-economics.md`.

```markdown
---
kind: cool                 # cool | boring
order: 4                   # lower shows first. cool 1-99, boring 101+
tag: Game                  # small label top-left of the tile
year: 2024                 # shown top-right. any text: "2024", "Ongoing", "2023 to now"
title: Tank Wars
href: https://tankwars.neylandsolutions.com/   # optional
image: /assets/portfolio/tank-wars.jpg         # optional
cta: Play it               # optional link text. defaults to "Take a look"
internal: true             # only for links inside this site, like /portfolio/woodworking
---

Everything below the dashes is the description. Optional.
```

**Every field except `title` is optional.** A link with a thumbnail and no description is a
complete entry, and the tile is laid out for that. Write a description when you have something
to say, not because a field is empty.

`kind: boring` renders the tile as cream paper and hides it until someone flips the toggle.
The `tag` on those reads "Boring, but important".

### Thumbnails

Run this locally, then commit what it produces:

```
npm run thumbnails
```

It screenshots every entry that has a public `href` and no `image` yet, saves a JPEG into
`public/assets/portfolio/`, and writes the `image:` line into the file for you. Add `--force`
to recapture ones that already have an image (run `node scripts/thumbnails.mjs --force`, since
npm swallows the flag).

Dead or slow links are skipped with a warning rather than failing the run.

Two things it will not solve. If several entries point at the same URL they get the same
screenshot, which misreads as a mistake on the grid, so give those a real image or a deeper
link. And a homepage screenshot rarely shows the actual thing you built, so a hand-taken
screenshot is almost always better.

---

## The Garden → `content/garden/`

```markdown
---
title: What institutions get wrong about AI
stage: sprout              # seed | sprout | growing | ripe
planted: 2025-03
tended: 2026-06            # sorts the plot. most recently tended first
tags: [ai, government]
external:                  # optional. a Substack URL sends the card off-site
---

Body is optional.
```

Three kinds of entry, and the difference is just whether you wrote a body:

| What you wrote | What happens |
|---|---|
| Frontmatter only | A note on the plot. The card does not link anywhere |
| Frontmatter and a body | The card links to `/garden/<slug>`, which is a reading page |
| `external:` set | The card links off-site |

**A seed with one sentence is a finished entry.** Nothing in the design implies an entry is
incomplete, and that is deliberate. The point of a garden is to show what is actually in the
ground.

Link entries to each other with `[[slug-of-other-entry]]`. It picks up that entry's title
automatically. Use `[[slug|your own words]]` to write your own link text.
