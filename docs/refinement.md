# Refining /portfolio and /garden, and the language that runs across both

Written 2026-09-04. A spec, not a change. Nothing here is built yet.

Pat's read is that both pages feel AI generated. That read is correct, and the
reason is specific enough to fix. This file says what is actually causing it,
what should be shared across the whole site instead, and the method for each
page. Research sources are at the bottom.

**Copy rule still applies.** Everything below is structure. Where an entry needs
words, the slot stays empty and Pat fills it.

---

## 0. The governing idea: districts, landmarks, paths

The question this whole file is answering: how do the portfolio, the garden, the
story and the rest each stay distinct while the site stays one place you can
move around in.

### The frame

The useful reference is not a web one. It is Kevin Lynch, *The Image of the
City*, 1960, the book that coined the word wayfinding. Lynch went around asking
people to draw their city from memory and found they all built the mental map
out of the same five parts:

| Lynch | On this site |
|---|---|
| **Districts** | Areas with their own character that you know you are inside. The portfolio, the garden, the story, fun, the arcade |
| **Paths** | The channels you move along. The nav, links, the back arrow |
| **Edges** | Where one district stops and the next starts. Here, the moment the ground colour changes |
| **Nodes** | Decision points you pass through. The front door, the nav, an index page |
| **Landmarks** | Fixed things you orient by, that look the same from anywhere. Gary, the pen, the nav |

**The answer falls out of the frame: you do not harmonize districts by making
them look alike. You harmonize them with landmarks and paths that never change
while the districts stay as different as you like.**

Lynch's point about districts is that a city is *more* legible, not less, when
its neighbourhoods look nothing like each other. What makes it navigable is that
the street signs are identical everywhere, and you can always see the same tower
over the rooftops. The variety is the information.

That is exactly the site Pat is building, and it means the "each page is its own
world" instinct was never in tension with "easy to navigate." It only became a
problem because the landmarks are weak and the edges carry no information.

### What is spine, and what is free

The mistake in `design.md` was drawing the spine too wide, so it swallowed
layout. Redraw it:

**Constant everywhere (the landmarks and paths).** A district may not touch
these:

1. The nav. Same place, same size, same behaviour, on every page
2. The page-name slot. Every section states its name in the same position, at
   the same size, in the same font. It is the one thing a reader's eye is
   allowed to look for
3. The pen. One stroke weight, one wobble, whatever is drawn
4. Motion. BlurFade on entry, same timing
5. The ground recipe. Hue plus one light plus grain, per 2.1
6. The exit. Every detail page returns to its index the same way

**Free per district.** Vary as hard as you like:

- Composition. Grid, collage, stack, list, a drawn scene
- Material and texture. Paper, glass, plain
- The repeating object. A polaroid, a tile, a bed, a line in an index
- Inhabitants. Gary, the scripture marquee, a CRT

Six constants is enough. Below that a site stops feeling like one site; above
that the districts stop being districts.

### The move that makes it work: colour is the map

Right now each section has its own palette for looks alone. Promote it to
navigation and it does two jobs at once.

**The nav already implements this system and then throws the information away.**
`Nav.tsx` marks the current section by turning that link `var(--accent)`, which
is gold, the base palette's accent. Gold on every page. So when a reader is
standing in the garden, the nav tells them where they are in a colour that
belongs to the portfolio. Four districts, one marker.

Two changes, small in code, large in effect:

1. **Each nav item wears its own section's hue, permanently.** The nav stops
   being a list of links and becomes a legend. A reader learns green means
   garden by looking at it, before ever clicking
2. **The current section's hue is what the ground shifts to.** The edge between
   districts is then announced by the same colour that marked the path. Arriving
   confirms what the nav promised

After that, "every section looks different" stops fighting navigability and
starts being the navigation. This is the highest-leverage change in this file
and it is roughly fifteen lines.

### The counterargument, which is worth being able to answer

Jakob's Law, Nielsen, 2000: people spend most of their time on other sites, so
they expect yours to work like the ones they already know. Sites with
conventional layouts measurably outperformed distinctive ones. Taken flat, that
argues against this entire site.

