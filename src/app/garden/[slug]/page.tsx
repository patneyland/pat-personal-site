import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import BlurFade from "@/components/ui/BlurFade";
import { G } from "@/components/sections/gardenTheme";
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
            <h1
              style={{
                /* The sprout used to sit between the back link and the title
                   and carried this gap on its own margin. It went on
                   2026-09-05; the gap was worth keeping, so it moved here. */
                marginTop: "2.5rem",
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

          {/* Where the thing itself lives, when it lives somewhere else.
              This used to be the tile's own destination on /garden, which
              sent a reader to GitHub past Patrick's writing about it. The
              tile goes to this page now and the outbound link waits here.

              The label is the URL, not a phrase. Claude does not write copy
              for this site, and a bare address is a fact rather than a line
              of prose. */}
          {entry.external && (
            <BlurFade delay={0.34}>
              <a
                href={entry.external}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: "2.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.04em",
                  color: G.accent,
                  textDecoration: "none",
                  borderBottom: `1px solid ${G.edgeHot}`,
                  paddingBottom: "0.15rem",
                }}
              >
                {entry.external.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                <ArrowUpRight size={13} strokeWidth={1.5} />
              </a>
            </BlurFade>
          )}

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
