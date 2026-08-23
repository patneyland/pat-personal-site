import BlurFade from "@/components/ui/BlurFade";
import GardenBed from "@/components/sections/GardenBed";
import { G, STAGE_META } from "@/components/sections/gardenTheme";
import { getEntries, STAGES } from "@/lib/garden";

export default async function Garden() {
  const entries = await getEntries();

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
        style={{ maxWidth: "1000px", padding: "0 1.5rem", zIndex: 1 }}
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
            }}
          >
            Projects and writing that are still in the ground. Some of it will
            grow into something. Some of it will not. I would rather show you
            the plot than wait until everything is picked.
          </p>
        </BlurFade>

        {/* The legend only means something once there is something to label. */}
        {entries.length > 0 && (
        <BlurFade delay={0.24}>
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "1.4rem",
            }}
          >
            {STAGES.map((key) => (
              <span
                key={key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.66rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: G.inkSoft,
                }}
              >
                <span style={{ fontSize: "0.9rem" }}>
                  {STAGE_META[key].glyph}
                </span>
                {STAGE_META[key].label}
              </span>
            ))}
          </div>
        </BlurFade>
        )}

        <div
          style={{
            marginTop: "2.75rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: "1.25rem",
            alignItems: "stretch",
          }}
        >
          {entries.map((entry, i) => (
            <GardenBed
              key={entry.slug}
              entry={entry}
              delay={0.08 + i * 0.06}
            />
          ))}
        </div>

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
