import BlurFade from "@/components/ui/BlurFade";
import CardLayout, { type Card } from "@/components/sections/CardLayout";
import GaryPacing from "@/components/ui/GaryPacing";
import { P } from "@/components/sections/portfolioTheme";
import { getItems } from "@/lib/portfolio";
import { readGreeting } from "@/lib/gary/prompt";
import { NAV_H } from "@/lib/nav";

export default async function Portfolio() {
  const items = await getItems();
  /* Read here rather than in the client component: content/gary.md is on
     disk, and this page is already a server component. The heading is named
     in full because it is Patrick's to rename, and content/gary.md says so. */
  const greeting = readGreeting("His greeting on the portfolio");

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

        <CardLayout
          cards={cards}
          theme={P}
          aside={
            <GaryPacing
              greeting={greeting}
              greetKey="/portfolio"
              knockout={false}
              ceiling={NAV_H}
              greetModes={["right"]}
            />
          }
        />
      </div>
    </section>
  );
}
