"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowUpRight } from "lucide-react";
import type { Item } from "@/lib/portfolio";

/* Paper, for the boring tiles. Everything else comes from globals.css. */
const PAPER = {
  bg: "#f4f0e6",
  ink: "#14120e",
  soft: "#5a544a",
  edge: "#b8b0a0",
  label: "#8a8069",
};

/**
 * Spread the boring tiles evenly through the cool ones.
 *
 * Sorting by date would clump them, since the projects are recent and the
 * credentials are not. Deterministic, so server and client agree.
 */
function interleave(cool: Item[], boring: Item[]): Item[] {
  if (!boring.length) return cool;
  if (!cool.length) return boring;

  const out: Item[] = [];
  let c = 0;
  let b = 0;

  while (c < cool.length || b < boring.length) {
    if (b >= boring.length || (c < cool.length && c / cool.length <= b / boring.length)) {
      out.push(cool[c++]);
    } else {
      out.push(boring[b++]);
    }
  }

  return out;
}

function Tile({ item, delay }: { item: Item; delay: number }) {
  const [hot, setHot] = useState(false);
  const paper = item.kind === "boring";
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
    backgroundColor: paper ? PAPER.bg : "var(--bg-card)",
    border: `1px solid ${
      paper ? PAPER.edge : hot && linked ? "var(--accent-dim)" : "var(--border)"
    }`,
    boxShadow: paper ? "0 10px 26px rgba(0,0,0,0.45)" : "none",
    fontFamily: paper ? "var(--font-display)" : undefined,
    transform: hot && linked ? "translateY(-2px)" : "translateY(0)",
    transition: "border-color 0.25s ease, transform 0.25s ease",
  };

  const inset = item.image ? { paddingLeft: "1.4rem", paddingRight: "1.4rem" } : undefined;

  const body = (
    <>
      {item.image && (
        <div
          style={{
            aspectRatio: "16/9",
            overflow: "hidden",
            marginBottom: "1.1rem",
            backgroundColor: "var(--bg-alt)",
            borderBottom: `1px solid ${paper ? PAPER.edge : "var(--border)"}`,
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
        <span style={{ color: paper ? PAPER.label : "var(--accent)" }}>
          {item.tag}
        </span>
        {item.year && (
          <span
            style={{
              color: paper ? PAPER.label : "var(--text-muted)",
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
          color: paper ? PAPER.ink : "var(--text)",
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
            color: paper ? PAPER.soft : "var(--text-muted)",
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
  const [boring, setBoring] = useState(false);

  const cool = items.filter((i) => i.kind === "cool");
  const shown = boring
    ? interleave(cool, items.filter((i) => i.kind === "boring"))
    : cool;

  return (
    <>
      <BlurFade delay={0.24}>
        <button
          type="button"
          onClick={() => setBoring((v) => !v)}
          aria-pressed={boring}
          style={{
            marginTop: "2.25rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.7rem 1.1rem",
            border: `1px solid ${boring ? "var(--accent-dim)" : "var(--border)"}`,
            borderRadius: 3,
            background: boring ? "rgba(201,168,76,0.09)" : "transparent",
            cursor: "pointer",
            textAlign: "left",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "relative",
              width: 34,
              height: 18,
              borderRadius: 999,
              border: `1px solid ${boring ? "var(--accent)" : "var(--border)"}`,
              background: boring ? "var(--accent)" : "transparent",
              flexShrink: 0,
              transition: "background 0.2s ease, border-color 0.2s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: boring ? 17 : 2,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: boring ? "#17150f" : "var(--text-muted)",
                transition: "left 0.2s ease, background 0.2s ease",
              }}
            />
          </span>

          <span>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: boring ? "var(--text)" : "var(--text-muted)",
                transition: "color 0.2s ease",
              }}
            >
              Include the boring, but important stuff
            </span>
            <span
              style={{
                display: "block",
                marginTop: "0.25rem",
                fontSize: "0.78rem",
                fontStyle: "italic",
                color: "var(--text-muted)",
              }}
            >
              for recruiters, academics, and anyone deciding whether to work
              with me
            </span>
          </span>
        </button>
      </BlurFade>

      <div
        style={{
          marginTop: "3rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: "1.25rem",
          alignItems: "stretch",
        }}
      >
        {shown.map((item, i) => (
          <Tile key={item.slug} item={item} delay={0.06 + i * 0.05} />
        ))}
      </div>
    </>
  );
}
