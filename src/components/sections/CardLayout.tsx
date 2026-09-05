"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowUpRight, ArrowRight } from "lucide-react";

/**
 * The shape both the portfolio and the garden are laid out in.
 *
 * Patrick's call, 2026-09-04: the two pages should be laid out the same and
 * differ only in colour. That is the site's whole argument about coherence
 * made literal, so it is built as one component rather than two that look
 * alike and drift apart by the third edit. A district supplies its cards and
 * its hue; nothing else about the shape is its to choose.
 *
 * The shape is a newspaper front page rather than a gallery:
 *
 *   lead      one at a time, full width, image large, blurb shown
 *   standard  two columns
 *   minor     a line in an index, no card, no image
 *
 * Which tier an item lands in is authored, not guessed. See lib/portfolio.ts.
 * Eight entries at identical size asserted they were all equally important,
 * which left the page with no argument to make.
 */

export type Weight = "lead" | "standard" | "minor";

export type Card = {
  key: string;
  weight: Weight;
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
  cta: string | null;
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

function Shell({
  card,
  style,
  children,
  onEnter,
  onLeave,
}: {
  card: Card;
  style: React.CSSProperties;
  children: React.ReactNode;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const handlers = { onMouseEnter: onEnter, onMouseLeave: onLeave };
  if (card.href && card.internal) {
    return (
      <Link href={card.href} style={style} {...handlers}>
        {children}
      </Link>
    );
  }
  if (card.href) {
    return (
      <a
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        {...handlers}
      >
        {children}
      </a>
    );
  }
  return <div style={style}>{children}</div>;
}

function Blurb({
  card,
  theme,
  size,
}: {
  card: Card;
  theme: CardTheme;
  size: string;
}) {
  const style: React.CSSProperties = {
    marginTop: "0.7rem",
    maxWidth: "38rem",
    fontSize: size,
    lineHeight: 1.7,
    color: theme.inkSoft,
    textWrap: "pretty",
  };
  if (card.blurbHtml) {
    return (
      <div
        className="tile-blurb"
        style={style}
        dangerouslySetInnerHTML={{ __html: card.blurbHtml }}
      />
    );
  }
  if (card.blurbText) return <p style={style}>{card.blurbText}</p>;
  return null;
}

/** True when the category just repeats the title, as with "Trivia / TRIVIA". */
function sameAsTitle(card: Card) {
  return (
    card.eyebrow != null &&
    card.eyebrow.trim().toLowerCase() === card.title.trim().toLowerCase()
  );
}

function StampRow({ card, theme }: { card: Card; theme: CardTheme }) {
  const eyebrow = sameAsTitle(card) ? null : card.eyebrow;
  if (!eyebrow && !card.meta) return null;
  return (
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
  );
}

function Cta({
  card,
  theme,
  hot,
}: {
  card: Card;
  theme: CardTheme;
  hot: boolean;
}) {
  if (!card.cta) return null;
  const External = card.internal ? ArrowRight : ArrowUpRight;
  return (
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
      {card.cta}
      <External size={13} strokeWidth={1.5} />
    </span>
  );
}

function Thumb({ card, radius }: { card: Card; radius: number }) {
  if (!card.image) return null;
  return (
    <div
      style={{
        aspectRatio: "16/9",
        overflow: "hidden",
        borderRadius: radius,
        backgroundColor: "var(--bg-alt)",
      }}
    >
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
    </div>
  );
}

function Lead({ card, theme }: { card: Card; theme: CardTheme }) {
  const [hot, setHot] = useState(false);
  return (
    <BlurFade delay={0.24}>
      <Shell
        card={card}
        onEnter={() => setHot(true)}
        onLeave={() => setHot(false)}
        style={{
          display: "block",
          textDecoration: "none",
          borderTop: `1px solid ${hot && card.href ? theme.edgeHot : theme.edge}`,
          paddingTop: "1.5rem",
          transition: "border-color 0.3s ease",
        }}
      >
        <StampRow card={card} theme={theme} />
        <h2
          style={{
            marginTop: "0.6rem",
            marginBottom: "1.2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.75rem, 4vw, 2.6rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
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
        </h2>
        <Thumb card={card} radius={4} />
        <Blurb card={card} theme={theme} size="1rem" />
        <Cta card={card} theme={theme} hot={hot} />
      </Shell>
    </BlurFade>
  );
}

function Standard({
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
  return (
    <BlurFade delay={delay}>
      <Shell
        card={card}
        onEnter={() => setHot(true)}
        onLeave={() => setHot(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "1.3rem 1.4rem 1.5rem",
          borderRadius: 6,
          textDecoration: "none",
          backgroundColor: live ? theme.surfaceHot : theme.surface,
          border: `1px solid ${live ? theme.edgeHot : theme.edge}`,
          transition: "border-color 0.25s ease, background-color 0.25s ease",
        }}
      >
        {card.image && (
          <div style={{ marginBottom: "1.1rem" }}>
            <Thumb card={card} radius={3} />
          </div>
        )}
        <StampRow card={card} theme={theme} />
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
        <Blurb card={card} theme={theme} size="0.9rem" />
        <Cta card={card} theme={theme} hot={hot} />
      </Shell>
    </BlurFade>
  );
}

/**
 * A link with nothing written behind it is not a card, it is a line in a list.
 * Saying so removes the empty stretched tile the grid used to produce.
 */
function IndexLine({
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
  return (
    <BlurFade delay={delay}>
      <Shell
        card={card}
        onEnter={() => setHot(true)}
        onLeave={() => setHot(false)}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "1rem",
          padding: "0.85rem 0",
          borderTop: `1px solid ${theme.edge}`,
          textDecoration: "none",
        }}
      >
        {card.mark && (
          <span
            style={{
              color: theme.inkSoft,
              display: "flex",
              alignSelf: "center",
              opacity: 0.7,
            }}
          >
            {card.mark}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1rem",
            fontWeight: 500,
            color: live ? theme.accent : theme.ink,
            transition: "color 0.2s ease",
          }}
        >
          {card.title}
        </span>
        {card.eyebrow && !sameAsTitle(card) && (
          <span style={{ ...STAMP, color: theme.inkSoft, opacity: 0.8 }}>
            {card.eyebrow}
          </span>
        )}
        <span
          style={{
            ...STAMP,
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            flexShrink: 0,
            color: live ? theme.accent : theme.inkSoft,
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.2s ease",
          }}
        >
          {card.meta}
          {card.href &&
            (card.internal ? (
              <ArrowRight size={13} strokeWidth={1.5} />
            ) : (
              <ArrowUpRight size={13} strokeWidth={1.5} />
            ))}
        </span>
      </Shell>
    </BlurFade>
  );
}

export default function CardLayout({
  cards,
  theme,
  indexLabel,
  aside,
}: {
  cards: Card[];
  theme: CardTheme;
  /** Optional heading over the index, when the minor items need naming. */
  indexLabel?: string;
  /**
   * Rendered right-aligned directly on top of the first rule, so whatever it
   * is appears to stand on the line. Gary, on the pages he does not walk.
   */
  aside?: React.ReactNode;
}) {
  const leads = cards.filter((c) => c.weight === "lead");
  const standards = cards.filter((c) => c.weight === "standard");
  const minors = cards.filter((c) => c.weight === "minor");

  let delay = 0.3;
  const next = () => (delay += 0.05);

  /* He stands on the first rule on the page, whichever tier draws it. */
  const asideBlock = aside ? (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        /* His feet are flush with the bottom of the sprite cell, so the box
           bottom sitting on the rule puts him standing on it. */
        marginBottom: 0,
      }}
    >
      {aside}
    </div>
  ) : null;

  return (
    <>
      {leads.map((card, i) => (
        <div key={card.key} style={{ marginTop: i === 0 ? "3rem" : "3rem" }}>
          {i === 0 && asideBlock}
          <Lead card={card} theme={theme} />
        </div>
      ))}

      {standards.length > 0 && (
        <div className="card-grid-2" style={{ marginTop: "3rem" }}>
          {standards.map((card) => (
            <Standard
              key={card.key}
              card={card}
              theme={theme}
              delay={next()}
            />
          ))}
        </div>
      )}

      {leads.length === 0 && standards.length === 0 && asideBlock}

      {minors.length > 0 && (
        <div style={{ marginTop: "3.25rem" }}>
          {indexLabel && (
            <BlurFade delay={next()}>
              <p
                style={{
                  ...STAMP,
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  color: theme.inkSoft,
                  opacity: 0.7,
                  marginBottom: "0.5rem",
                }}
              >
                {indexLabel}
              </p>
            </BlurFade>
          )}
          {minors.map((card) => (
            <IndexLine
              key={card.key}
              card={card}
              theme={theme}
              delay={next()}
            />
          ))}
        </div>
      )}
    </>
  );
}
