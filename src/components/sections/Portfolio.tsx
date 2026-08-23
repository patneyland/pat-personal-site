import BlurFade from "@/components/ui/BlurFade";
import PortfolioGrid from "@/components/sections/PortfolioGrid";
import { getItems } from "@/lib/portfolio";

export default async function Portfolio() {
  const items = await getItems();

  return (
    <section style={{ padding: "3.5rem 0 6rem" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "1100px", padding: "0 1.5rem" }}
      >
        <BlurFade delay={0.05}>
          <p className="text-caption" style={{ color: "var(--accent)" }}>
            Things I have built
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
              color: "var(--text)",
            }}
          >
            Portfolio
          </h1>
        </BlurFade>

        <PortfolioGrid items={items} />
      </div>
    </section>
  );
}