The resolution is that the law applies to **mechanics**, not **character**.
Where the nav sits, what a back arrow does, what a link looks like, whether the
logo goes home: break those and people suffer. What the district looks like once
they are inside it is not a mechanic. Keep every mechanic conventional and boring
and the character can be as strange as it likes.

Which is a good frame for the site generally. Familiar controls, unfamiliar
rooms.

### Where the site is genuinely weak: information scent

Separate from harmony, and the real answer to "easy to navigate."

Information foraging theory, Pirolli and Card at Xerox PARC: people choose links
the way an animal chooses where to hunt, by the strength of the cue that
something good is on the other side. Nielsen's line is the one to remember: life
is too short to click on things you do not understand.

Measured against that, the site has three real problems, all structural:

1. **Two of the five districts have no path to them.** `Nav.tsx` returns null on
   `/` and `/fun`, which are both entry points, so anyone arriving has no map.
   The front door links to exactly one place, `/fun`. Everything else is reached
   only through whatever `/fun` happens to offer
2. **The arcade has no path at all.** It lives at `public/arcade`, it is not a
   route, it is not in the nav, and nothing in `content/resume.md` links to it.
   It is a district with no street
3. **"Garden" is a low-scent label.** It is a real convention and it is the
   right name for the thing, but a reader who has not met it before cannot tell
   what is behind that link. Same, more mildly, for "Fun"

1 and 2 are worth fixing. 3 is a copy decision and therefore Pat's, and the
honest options are: keep the word and let the page explain itself in its first
line, which it already does; or give the nav a second line of scent under each
label. Do not rename it to something duller to score a point.

### The exception that proves it

`/` boring mode opts out of all six constants. No nav, no dark, no pen, Times on
white. That works precisely because it is total. A half-exempt page would read
as a bug; a fully exempt one reads as a joke, and it is the best one on the site.
Keep it absolute.

### The test

`/story` is off limits to restyle, and it should stay that way. So it is the
proof: if the collage can join the spine without being redesigned, just by
carrying the nav, the pen and the page-name slot, the system is drawn at the
right level. If joining requires changing how the story looks, the spine is
still too wide and should be cut back until it does not.

---

## 1. The diagnosis

### The two pages are one template with different hex values

Put `Portfolio.tsx` and `Garden.tsx` side by side. Both are:

1. Mono uppercase eyebrow
2. Playfair h1 at `clamp(2.4rem, 7vw, 4.25rem)`, `letter-spacing: -0.025em`
3. `display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1.25rem`
4. Bordered cards, 1px, that lift 2 to 3px and brighten their border on hover

The only structural difference in the whole of both files is `borderRadius: 3`
on a portfolio tile against `14` on a garden bed.

`design.md` says "vary the skin, never the skeleton." The rule is right but the
skeleton was drawn too wide. A card grid is not skeleton, it is a layout
decision, and when it is held constant across two pages that are supposed to be
different worlds, all the palette work in the world reads as a recolor.

**The skeleton should be: the nav, the type scale, the four font variables, the
ground recipe, and BlurFade. Layout is skin.**

### Both pages carry the documented tells

Current writing on how AI generated UI gets spotted names, in order: a uniform
row of rounded cards, a badge sitting directly above the heading, a colored
left border strip, permanent dark, and a canned page skeleton shipped as-is.

The site has four of the five:

- Uniform rounded card row on both pages
- Mono uppercase badge directly above every card title, and above every h1
- `.chapter-mark` in `globals.css` is the 2px left accent strip, called out in
  the research as the single most reliable tell. It lives on `/story`, which is
  off limits to restyle, so this is a note rather than a change. Do not repeat
  the pattern anywhere new.
- Permanent dark is a deliberate commitment here and it is fine, but it means
  everything else has to work harder.

### Portfolio specifically

- **Eight items, all the same visual weight.** Arcade-bench, tank-wars and
  trivia are not the same size of thing as the starter kit or woodworking. The
  grid asserts they are, so the page makes no argument.
- **The column count is chosen by the viewport, not by Pat.** `auto-fill` with
  a 290px floor gives three columns at 1100px and a widow row of two. No one
  decided that.
- **Optional blurbs plus `alignItems: stretch`** produce tiles padded out by a
  `flex: 1` spacer. That spacer is the layout papering over the fact that the
  entries are genuinely different in depth. Let them be different.
