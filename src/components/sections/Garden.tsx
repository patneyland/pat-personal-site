import BlurFade from "@/components/ui/BlurFade";
import CardLayout, { type Card } from "@/components/sections/CardLayout";
import GaryStanding from "@/components/ui/GaryStanding";
import PenMark from "@/components/ui/PenMark";
import { G } from "@/components/sections/gardenTheme";
import { getEntries } from "@/lib/garden";

/**
 * The plot.
 *
 * Laid out by the same component the portfolio uses, at Patrick's direction on
 * 2026-09-04: the two pages differ in colour and nothing else. The one
 * exception he asked for is the mark before each title, which is the only
 * garden-ish thing left after the green and the depicted greenhouse were cut.
 *
 * The weight tiers are derived here rather than authored, because a garden
 * entry has nothing to author them from. The most recently tended note leads,
 * the rest sit in the grid, and a title with nothing written behind it drops
 * to the index.
 */
export default async function Garden() {
  const entries = await getEntries();
  const notes = entries.filter((e) => e.kind === "note");
  const lines = entries.filter((e) => e.kind === "line");

  const cards: Card[] = [
    ...notes.map((entry, i) => ({
      key: entry.slug,
      weight: (i === 0 ? "lead" : "standard") as Card["weight"],
      eyebrow: entry.tags.length ? entry.tags.join(" · ") : null,
      meta: entry.tended || entry.planted || null,
      title: entry.title,
      blurbHtml: null,
      blurbText: entry.excerpt,
      href: entry.external ?? `/garden/${entry.slug}`,
      internal: !entry.external,
      cta: entry.external ? "Read it elsewhere" : "Read it",
      image: null,
      mark: <PenMark mark="note" size={i === 0 ? 26 : 16} />,
    })),
    ...lines.map((entry) => ({
      key: entry.slug,
      weight: "minor" as Card["weight"],
      eyebrow: entry.tags.length ? entry.tags.join(" · ") : null,
      meta: entry.tended || entry.planted || null,
      title: entry.title,
      blurbHtml: null,
      blurbText: null,
      href: null,
      internal: false,
      cta: null,
      image: null,
      mark: <PenMark mark="line" size={14} />,
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
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.66rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: G.accent,
            }}
          >
            Nothing here is finished
          </p>
        </BlurFade>

        <BlurFade delay={0.12}>
          <h1
            style={{
              marginTop: "0.85rem",
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

        <BlurFade delay={0.18}>
          <p
            style={{
              marginTop: "1.1rem",
              maxWidth: "36rem",
              fontSize: "1.02rem",
              lineHeight: 1.75,
              color: G.inkSoft,
              textWrap: "pretty",
            }}
          >
            Projects and writing that are still in the ground. Some of it will
            grow into something. Some of it will not.
          </p>
        </BlurFade>

        {/* "Planted, not written" is a placeholder label, not Patrick's copy. */}
        <CardLayout
          cards={cards}
          theme={G}
          indexLabel={lines.length > 0 ? "Planted, not written" : undefined}
          aside={<GaryStanding />}
        />

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
