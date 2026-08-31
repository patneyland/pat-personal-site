# Current Plate — pat-personal-site

**The plate for patrickneyland.com.** What is live, what is half done, and what is
waiting on Pat. Specs for individual pieces live in `docs/`; this file is the state of
the whole thing.

Last touched: 2026-08-31.

---

# ACTIVE: Gary's chat

**Shipped 2026-08-31 and deliberately switched off.** Commit `77b4b6d` is live on
production. No visitor can see Gary's chat yet, and nothing about the rest of the site
changed. Two things have to happen before he turns on, and both are Pat's.

## Where things stand

Click Gary and talk to him. He answers only from a knowledge base generated at build
time out of `content/`, so adding a portfolio entry teaches him about it with no code
change, and he can only link to routes that actually exist. There is no vector database
and there should not be one: the whole corpus is about 7,400 characters, so it fits in
the system prompt on every turn.

The conversation is a hand-drawn thought bubble that comes off him. He stops walking,
turns to face you, and goes back to pacing where he left off when it closes. On `/story`
he is clickable too but does not introduce himself. On `/` he never appears, because
boring mode stays plain.

Runs on **OpenRouter**, currently `anthropic/claude-opus-5`, changed in one line in
`src/lib/gary/model.ts`.

**The gate.** `content/gary.md` holds his voice and is Pat's to write. While it is empty
the launcher does not render and `/api/gary` refuses. This is on purpose: the plumbing
can ship without a personality, and a personality Claude invented cannot ship by
accident. Local development ran against a throwaway voice in a file outside the repo,
pointed at by `GARY_VOICE_FILE` in `.env.local`. None of that is his voice and none of it
is committed.

Verified live after the push: all five routes 200, the new sprite serves, `/api/gary`
correctly refuses, the launcher correctly does not render.

Full design and reasoning: [docs/gary-chat.md](docs/gary-chat.md).

## Blocked on Pat

1. **Write `content/gary.md`.** This is the gate, and it is the real outstanding work.
   The mechanism is finished; Gary does not sound like anyone yet. The file has empty
   sections with a note in each explaining what goes there. Every note in it is inside an
   HTML comment, so anything written outside a comment counts as his voice.
2. **Set `OPENROUTER_API_KEY` in Vercel.** The project currently has **no environment
   variables at all**. Add it to Production, and to Preview if branch deploys should
   work too, then redeploy: environment variables are read at build and runtime, so an
   existing deployment will not pick it up on its own.

   https://vercel.com/neyland-solutions/pat-personal-site/settings/environment-variables

   The key is in the local `.env.local`, which is gitignored because this repo is public.

## Open decisions (Pat's)

1. **His personality.** See above. Three things the throwaway voice exposed, worth
   fixing when the real one is written:
   - He is fine at short factual answers and weak the moment a question is about a
     person. "Who is Patrick?" came back as "He's the one whose site this is, and you're
     already on the right page for that." The handoff rule works, the words do not.
   - He needed telling twice, in rules, not to write like a language model. Brevity had
     to become a hard one-or-two-sentence limit and em dashes had to be banned outright
     before he stopped producing them. A real voice should make both unnecessary rather
     than the rules file fighting him.
   - The greeting is shown verbatim rather than generated, so it carries more weight than
     anything else he says.
2. **The rest of the writing rules.** Only the em dash ban from `ai-writing-detection.md`
   made it into his prompt. The full prohibition list is not in there.
3. **The bubble is not in Pat's hand.** Its outline is generated, traced off a CC0
   reference rather than drawn. `scripts/dev/trace.mjs` is the route if it should be his,
   the same way the head-on poses were.
4. **Where Gary can be talked to.** Today: `/fun` and `/story`. Not `/`, not `/portfolio`
   or `/garden` unless a conversation is already open and follows you there.

## Not yet verified

- **The chat has never run in production.** Every test has been against localhost. The
  first real check is only possible once the key is set.
- **The mobile fallback has not been seen on a phone.** Below a 420px card the bubble is
  replaced by a sheet at the bottom of the screen, portalled to the body. It works in a
  narrow browser window; no real device has touched it.
- **Rate limiting is per server instance.** Serverless means each instance keeps its own
  counter, so 12 messages a minute is a speed bump, not a wall.

## Lessons worth keeping

**A gate that can fail open is not a gate.** The first version of the voice check
stripped comments and headings and measured what was left. The notes-to-Pat in
`content/gary.md` were neither, so they sailed through, opened the gate, and the model
adopted Claude's instructions as its personality. The fix was structural, not a better
heuristic: every note in that file now lives inside an HTML comment, so anything outside
one is by definition Pat's.

**Two dev servers in one folder corrupt each other.** Both write the same `.next`, and
the symptom is phantom 404s on routes whose files are present and untouched. This cost
real debugging time while another agent was working in the same tree. One server, or one
worktree each. The same applies to running `next build` while a dev server is up.

**Hand-drawn means fewer and bigger, not wobblier.** The first thought bubble had twenty
near-identical bumps on a rectangle and read as a doily. A real one is six to a dozen
lobes, each a large fraction of the shape, biggest two or three times the smallest.

## Tooling built

| Script | Purpose |
|---|---|
| `scripts/dev/make-pacer.mjs` | the walking sprite for the top edge of the `/fun` card |
| `scripts/dev/make-facing.mjs` | the standing sprite he swaps to when he stops to talk |
| `scripts/dev/make-pointer.mjs` | the pointing figure on the plain front page |
| `scripts/thumbnails.mjs` | screenshots any portfolio entry with a public link |

`make-pacer.mjs` and `make-facing.mjs` both read a CC0 sprite pack that lives **outside
the repo** in a temp folder. If it has been cleaned up, unzip
`stick_figure_character_sprites_2d.zip` again and repoint `SRC`. The generated PNGs are
committed, so this only matters when changing a sprite.

---

# Also in flight

**Gary crossing the story page**, by a second agent working in this same repo at the same
time. Committed straight to `master` (`9e296f5` through `e236c97`) and already live. That
work owns `src/components/ui/StoryGary.tsx`, `src/lib/character/`, and `src/app/lab/`.
The chat added 35 lines to `StoryGary.tsx` to make him clickable, so that one file has
two authors in it.

# Elsewhere

| Where | What |
|---|---|
| [docs/gary-chat.md](docs/gary-chat.md) | the chat: design, decisions and why |
| [docs/character-pipeline.md](docs/character-pipeline.md) | the drawn character: Krita to atlas to runtime |
| [docs/character-session-1.md](docs/character-session-1.md) | the working session that started the character |
| [CLAUDE.md](CLAUDE.md) | how to work in this repo, and the copy rule |
| [design.md](design.md) | colours, type and the per-page worlds |
| [ai-writing-detection.md](ai-writing-detection.md) | the writing prohibitions |
