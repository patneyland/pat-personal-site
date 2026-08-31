# Gary, the chat

Status: **live, on a draft voice.** The code shipped 2026-08-31 and was switched
on 2026-09-01. The words in `content/gary.md` are Claude's, committed at
Patrick's explicit request as a starting point for him to improve, and they are
what visitors hear today. See "His personality" under Outstanding.

Gary can already walk. This is about letting him talk. A visitor clicks him on
`/fun`, a small panel opens, and they can ask him about the site. He answers
from a fixed knowledge base built out of `content/`, and he hands out links.

Two jobs at once: a real assistant for the site, and a working demonstration of
the thing Patrick does for a living.

---

## Decisions already made

These came out of the scoping session on 2026-08-27. The reasoning matters more
than the conclusions, so it is recorded here rather than rediscovered later.

### Gary is his own character

He speaks for himself. He is not Patrick, does not claim to be, and never
answers in Patrick's voice.

This was the fork the whole feature hung on, because of the copy rule in
`CLAUDE.md`: every word on this site is Patrick's. A language model generating
sentences on the site collides with that rule head on.

Framing Gary as a separate character resolves it. Gary is a stick figure who
works here. He was never claiming to be Patrick's voice, so he is not competing
with it. When a question turns personal he hands off to the page that answers
it instead of paraphrasing Patrick.

The alternative, considered and rejected: Gary as a pure router that only ever
surfaces sentences Patrick already wrote. Higher fidelity, but it does not
deliver the thing Patrick asked for.

### There is no retrieval layer

The entire content corpus is about 7,400 characters, roughly 3,000 tokens with
the Story and Hero copy added. It fits in the system prompt on every turn.

No vector database, no embeddings, no chunking, no similarity search. Anyone
picking this up later should resist adding one. The site would have to grow by
an order of magnitude before retrieval earns its complexity, and the whole
corpus in context beats retrieval on answer quality anyway.

### OpenRouter, not a direct provider SDK

Patrick's call, and the right one. One key, and the model becomes a one line
change.

Prompt caching survives the move. Anthropic models through OpenRouter take
explicit `cache_control` breakpoints at the same 1.25x write and 0.1x read
multipliers as going direct, and OpenRouter does sticky routing so follow up
requests land on the same provider and actually hit the cache. Some providers
(OpenAI, Gemini 2.5, Groq, DeepSeek) cache automatically with no breakpoints.

Costs of the choice, accepted: a small markup on credit top ups, one extra
network hop (invisible behind streaming), and the API is OpenAI compatible so
this is plain `fetch`, no SDK.

**Swapping model families is a re-test, not a config flip.** A prompt tuned
until Gary sounds right on one model will read differently on another. Change
the model, then go read his replies again.

### He stops walking to talk

Added 2026-08-28, at Patrick's request. The conversation is a speech bubble
coming off Gary rather than a widget in the corner. He stops where he is, turns
to face the visitor for as long as the chat is open, and goes back to pacing
when it closes.

He walks under a CSS animation, so nothing in JS knows where he is at any
moment. Rather than reimplement the walk in JS to find out, the running
animations are paused through the Web Animations API. That freezes him
mid-stride exactly where he was and, more usefully, remembers his progress, so
resuming is just `play()` and he carries on from the step he stopped on instead
of teleporting back to the left edge. Verified: clicked at x=258, resumed at
x=258.

Facing the visitor needed a second sprite, `gary-facing.png`, built by
`scripts/dev/make-facing.mjs` from the pack's idle frames. It has to be
generated the same way as the pacing sheet, because the two are swapped
mid-animation and any difference in scale or baseline shows as a jump. Measured
off the source: walk figure 105x174 with its lowest foot pixel at y380, idle
106x160 at y379. Same scale, same ground line, so only a 13px horizontal
correction was needed.

**The bubble flips.** The card is centred in the viewport, which on a 900px
window leaves about 150px of sky above it. A greeting fits there. A conversation
does not, so when it will not fit above his head it hangs below his feet over
the card, with the tail pointing back up at him. It covers the photo while open,
which is the cost of keeping the conversation attached to him rather than parked
in a corner.

### The panel is site wide, the launcher is not

Gary's job is handing out links. If the panel lives inside the `/fun` page, the
first link he gives unmounts him mid sentence and the feature sabotages its own
core function on the first click.

So the panel mounts in `src/app/layout.tsx`, which does not unmount across route
changes. React state survives client side navigation for free.

The launcher only exists on `/fun`, on the pacing Gary. Land cold on `/story`
and there is no Gary. This keeps the collage untouched and leaves `StoryGary`'s
scroll choreography alone, where clicking him mid leap would be strange. But if
you opened him on `/fun`, he rides along everywhere.

Which is why the bubble is not the only form the conversation takes. Gary is
only drawn on `/fun`, so off that page there is nobody to speak from and the
same conversation continues in a corner panel instead. Follow one of his links
and the bubble becomes the panel with the talk intact. The alternative, closing
the chat when you leave `/fun`, would bring back exactly the problem this whole
placement exists to avoid.

---

## Where the prompt lives

Three pieces, three owners. The split is the point: it keeps Claude out of
Patrick's voice, and keeps Patrick out of a link table that should not be
maintained by hand.

| File | Owner | Holds |
|---|---|---|
| `content/gary.md` | **Patrick** | Gary's voice, his greeting, how he handles specific questions |
| `src/lib/gary/site-notes.md` | Claude | Mechanical pointers and caveats |
| generated at build | nobody | Page summaries and the link table |

`content/gary.md` is edited through the GitHub web UI like every other word on
the site. **Claude does not write or edit this file.** Gary's personality is
copy, and the copy rule applies to it exactly as it applies to the Hero.

