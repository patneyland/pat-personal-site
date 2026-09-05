import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BlurFade from "@/components/ui/BlurFade";
import { G } from "@/components/sections/gardenTheme";
import PenMark from "@/components/ui/PenMark";
import { getEntries, getEntry } from "@/lib/garden";

export async function generateStaticParams() {
  const entries = await getEntries();
  return entries.filter((e) => e.body).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await getEntry(slug);
  if (!entry) return { title: "Garden | Patrick Neyland" };

  return {
    title: `${entry.title} | Patrick Neyland`,
    description: `An unfinished note in Patrick Neyland's garden.`,
  };
}

export default async function GardenEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = await getEntry(slug);

  if (!entry || !entry.body) notFound();

  return (
    <main>
      <article
        style={{
          position: "relative",
          backgroundColor: G.ground,
          padding: "3.5rem 0 7rem",
          /* Short entries are the norm here, so the world has to fill the
             viewport or the page background shows through below it. */
          minHeight: "100vh",
        }}
      >
        <div className="container-narrow relative" style={{ zIndex: 1 }}>
          <BlurFade delay={0.05}>
            <Link
              href="/garden"
              className="inline-flex items-center gap-2 text-sm font-medium"
              style={{ color: G.inkSoft, textDecoration: "none" }}
            >
              <ArrowLeft size={14} strokeWidth={2} />
              Back to the garden
            </Link>
          </BlurFade>

          <BlurFade delay={0.12}>
            <div
              style={{
                marginTop: "2.5rem",
                color: G.accent,
              }}
            >
              <PenMark mark="note" size={18} />
            </div>
          </BlurFade>

          <BlurFade delay={0.18}>
            <h1
              style={{
                marginTop: "0.85rem",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.9rem, 5vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: G.ink,
                textWrap: "balance",
              }}
            >
              {entry.title}
            </h1>
          </BlurFade>

          <BlurFade delay={0.24}>
            <p
              style={{
                marginTop: "1.4rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.63rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: G.inkSoft,
              }}
            >
              {entry.planted && <>Planted {entry.planted}</>}
              {entry.tended && entry.tended !== entry.planted && (
                <> &nbsp;/&nbsp; Last tended {entry.tended}</>
              )}
            </p>
          </BlurFade>

          <BlurFade delay={0.3}>
            <div
              className="garden-prose"
              style={{ marginTop: "2.5rem" }}
              dangerouslySetInnerHTML={{ __html: entry.body }}
            />
          </BlurFade>

          {entry.tags.length > 0 && (
            <BlurFade delay={0.36}>
              <div
                style={{
                  marginTop: "3rem",
                  paddingTop: "1.5rem",
                  borderTop: `1px solid ${G.edge}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                }}
              >
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.58rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: G.inkSoft,
                      border: `1px solid ${G.edge}`,
                      borderRadius: 999,
                      padding: "0.15rem 0.5rem",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </BlurFade>
          )}
        </div>
      </article>
    </main>
  );
}