- **Desaturate at rest, full color on hover** is a stock gallery interaction.
  The work is the point; show it in color.

### Garden specifically

- **The four stages are invented precision.** Seed, sprout, growing and ripe
  imply a measured progression toward finished. Pat's own read, 2026-09-04:
  everything in the garden is incomplete at some random undefined point, and he
  does not actually know which entry is a sprout and which is growing. A field
  nobody can fill honestly is decoration wearing the costume of information, and
  a reader can feel that even without being able to name it. **This is the
  single biggest fake-feeling thing on the page.** See section 4.
- **The stage does nothing anyway.** All four values produce an identical card
  with a different word in it, so even taken at face value the field earns
  nothing.
- **Emoji as stage glyphs.** The seedling, herb and sunflower render as
  full-color vendor artwork inside a two-color hand-drawn world, and they change
  shape between Windows, Mac and Android. On a site whose entire visual thesis
  is Pat's own pencil line, they are borrowed art.
- **Three entries in a three-across grid** is, precisely, "three rounded cards
  in a row."
- **It is a timeline, not a topography.** Entries sort by tended date
  descending. The canonical first pattern of a digital garden is topography over
  timelines: organize by association, not by date. The machinery is already
  written and unused. `expandWikiLinks` in `lib/garden.ts` resolves `[[slug]]`,
  but nothing surfaces a link, a backlink or a tag as navigation.

---

## 2. What should transcend the sections

Five things. Each one defined once, in code, and every page draws on it. This is
the part that makes different-looking pages read as one person's site rather
than a folder of templates.

Today none of these exist as shared code. Every value is a hand-typed decimal
inside the component that uses it. That is why the pages drift.

### 2.1 A ground, not a background

One recipe, three layers, used by every world:

```
base hue  ->  one light source  ->  one grain
```

A page world changes the hue and where the light sits. Nothing else. Ship it as
a single `<World>` component taking `{ ground, light, grain }` that renders the
layers, so a new page cannot get it wrong.

The grain matters more than it sounds. Flat dark fills read as empty rectangles.
A noise overlay at roughly 5 to 15 percent opacity, generated by an SVG
`feTurbulence` filter, is what gives a dark surface perceived depth, and it is
what Linear and Vercel are doing. It also kills the banding any dark gradient
shows.

**This is depth, not scenery.** Pat ruled out depicted worlds for the garden on
2026-09-04. The light and grain here are the same treatment every page gets, at
a different hue. They do not draw moss, soil, or a greenhouse.

### 2.2 The pen

Pat already has a real one and it is written down. `docs/drawing-to-geometry.md`
sets the house's stroke weight off Gary's torso, so the ink measures the same as
the character standing next to it. That is a genuine design decision and it is
currently trapped on `/fun`.

Promote it: **one stroke weight, one wobble amount, one corner behavior, site
wide.** Every drawn frame, arrow, underline, stage mark and bracket on any page
uses it. Of everything in this document, this is the highest-identity move
available, and most of the work is already done.

`Story.tsx` has the other half: named frames and computed hand-drawn arrow
paths, with a separate edge set for narrow screens. `design.md` already says to
extend that rather than invent something new. Agreed. Extract it, do not restyle
`/story`.

### 2.3 Two labels, not five

Current mono uppercase micro-labels across the two pages, all typed by hand:

| size | tracking | where |
|---|---|---|
| 0.58rem | 0.10em | garden tags |
| 0.62rem | 0.11em | garden date, portfolio tag and year |
| 0.63rem | 0.10em | garden read-link, entry date |
| 0.66rem | 0.10em / 0.20em | portfolio cta, garden eyebrow, legend |
| 0.75rem | 0.10em | `.text-caption` |

Five sizes doing one job, none chosen relative to another. Collapse to two named
roles:

- **Eyebrow**, once per page, above the h1
- **Stamp**, for metadata on an item

Then cut how many appear. A portfolio tile currently carries three and a garden
bed four. One each is enough.

### 2.4 Motion that carries between pages

`BlurFade` on entry is right and should stay the only reveal. What is missing is
the join between pages. Right now a tile and the page it opens have no
relationship, so every navigation is a cut.