`site-notes.md` is for things that are true about the site but are not in the
content files. Example: the woodworking page is live but has no photos yet, so
Gary should not promise pictures.

The generated piece reuses the existing `getItems()` and garden readers. Add a
portfolio entry, and Gary knows about it on the next deploy. Nobody edits a
list, so the list cannot go stale. This avoids the standard failure where a site
chatbot confidently links to a page that was deleted months ago.

### The gate

**No `content/gary.md`, no Gary.** If the file is empty or missing, the launcher
does not render and the API route returns an error.

This is deliberate. The failure mode this rule exists to prevent is a
placeholder voice shipping to production because the feature worked well enough
without anyone filling the file in.

---

## What Gary must never do

He speaks for himself, but he is standing on Patrick's professional site. A
visitor attributes whatever he says to Patrick regardless of the framing. The
character freedom is about tone, not about facts.

- **No fact about Patrick that is not in the corpus.** Not inferred, not
  reasoned toward, not filled in from general knowledge about accountants or
  Utah State or AI consultants.
- **Never speaks as Patrick**, and never states Patrick's opinions, beliefs, or
  positions on anything. Personal questions get a handoff to `/story`.
- **Respects `draft: true`.** The corpus builder must run the same filter
  `getItems()` does. Draft entries are work that is real but not ready to show,
  and Gary leaking one would be worse than the feature not existing.
- **No claims about availability, pricing, clients, or engagements.** Those
  route to Neyland Solutions.
- **Only links to routes that exist.** The link whitelist is generated from the
  route map, so he cannot invent `/blog`.
- **Declines off topic questions.** He is not a general assistant. He works here.

---

## Conversation persistence

Scoped to one visit, in one tab.

Client side navigation is free once the panel is in the layout. A hard reload or
a direct landing needs `sessionStorage`, which is scoped to the tab and cleared
when it closes. That maps exactly onto "one visit".

Nothing is stored server side. No cookies, no database, no conversation logs,
nothing that needs a privacy policy. The tradeoff, accepted: Patrick cannot read
what people asked Gary. If that becomes interesting later it is a real feature
with real privacy consequences, not a small addition.

The current pathname goes up with each message, so Gary knows what page the
visitor is looking at. Asking "what is this?" on `/garden` gets an answer about
the garden.

---

## Shape of the build

```
content/gary.md                    Patrick's, gated, see above
src/lib/gary/
  corpus.ts                        reads content/* at build, respects draft
  site-notes.md                    Claude's mechanical pointers
  prompt.ts                        assembles the three pieces
  model.ts                         model slug, env override via GARY_MODEL
src/app/api/gary/route.ts          streaming handler, OpenRouter
src/components/ui/GaryChat.tsx     the panel, mounted in layout.tsx
src/components/ui/GaryPacing.tsx   gains a click target and an idle state
```

The panel: about 320px, white card, `#e2e2e2` border, the same shadow as the
Hero card, anchored to a card corner so it never covers the photo or the name.
A bottom sheet on mobile. Gary stops pacing and stands while it is open;
`public/assets/idle-sheet.png` already exists for this.

The greeting appears once on load, then retreats to something small so it is
not shouting at repeat visitors.

Operational: `OPENROUTER_API_KEY` lives in Vercel env only, never in the repo,
which is public. Rate limit by IP, cap conversation length, cap `max_tokens`.

Cost is not a constraint. With a cached system prompt and short answers, a full
conversation runs a few cents even on an expensive model. Model choice should be
made on how Gary sounds, not on price.

---

## Outstanding

### His personality is the next piece of work

Flagged by Patrick on 2026-08-31, at the point the mechanism was finished and
shipped. Everything around Gary works. Gary himself does not sound like anyone
yet.

**Updated 2026-09-01.** The gate held right up until Patrick chose to open it. He
asked for the throwaway test voice to be committed as something to react to
rather than starting from an empty file, so `content/gary.md` now carries
Claude's words and the chat is on. The `GARY_VOICE_FILE` override has been
removed from local development, so local and production now read the same file.

This is the one place on the site where the copy rule has been knowingly set
aside, and only as a draft. Only the greeting is close to Patrick's own words,
from how he described it when the feature was scoped.

What the draft voice has already shown up, worth fixing when he rewrites it:

- He is fine at short factual answers and weak the moment a question is about a
  person. "Who is Patrick?" came back as "He's the one whose site this is, and
  you're already on the right page for that", which is awkward and says nothing.
  The handoff rule is working; the words around it are not.
- He needed telling twice, in rules, not to write like a language model. Brevity
  had to become a hard limit of one or two sentences, and em dashes had to be
  banned outright, before he stopped producing them. A real voice in
  `content/gary.md` should make both unnecessary rather than fighting them from
  the rules file.
- The greeting is the one line every visitor sees and it is shown verbatim
  rather than generated, so it carries more weight than anything else he says.

Patrick writes this. Claude does not, in this file or any other, per the copy
rule in CLAUDE.md.

### Also open

1. Confirm the launcher stays `/fun` only, plus the story page, where he is now
   clickable but does not introduce himself.
2. The site's full writing rules from `ai-writing-detection.md` are not in his
   prompt. Only the em dash ban made it in so far.
3. The bubble outline is generated from a CC0 reference rather than drawn by
   Patrick. `scripts/dev/trace.mjs` is the route if he wants it in his own hand.

## What production needs before the chat works

Shipping the code is not enough to switch Gary on. Both of these are Patrick's
to do, and until then the launcher does not render and `/api/gary` returns 503:

1. **Words in `content/gary.md`.** This is the gate.
2. **`OPENROUTER_API_KEY` set in the Vercel project.** It exists only in a local
   `.env.local`, which is gitignored because this repo is public.
