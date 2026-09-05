import BlurFade from "@/components/ui/BlurFade";
import CardLayout, { type Card } from "@/components/sections/CardLayout";
import GaryStanding from "@/components/ui/GaryStanding";
import { G } from "@/components/sections/gardenTheme";
import { getEntries } from "@/lib/garden";

/**
 * The plot.
 *
 * Laid out by the same component the portfolio uses, at Patrick's direction on
 * 2026-09-04: the two pages differ in colour and nothing else.
 *
 * There used to be a PenMark sprout before each title, kept as the last
 * garden-ish thing after the green and the depicted greenhouse were cut.
 * Patrick cut it too on 2026-09-05. It was never carrying its weight: every
 * entry currently resolves to kind "note", so all three cards drew the
 * identical glyph, and PenMark's own header calls the marks a placeholder,
 * "geometry, not his line." A hand-drawn mark that no hand drew.
 *
 * Every entry is the same tile at the same size, which is how Patrick wants
 * both pages. Notes come first and title-only entries after, which is the only
 * ordering left now that the tiers are gone.
 */
/* The one garden entry with art of its own. The smoker's watercolours were
   drawn for its body copy; this is the first of them, doing duty as the tile.
   Everything else falls through to CardLayout's essay placeholder until there
   is a real picture to put here. */
const GARDEN_IMAGES: Record<string, string> = {
  "better-automated-smoker": "/assets/garden/offset-plus-robot-arm.webp",
};

export default async function Garden() {
  const entries = await getEntries();
  const notes = entries.filter((e) => e.kind === "note");
  const lines = entries.filter((e) => e.kind === "line");

  const cards: Card[] = [
    ...notes.map((entry) => ({
      key: entry.slug,
      eyebrow: null,
      meta: entry.tended || entry.planted || null,
      title: entry.title,
      blurbHtml: null,
      blurbText: entry.excerpt,
      /* Always the entry's own page when it has one. CPA-bench used to send
         the tile straight to GitHub, which made one tile in the row behave
         differently from its neighbours and skipped Patrick's own writing on
         the way out. The external link now lives on the entry page, where it
         belongs. An entry with no body of its own still has nowhere to go but
         out. */
      href: entry.body ? `/garden/${entry.slug}` : entry.external,
      internal: Boolean(entry.body),
      cta: true,
      image: GARDEN_IMAGES[entry.slug] ?? null,
    })),
    ...lines.map((entry) => ({
      key: entry.slug,
      eyebrow: null,
      meta: entry.tended || entry.planted || null,
      title: entry.title,
      blurbHtml: null,
      blurbText: null,
      href: null,
      internal: false,
      cta: false,
      image: GARDEN_IMAGES[entry.slug] ?? null,
    })),
  ];

  return (
    <section
      style={{
        position: "relative",
        backgroundColor: G.ground,
        padding: "3.5rem 0 6rem",
        minHeight: "100vh",
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: "1000px", padding: "0 1.5rem" }}
      >
        <BlurFade delay={0.05}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.4rem, 7vw, 4.25rem)",
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: "-0.025em",
              color: G.ink,
              textWrap: "balance",
            }}
          >
            The Garden
          </h1>
        </BlurFade>

        <CardLayout cards={cards} theme={G} aside={<GaryStanding />} />

        {entries.length === 0 && (
          <BlurFade delay={0.24}>
            <p
              style={{
                marginTop: "2.5rem",
                maxWidth: "36rem",
                fontSize: "1.1rem",
                lineHeight: 1.4,
                color: G.accent,
              }}
            >
              Nothing planted yet. Check back.
            </p>
          </BlurFade>
        )}
      </div>
    </section>
  );
}
