import BlurFade from "@/components/ui/BlurFade";
import CardLayout, { type Card } from "@/components/sections/CardLayout";
import GaryStanding from "@/components/ui/GaryStanding";
import { P } from "@/components/sections/portfolioTheme";
import { getItems } from "@/lib/portfolio";

export default async function Portfolio() {
  const items = await getItems();

  const cards: Card[] = items.map((item) => ({
    key: item.slug,
    eyebrow: null,
    meta: item.year || null,
    title: item.title,
    blurbHtml: item.blurb,
    blurbText: null,
    href: item.href,
    internal: item.internal,
    cta: Boolean(item.href),
    image: item.image,
  }));

  return (
    <section style={{ padding: "3.5rem 0 6rem", minHeight: "100vh" }}>
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
              color: "var(--text)",
              textWrap: "balance",
            }}
          >
            Portfolio
          </h1>
        </BlurFade>

        <CardLayout cards={cards} theme={P} aside={<GaryStanding />} />
      </div>
    </section>
  );
}
