"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowRight } from "lucide-react";

/**
 * The shape both the portfolio and the garden are laid out in.
 *
 * One uniform grid. Every entry is the same tile at the same size, and the
 * rows line up.
 *
 * This has moved twice in a day, so the reasoning matters more than the
 * conclusion. It began as a uniform grid, went to a newspaper hierarchy on
 * 2026-09-04 (one lead at full width, two-column standards, an index line for
 * anything with no writing behind it), and came back to uniform the same day
 * at Patrick's direction: he wants the tiles all one size, as they were.
 *
 * The trade he accepted, stated plainly so nobody reopens it by accident: an
 * equal-height tile with no image gets padded out to match a taller neighbour
 * that has one, and the page cannot say which project matters most. The
 * hierarchy version is in the history if it is ever wanted back.
 *
 * The two districts differ in colour and nothing else. That is deliberate, and
 * it is the site's whole argument about coherence.
 */

export type Card = {
  key: string;
  /** The one uppercase label an item gets. A category, or null. */
  eyebrow: string | null;
  /** Year, or the date last tended. Sits opposite the eyebrow. */
  meta: string | null;
  title: string;
  /** Rendered markdown. Takes precedence over blurbText. */
  blurbHtml: string | null;
  blurbText: string | null;
  href: string | null;
  /** Internal routes use next/link rather than opening a new tab. */
  internal: boolean;
  /** Whether the tile shows its arrow. The wording went on 2026-09-05. */
  cta: boolean;
  image: string | null;
  /** Optional mark set before the title. The garden's, per Patrick's ask. */
  mark?: React.ReactNode;
};

export type CardTheme = {
  accent: string;
  /** Resting border on a card. */
  edge: string;
  /** Border once the pointer is on it. */
  edgeHot: string;
  ink: string;
  inkSoft: string;
  surface: string;
  surfaceHot: string;
};

/* One label size, one tracking, used everywhere a stamp appears. The pages
   used to carry five sizes between them, none chosen relative to another. */
const STAMP: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.63rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

/** True when the category just repeats the title, as with "Trivia / TRIVIA". */
function sameAsTitle(card: Card) {
  return (
    card.eyebrow != null &&
    card.eyebrow.trim().toLowerCase() === card.title.trim().toLowerCase()
  );
}

const BLURB: React.CSSProperties = {
  marginTop: "0.7rem",
  fontSize: "0.9rem",
  lineHeight: 1.7,
  textWrap: "pretty",
};

function Tile({
  card,
  theme,
  delay,
}: {
  card: Card;
  theme: CardTheme;
  delay: number;
}) {
  const [hot, setHot] = useState(false);
  const live = hot && Boolean(card.href);
  const eyebrow = sameAsTitle(card) ? null : card.eyebrow;
  /* One arrow for every tile. It used to be ArrowUpRight for anything
     off-site, which meant a row of tiles carried two different marks and
     "Read it" sat beside "Read it elsewhere". Patrick asked for one mark and
     no wording on 2026-09-05: where a tile goes is the tile's business, not a
     thing the reader should have to decode from a glyph. */
  const Arrow = ArrowRight;

  const shell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    /* Fills the stretched grid cell, which is what makes every row line up. */
    height: "100%",
    padding: "1.3rem 1.4rem 1.5rem",
    borderRadius: 6,
    textDecoration: "none",
    backgroundColor: live ? theme.surfaceHot : theme.surface,
    border: `1px solid ${live ? theme.edgeHot : theme.edge}`,
    transition: "border-color 0.25s ease, background-color 0.25s ease",
  };

  const body = (
    <>
      {/* Every tile carries this block, image or not. An entry with nothing to
          show used to skip it and sit shorter than its neighbours, which is
          what the flex spacer below was invented to paper over. A placeholder
          is the honest version: the tile is the same shape either way, and the
          mark says "this one is writing" rather than pretending a picture is
          missing. Patrick's woodworking photos replace one of these shortly. */}
      <div
        style={{
          aspectRatio: "16/9",
          overflow: "hidden",
          borderRadius: 3,
          marginBottom: "1.1rem",
          backgroundColor: "var(--bg-alt)",
          display: card.image ? undefined : "grid",
          placeItems: card.image ? undefined : "center",
        }}
      >
        {card.image ? (
          <img
            src={card.image}
            alt={card.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ opacity: 0.4 }}
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M9 12.5h6M9 16h6" />
          </svg>
        )}
      </div>

      {(eyebrow || card.meta) && (
        <div
          style={{
            ...STAMP,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <span style={{ color: theme.accent }}>{eyebrow}</span>
          {card.meta && (
            <span
              style={{
                color: theme.inkSoft,
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {card.meta}
            </span>
          )}
        </div>
      )}

      <h3
        style={{
          marginTop: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontFamily: "var(--font-heading)",
          fontSize: "1.15rem",
          fontWeight: 600,
          lineHeight: 1.3,
          color: theme.ink,
          textWrap: "balance",
        }}
      >
        {card.mark && (
          <span style={{ color: theme.accent, display: "flex" }}>
            {card.mark}
          </span>
        )}
        {card.title}
      </h3>

      {card.blurbHtml ? (
        <div
          className="tile-blurb"
          style={{ ...BLURB, color: theme.inkSoft }}
          dangerouslySetInnerHTML={{ __html: card.blurbHtml }}
        />
      ) : card.blurbText ? (
        <p style={{ ...BLURB, color: theme.inkSoft }}>{card.blurbText}</p>
      ) : null}

      {/* Holds the link at the bottom, so a row of tiles has its links on one
          line rather than wherever each blurb happened to end. */}
      <div style={{ flex: 1 }} />

      {card.cta && (
        <span
          style={{
            ...STAMP,
            marginTop: "1rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            color: hot ? theme.ink : theme.accent,
            transition: "color 0.2s ease",
          }}
        >
          <Arrow size={15} strokeWidth={1.5} />
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
      {card.href && card.internal ? (
        <Link href={card.href} style={shell} {...handlers}>
          {body}
        </Link>
      ) : card.href ? (
        <a
          href={card.href}
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

export default function CardLayout({
  cards,
  theme,
  aside,
}: {
  cards: Card[];
  theme: CardTheme;
  /**
   * Rendered right-aligned, standing on the rule above the grid. Gary, on the
   * pages he does not walk. With no lead card there is no rule of its own for
   * him to stand on, so this draws one.
   */
  aside?: React.ReactNode;
}) {
  return (
    <>
      {aside && (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {aside}
          </div>
          <div style={{ borderTop: `1px solid ${theme.edge}` }} />
        </div>
      )}

      <div className="card-grid" style={{ marginTop: aside ? "2rem" : "3rem" }}>
        {cards.map((card, i) => (
          <Tile
            key={card.key}
            card={card}
            theme={theme}
            delay={0.24 + i * 0.05}
          />
        ))}
      </div>
    </>
  );
}