Next 15.2 ships `experimental.viewTransition` and React 19 exposes
`<ViewTransition>`. Give a portfolio tile's title and thumbnail, and a garden
bed's title, a `view-transition-name` matching the same element on the detail
page. The browser morphs one into the other. Carbon's motion guidance is exactly
this: shared elements across screens are the thing that makes a multi-page site
feel like one place.

Keep named elements under about 20 per transition, and name only what is about
to morph, or it janks.

### 2.5 A measure and a rhythm

Every margin on both pages is a bespoke decimal: 0.85, 1.35, 1.4, 1.6, 2.75,
3.5rem. Randomness at that grain is itself a tell, because a person reuses a
scale out of habit and a generator does not.

Pick one spacing scale and use it. Then take the three free typographic wins:

- `text-wrap: balance` on every heading, so no h1 drops one word alone
- `text-wrap: pretty` on body copy, for the same reason at paragraph level
- Hold the measure near 65ch on prose. `.container-narrow` at 680px is already
  close; garden prose should inherit it explicitly.

---

## 3. Portfolio: the moves

**Model it on a newspaper front page, not a gallery.** One lead story, several
smaller ones below, sizes set by importance. That is the standard editorial
answer to "many items, unequal weight," and it gives the page an argument.

1. **Hierarchy comes from content, not code.** Add `weight: lead | standard |
   minor` to portfolio frontmatter. Pat sets it in markdown, the same way he
   sets everything else about the site. Default `standard`.
2. **Lead item spans the full measure.** Thumbnail large, blurb shown, tag and
   year kept. One at a time.
3. **Standard items** in an explicit two-column grid, not `auto-fill`.
4. **Minor items become an index, not cards.** A link with a thumbnail and no
   writeup is not a card, it is a line in a list: title, year, rule, arrow. An
   index line is more editorial, more honest about the entry's depth, and it
   removes the `flex: 1` spacer problem entirely.
5. **Thumbnails in full color at rest.** Drop the saturate and brightness swap.
6. **One stamp per tile.** Tag on the lead, year on the index lines, never both.
7. **Keep the hover restrained**, and make it not-identical to the garden's.
   Currently they are the same gesture with a different border color.

The woodworking world stays unbuilt and out of scope here.

## 4. Garden: the moves

### 4.0 Two decisions Pat made on 2026-09-04

**No depicted garden.** The greenhouse is off. No moss, no soil, no shafts of
overhead light, no illustrated place. The garden survives as a name, a hue, and
a few small icons. Everything else on the page is the site's ordinary treatment.

This overrides the `/garden` row in the "Current worlds" table in `design.md`,
which currently reads "Greenhouse: moss ground, soft overhead light, handwritten
stage labels." Update that row when this ships, or the doc keeps commissioning
work Pat does not want.

Worth saying plainly, because it is a design principle and not just a
preference: a page that names itself after a place and then does not draw the
place is fine. A page that describes the place in its own design doc and then
half-draws it is not. Pick one. Pat picked the first.

**The four stages go.** Seed, sprout, growing and ripe are a taxonomy nobody can
fill in honestly, including their author. See section 1.

### 4.1 What replaces the stages

The rule for the replacement: **only signals that are true without a judgment
call.** If Pat has to decide which bucket an entry is in, it will be wrong
within a month and it will read as invented, which is exactly the current
problem.

Two things about a garden entry are already true and already in the repo, with
nobody deciding anything:

1. **Is there anything written yet.** `lib/garden.ts` already computes this:
   `body` is null when the file is frontmatter only. The page already behaves
   differently, a bodyless entry does not link anywhere, it just is not shown.
2. **When it was last touched.** `tended`, already in frontmatter, already the
   sort key.

So: drop the `stage` field, drop `STAGES`, drop `STAGE_META`, and let the page
show two kinds of thing.

- **A note.** Something is written. It links. Title, what it is about, when it
  was last touched.
- **A line.** Just a title so far. It does not link. Set smaller and quieter, in
  a list under the notes.

Both get an icon per 4.2. Neither gets a label saying which it is, because the
difference is already visible: one is a block you can click, the other is a line
you cannot.

The honesty that the four stages were reaching for is already carried by the
page's own eyebrow, which says nothing here is finished. Said once, at the top,
in Pat's words, it does the job that four fake gradations were failing to do.

