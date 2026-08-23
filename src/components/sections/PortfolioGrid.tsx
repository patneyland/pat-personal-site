"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowUpRight } from "lucide-react";
import type { Item } from "@/lib/portfolio";

function Tile({ item, delay }: { item: Item; delay: number }) {
  const [hot, setHot] = useState(false);
  const linked = Boolean(item.href);

  const shell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    height: "100%",
    padding: item.image ? "0 0 1.4rem" : "1.35rem 1.4rem 1.5rem",
    borderRadius: 3,
    overflow: "hidden",
    textDecoration: "none",
    backgroundColor: "var(--bg-card)",
    border: `1px solid ${
      hot && linked ? "var(--accent-dim)" : "var(--border)"
    }`,
    transform: hot && linked ? "translateY(-2px)" : "translateY(0)",
    transition: "border-color 0.25s ease, transform 0.25s ease",
  };

  const inset = item.image
    ? { paddingLeft: "1.4rem", paddingRight: "1.4rem" }
    : undefined;

  const body = (
    <>
      {item.image && (
        <div
          style={{
            aspectRatio: "16/9",
            overflow: "hidden",
            marginBottom: "1.1rem",
            backgroundColor: "var(--bg-alt)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: hot ? "none" : "saturate(0.85) brightness(0.92)",
              transition: "filter 0.3s ease",
            }}
          />
        </div>
      )}

      <div
        style={{
          ...inset,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--accent)" }}>{item.tag}</span>
        {item.year && (
          <span
            style={{
              color: "var(--text-muted)",
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.year}
          </span>
        )}
      </div>

      <h3
        style={{
          ...inset,
          marginTop: "0.35rem",
          fontSize: "1.12rem",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "var(--text)",
        }}
      >
        {item.title}
      </h3>

      {/* A link with a thumbnail is a complete entry. No filler when there is
          nothing written yet. */}
      {item.blurb && (
        <div
          className="tile-blurb"
          style={{
            ...inset,
            flex: 1,
            fontFamily: "var(--font-heading)",
            fontSize: "0.89rem",
            lineHeight: 1.7,
            color: "var(--text-muted)",
          }}
          dangerouslySetInnerHTML={{ __html: item.blurb }}
        />
      )}

      {!item.blurb && <div style={{ flex: 1 }} />}

      {item.cta && (
        <span
          style={{
            ...inset,
            marginTop: "0.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.66rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: hot ? "var(--text)" : "var(--accent)",
            transition: "color 0.2s ease",
          }}
        >
          {item.cta}
          <ArrowUpRight size={13} strokeWidth={1.5} />
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
      {item.href && item.internal ? (
        <Link href={item.href} style={shell} {...handlers}>
          {body}
        </Link>
      ) : item.href ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          style={shell}
          {...handlers}
        >
          {body}
        </a>
      ) : (
        <div style={shell}>{body}</div>
      )}
    </BlurFade>
  );
}

export default function PortfolioGrid({ items }: { items: Item[] }) {
  return (
    <div
      style={{
        marginTop: "3rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
        gap: "1.25rem",
        alignItems: "stretch",
      }}
    >
      {items.map((item, i) => (
        <Tile key={item.slug} item={item} delay={0.06 + i * 0.05} />
      ))}
    </div>
  );
}
