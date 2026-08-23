"use client";

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import { G, STAGE_META } from "@/components/sections/gardenTheme";
import type { Entry } from "@/lib/garden";

export default function GardenBed({
  entry,
  delay,
}: {
  entry: Entry;
  delay: number;
}) {
  const [hot, setHot] = useState(false);
  const stage = STAGE_META[entry.stage];

  const readable = Boolean(entry.body) || Boolean(entry.external);

  const shell: React.CSSProperties = {
    position: "relative",
    display: "block",
    height: "100%",
    padding: "1.5rem 1.6rem 1.6rem",
    borderRadius: 14,
    textDecoration: "none",
    border: `1px solid ${hot && readable ? G.edgeHot : G.edge}`,
    background:
      hot && readable ? "rgba(158,203,126,0.045)" : "rgba(255,255,255,0.015)",
    transform: hot && readable ? "translateY(-3px)" : "translateY(0)",
    transition:
      "border-color 0.3s ease, background 0.3s ease, transform 0.3s ease",
  };

  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
        <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>{stage.glyph}</span>
        <span
          style={{
            fontFamily: "var(--font-hand)",
            fontSize: "1.35rem",
            lineHeight: 1,
            color: G.accent,
          }}
        >
          {stage.label}
        </span>
        <span
          style={{
            marginLeft: "auto",
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

      <h3
        style={{
          marginTop: "0.85rem",
          fontFamily: "var(--font-heading)",
          fontSize: "1.15rem",
          fontWeight: 600,
          lineHeight: 1.3,
          color: G.ink,
        }}
      >
        {entry.title}
      </h3>

      {entry.tags.length > 0 && (
        <div
          style={{
            marginTop: "0.7rem",
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
      )}

      {readable && (
        <span
          style={{
            marginTop: "0.9rem",
            display: "inline-block",
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
      )}
    </>
  );

  const handlers = {
    onMouseEnter: () => setHot(true),
    onMouseLeave: () => setHot(false),
  };

  return (
    <BlurFade delay={delay} className="h-full">
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
      ) : entry.body ? (
        <Link href={`/garden/${entry.slug}`} style={shell} {...handlers}>
          {body}
        </Link>
      ) : (
        /* Frontmatter only. A seed with nothing written yet is a complete
           entry, so this deliberately does not link anywhere. */
        <div style={shell}>{body}</div>
      )}
    </BlurFade>
  );
}
