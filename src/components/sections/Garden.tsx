import BlurFade from "@/components/ui/BlurFade";
import { GardenNote, GardenLine } from "@/components/sections/GardenBed";
import { G } from "@/components/sections/gardenTheme";
import { getEntries } from "@/lib/garden";

/**
 * The plot.
 *
 * Simplified 2026-09-04. What went: the four growth stages, the emoji that
 * labelled them, the legend that explained them, and the three-across grid.
 * What stayed: the green, the eyebrow, and the entries.
 *
 * The eyebrow is doing the work the stages were failing to do. It says the
 * honest thing once, at the top, in Patrick's words, which is worth more than
 * four gradations nobody could fill in truthfully.
 */
export default async function Garden() {
  const entries = await getEntries();
  const notes = entries.filter((e) => e.kind === "note");
  const lines = entries.filter((e) => e.kind === "line");

  return (
    <section
      style={{
        position: "relative",
        backgroundColor: G.ground,
        padding: "3.5rem 0 7rem",
        /* Fill what is left under the sticky nav, so a short plot does not
           show the page background below it and does not add a scrollbar. */
        minHeight: "calc(100svh - 3.35rem)",
        overflow: "hidden",
      }}
    >
      <div
        className="relative mx-auto"
        style={{ maxWidth: "44rem", padding: "0 1.5rem", zIndex: 1 }}
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

        {notes.length > 0 && (
          <div
            style={{
              marginTop: "2.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.9rem",
            }}
          >
            {notes.map((entry, i) => (
              <GardenNote
                key={entry.slug}
                entry={entry}
                delay={0.24 + i * 0.06}
              />
            ))}
          </div>
        )}

        {/* Titles with nothing written yet, gathered under the notes rather
            than mixed in among them. */}
        {lines.length > 0 && (
          <div style={{ marginTop: notes.length > 0 ? "3rem" : "2.75rem" }}>
            <BlurFade delay={0.24 + notes.length * 0.06}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: G.inkSoft,
                  opacity: 0.7,
                  marginBottom: "0.6rem",
                }}
              >
                Planted, not written
              </p>
            </BlurFade>
            {lines.map((entry, i) => (
              <GardenLine
                key={entry.slug}
                entry={entry}
                delay={0.3 + notes.length * 0.06 + i * 0.05}
              />
            ))}
          </div>
        )}

        {entries.length === 0 && (
          <BlurFade delay={0.24}>
            <p
              style={{
                marginTop: "2.5rem",
                maxWidth: "36rem",
                fontFamily: "var(--font-hand)",
                fontSize: "1.6rem",
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
