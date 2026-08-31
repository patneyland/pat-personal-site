/**
 * Which model Gary runs on.
 *
 * Changing this line changes Gary. It is version controlled on purpose, so the
 * model that produced any given behaviour is recorded next to the prompt that
 * produced it. `GARY_MODEL` overrides it without a commit, for trying something
 * quickly in local dev or in a Vercel preview.
 *
 * Remember that swapping model families is a re-test, not a config flip. A
 * prompt tuned until Gary sounds right on one model reads differently on
 * another. Change this, then go read his replies again.
 *
 * Slugs verified against OpenRouter's model list. Some alternatives, cheapest
 * last, with per-million input/output prices at the time of writing:
 *
 *   anthropic/claude-opus-5      $5.00 / $25.00
 *   anthropic/claude-sonnet-5    $2.00 / $10.00
 *   anthropic/claude-haiku-4.5   $1.00 /  $5.00
 *   google/gemini-2.5-flash      $0.30 /  $2.50
 *
 * Cost is not the constraint here. A full conversation runs a few cents even at
 * the top of that list, so pick on how Gary sounds.
 */
export const GARY_MODEL = process.env.GARY_MODEL ?? "anthropic/claude-opus-5";

/** Gary answers in a small panel. Long replies do not fit and do not suit him. */
export const MAX_TOKENS = 600;

/** Turns kept in one conversation, counting both sides. Older ones drop off. */
export const MAX_TURNS = 40;

/** Longest single message a visitor can send, in characters. */
export const MAX_INPUT_CHARS = 1000;
