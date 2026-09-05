"use client";

import { useEffect, useRef, useState } from "react";
import { useGary } from "@/components/ui/GaryChat";

/**
 * Gary, standing, on the pages he does not walk.
 *
 * He was on two of four pages, and the two he was missing from are the two
 * that feel least like the rest of the site. Worse, his conversation could not
 * be *started* anywhere else: GaryPanel renders only once `open` is true, and
 * the only things that set it were GaryPacing on /fun and StoryGary on /story.
 * Follow a link off either page and the talk came with you; arrive anywhere
 * else cold and he was unreachable.
 *
 * Deliberately still. On /fun he paces and on /story he runs the polaroids,
 * because those pages are his. The portfolio and the garden have work to do,
 * so he stands at the end of the rule under the heading and waits to be
 * clicked. His energy scales down as the page gets more serious.
 *
 * He does not claim the conversation, so the corner panel presents it. He does
 * tell it he is standing, so its trail leaves on the side he is actually on.
 *
 * The sprite is the same two-pose facing sheet /fun uses when he stops to
 * talk. Only the white sheet, no `-solid` companion: that second layer exists
 * so he can knock a hole in the house behind him on /fun, and there is nothing
 * behind him here.
 */

/* Measured off gary-facing.png: two poses in a 114x144 cell. */
const CELL_W = 114;
const CELL_H = 144;

export default function GaryStanding({
  /* 72 is his display height on /fun. Same character, same size, so he does
     not read as a different Gary from page to page. */
  height = 72,
  title = "Ask Gary about this site",
}: {
  height?: number;
  title?: string;
}) {
  const { enabled, open, setOpen, setStanding } = useGary();
  const btn = useRef<HTMLButtonElement>(null);
  const [hot, setHot] = useState(false);
  /* Only the opener takes focus back, so a panel opened on another page and
     carried here does not yank focus when it closes. */
  const opener = useRef(false);

  /* Tell the panel which side of the screen he is on, for its trail. */
  useEffect(() => {
    setStanding(true);
    return () => setStanding(false);
  }, [setStanding]);

  /* Close returns focus to him. Without this it lands on <body> and the next
     Tab restarts from the top of the document. */
  useEffect(() => {
    if (!open && opener.current) {
      opener.current = false;
      btn.current?.focus();
    }
  }, [open]);

  /* content/gary.md has no voice in it, so there is nobody to talk to. */
  if (!enabled) return null;

  const width = height * (CELL_W / CELL_H);
  const lit = hot || open;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width,
        height,
        flexShrink: 0,
      }}
    >
      {/*
        The affordance, in the site's own language rather than a tooltip.
        Nothing else said he was interactive: he carried the same visual weight
        as the rule and the date stamp beside him, and `title` does not exist
        on a phone. Three puffs rising off his head are what ThoughtBubble
        already draws for a trail, so this reads as "he has something to say"
        with no UI chrome, and it works on touch.
      */}
      <span aria-hidden="true">
        {[
          { d: 3.5, x: 0.62, y: -0.11 },
          { d: 5, x: 0.72, y: -0.2 },
          { d: 7, x: 0.85, y: -0.32 },
        ].map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: width * p.x,
              top: height * p.y,
              width: p.d,
              height: p.d,
              borderRadius: "50%",
              border: "1.4px solid var(--gary-ink)",
              opacity: lit ? 0.95 : 0.4,
              transition: "opacity 0.25s ease",
              pointerEvents: "none",
            }}
          />
        ))}
      </span>

      <button
        ref={btn}
        type="button"
        data-gary
        onClick={() => {
          opener.current = true;
          setOpen(true);
        }}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
        title={title}
        aria-label={title}
        style={
          {
            width,
            height,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "block",
            backgroundImage: "url(/assets/gary-facing.png)",
            backgroundSize: `${width * 2}px ${height}px`,
            backgroundRepeat: "no-repeat",
            /* Asymmetric on purpose. An even two-pose swap is a metronome and
               reads as a broken GIF; a long hold with an occasional wave reads
               as alive. Named keyframes rather than steps() for that reason. */
            animation: "gary-idle 4s infinite",
            "--gary-w": `${width}px`,
          } as React.CSSProperties
        }
      />
    </span>
  );
}