**Migration:** three entries, so this is a hand edit. Delete the `stage:` line
from each of `better-automated-smoker.md`, `cpa-bench.md` and `picking-a-model.md`.

**If Pat wants a status signal after all**, the honest form is a sentence he
writes per entry, not a bucket he picks from a list. Something like a one-line
note on how sure he is or what is still missing. Add the frontmatter field, ship
the slot empty, and let entries carry it only when he has something to say. An
entry with no line just has no line. Do not default it to anything.

### 4.2 The icons

Small marks in Pat's pen, per 2.2. Two are enough to start, one for a note and
one for a line. They can be crude. Crude and his beats polished and Google's,
and it is the one place where the garden idea still shows up visually.

These replace the emoji everywhere: the plot, the entry pages, and the legend
(which can go, since a two-item legend explains nothing).

### 4.3 The rest

1. **Stack, do not grid, at this size.** Three entries in a three-across grid is
   the exact tell. Revisit at a dozen.
2. **Turn on topography.** Surface the wiki-links `expandWikiLinks` already
   resolves: a backlinks block on an entry page, and tags as navigation on the
   plot. Date sort stops being the primary organization. This is the first and
   most-cited pattern of the form, and the code is already half written.
3. **Keep the hue, drop the scenery.** The green palette in `gardenTheme.ts`
   stays. It is what makes moving from the portfolio to the garden feel like a
   shift, and it costs nothing. It just never gets asked to represent a plant.

---

## 5. Sequence

0. **The nav carries section hues**, per section 0. Fifteen lines, changes how
   the whole site reads, and settles what every later decision is serving. Do
   this before anything else, including the tokens.
1. **Tokens first:** the ground recipe, the pen, the two labels, the spacing
   scale. Nothing visible ships, but both pages get rebuilt on top of it.
2. **Garden**, starting with the stages, because deleting them shrinks the page
   and settles what the icons have to carry before any are drawn.
3. **Portfolio**, mostly a layout rewrite once the tokens exist.
4. **View transitions** last, as the join, once both pages are settled.

Update the `/garden` row of the "Current worlds" table in `design.md` as part of
step 2, per 4.0.

## 6. Open for Pat

Carried over from `design.md` and still undecided:

- How much wobble the pen has
- Paper or iPad
- Whether Caveat gets replaced with his own hand via Calligraphr

Settled 2026-09-04: no depicted garden, and the four stages are cut. See 4.0.

New, and needed before building:

- Which portfolio entry is the lead, and whether that is set per entry in
  frontmatter or fixed in code
- Whether a written status line per garden entry is wanted at all, or the page
  eyebrow saying nothing is finished is enough on its own (4.1)
- What the two garden icons actually are. Pat draws them
- Whether minor portfolio entries become index lines, or every entry stays a
  card

---

## Sources

Wayfinding and navigation, for section 0:
- Kevin Lynch, *The Image of the City*, MIT Press 1960. The five elements are
  chapter 3. Short book, worth actually reading
- https://www.uxmatters.com/mt/archives/2013/05/information-wayfinding-part-2-elements-of-the-information-environment.php
- https://www.nngroup.com/articles/information-foraging/
- https://www.nngroup.com/articles/3-ia-mistakes/
- https://blog.logrocket.com/ux-design/jakobs-law-creating-user-centric-interfaces/

Layout and the AI look:
- https://www.925studios.co/blog/ai-slop-design-tells
- https://vibecodekit.dev/ai-slop-design
- https://superdesign.dev/blog/why-ai-design-looks-generic
- https://thecrit.co/resources/portfolio-layout-examples
- https://uiterms.com/asymmetric-grid/

Digital gardens:
- https://maggieappleton.com/garden-history
- https://storyflow.so/blog/what-is-a-digital-garden-complete-guide
- https://indieweb.org/digital_garden

Cross-page system:
- https://carbondesignsystem.com/elements/motion/choreography/
- https://nextjs.org/docs/app/guides/view-transitions
- https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables

Texture and type:
- https://ibelick.com/blog/create-grainy-backgrounds-with-css
- https://ultimatedesigntools.com/blog/css-noise-textures-guide/
- https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
- https://www.carmenansio.com/articles/editorial-typography-css/
