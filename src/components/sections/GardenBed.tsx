"use client";

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import PenMark from "@/components/ui/PenMark";
import { G } from "@/components/sections/gardenTheme";
import type { Entry } from "@/lib/garden";

/**
 * One entry on the plot.
 *
 * Two forms, and which one an entry gets is derived in lib/garden.ts rather
 * than chosen: a note is something with writing behind it, a line is a title
 * so far. Neither is labelled. The difference is already visible, because one
 * is a block you can click and the other is not.
 *
 * These stack down the page in a single column rather than sitting in a grid.
 * Three entries in a three-across grid was the most generic thing on the site.
 * Revisit the grid at a dozen entries, not before.
 */

const ROW = "0.9rem";

export function GardenNote({ entry, delay }: { entry: Entry; delay: number }) {
  const [hot, setHot] = useState(false);

  const shell: React.CSSProperties = {
    position: "relative",
    display: "block",
    padding: "1.4rem 1.5rem 1.5rem",
    borderRadius: 10,
    textDecoration: "none",
    border: `1px solid ${hot ? G.edgeHot : G.edge}`,
    background: hot ? "rgba(158,203,126,0.045)" : "rgba(255,255,255,0.015)",
    transition: "border-color 0.3s ease, background 0.3s ease",
  };

  const body = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          color: G.accent,
        }}
      >
        <PenMark mark="note" size={17} />
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.18rem",
            fontWeight: 600,
            lineHeight: 1.3,
            color: G.ink,
            textWrap: "balance",
          }}
        >
          {entry.title}
        </h3>
        <span
          style={{
            marginLeft: "auto",
            paddingLeft: "1rem",
            flexShrink: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "0.62rem",
            letterSpacing: "0.11em",
            textTransform: "uppercase",
            color: G.inkSoft,
            opacity: 0.75,
          }}
        >
          {entry.tended || entry.planted}
        </span>
      </div>

      {entry.excerpt && (
        <p
          style={{
            marginTop: "0.55rem",
            maxWidth: "34rem",
            fontSize: "0.92rem",
            lineHeight: 1.65,
            color: G.inkSoft,
            textWrap: "pretty",
          }}
        >
          {entry.excerpt}
        </p>
      )}

      <div
        style={{
          marginTop: ROW,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.55rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.63rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: hot ? G.ink : G.accent,
            transition: "color 0.2s ease",
          }}
        >
          {entry.external ? "Read it elsewhere ↗" : "Read it →"}
        </span>

        {entry.tags.length > 0 && (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "0.58rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: G.inkSoft,
              opacity: 0.8,
            }}
          >
            {entry.tags.join(" · ")}
          </span>
        )}
      </div>
    </>
  );

  const handlers = {
    onMouseEnter: () => setHot(true),
    onMouseLeave: () => setHot(false),
  };

  return (
    <BlurFade delay={delay}>
      {entry.external ? (
        <a
          href={entry.external}
          target="_blank"
          rel="noopener noreferrer"
          style={shell}
          {...handlers}
        >
          {body}
        </a>
      ) : (
        <Link href={`/garden/${entry.slug}`} style={shell} {...handlers}>
          {body}
        </Link>
      )}
    </BlurFade>
  );
}

/**
 * A title and a date, and nothing written yet.
 *
 * Deliberately not a panel and deliberately not a link. An entry with nothing
 * behind it should not look like it is offering something.
 */
export function GardenLine({ entry, delay }: { entry: Entry; delay: number }) {
  return (
    <BlurFade delay={delay}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.55rem",
          padding: "0.55rem 0",
          borderTop: `1px solid ${G.edge}`,
        }}
      >
        <span style={{ color: G.inkSoft, alignSelf: "center", opacity: 0.7 }}>
          <PenMark mark="line" size={14} />
        </span>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.95rem",
            color: G.inkSoft,
          }}
        >
          {entry.title}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "0.58rem",
            letterSpacing: "0.11em",
            textTransform: "uppercase",
            color: G.inkSoft,
            opacity: 0.55,
          }}
        >
          {entry.tended || entry.planted}
        </span>
      </div>
    </BlurFade>
  );
}
