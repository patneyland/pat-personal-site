"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  claimConversation,
  F,
  GaryConversation,
  useGary,
} from "@/components/ui/GaryChat";
import ThoughtBubble from "@/components/ui/ThoughtBubble";
import {
  fitWidth,
  H_MIN,
  placeBubble,
  rollDraw,
  type Bounds,
  type BubbleMode,
  type Draw,
} from "@/lib/bubblePlacement";

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
 * He speaks for himself. He used to hand the conversation to the corner panel
 * instead, and that panel is pinned to the bottom-right of the viewport with a
 * trail that only ever knew which SIDE of the screen he was on. So the words
 * came out of the corner of the window while he stood at the top of the page,
 * and the trail pointed off into empty margin. A thought bubble that is not
 * attached to the thinker is a chat widget with scalloped edges, which is the
 * one thing this drawing exists not to be. He now does what /fun and /story
 * do: roll a drawing, measure where he actually is on screen, and hand both to
 * `placeBubble`, which puts the box where it fits and stops the last puff of
 * the trail beside his mouth.
 *
 * Nothing in here is a clearance number and nothing should become one. This
 * file supplies only what is its own: his rectangle, and the edges he has to
 * respect. See the header of src/lib/bubblePlacement.ts.
 *
 * The sprite is the same two-pose facing sheet /fun uses when he stops to
 * talk. Only the white sheet, no `-solid` companion: that second layer exists
 * so he can knock a hole in the house behind him on /fun, and there is nothing
 * behind him here.
 */

/* Measured off gary-facing.png: two poses in a 114x144 cell. */
const CELL_W = 114;
const CELL_H = 144;

/* Where his mouth is inside one cell, as a fraction of the cell, and how far
   off it the trail's column has to run to pass his cheek instead of his face.
   Measured off the same sheet GaryPacing measured, and the numbers agree with
   it by construction rather than by import: both sheets are drawn from one
   source at one scale, so a single pair of fractions covers him standing and
   walking alike. The measurement and the reasoning are written out in
   GaryPacing.tsx. If the drawing is redrawn, re-measure in both places. */
const MOUTH_X = 61 / 114;
const MOUTH_Y = 77 / 144;
const MOUTH_CLEAR_X = 36;

/** Same conversation size as /fun, /story and the corner panel. */
const CHAT_W = 480;
const CHAT_H = Math.round((CHAT_W * 9) / 16);
/** The sticky nav is 54px tall. The painted drawing stays below it. */
const NAV_H = 54;

/** His box on screen, in viewport coordinates. */
type Anchor = { x: number; top: number; bottom: number };

export default function GaryStanding({
  /* 72 is his display height on /fun. Same character, same size, so he does
     not read as a different Gary from page to page. */
  height = 72,
  title = "Ask Gary about this site",
}: {
  height?: number;
  title?: string;
}) {
  const { enabled, open, setOpen } = useGary();
  const btn = useRef<HTMLButtonElement>(null);
  const [hot, setHot] = useState(false);
  /* Only the opener takes focus back, so a panel opened on another page and
     carried here does not yank focus when it closes. */
  const opener = useRef(false);

  /* Where he is, republished while the chat is open so scrolling the page
     moves the bubble in step with him instead of leaving it behind. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const mode = useRef<BubbleMode | null>(null);

  /* One drawing per open, rolled here rather than inside ThoughtBubble,
     because the placement needs the trail's true reach before the bubble
     exists: variant and wobble go into the placement for measuring and are
     handed down so the bubble draws exactly the shape that was measured. */
  const [draw, setDraw] = useState<Draw | null>(null);

  /* The corner panel is the fallback for pages with no Gary on them. He is on
     this one, so he takes the conversation and the panel stands down. */
  useEffect(() => {
    if (!open) return;
    return claimConversation();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraw(null);
      setAnchor(null);
      mode.current = null;
      return;
    }
    setDraw(rollDraw());

    /* Read per frame rather than on scroll and resize. He sits in normal flow
       inside a BlurFade, so he moves for reasons no single event covers: the
       reveal transition finishing, an image landing above him, a webfont
       swapping in. This is one getBoundingClientRect of one element per frame,
       and only while the chat is open. */
    let raf = 0;
    let last = "";
    const tick = () => {
      const el = btn.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}`;
        if (key !== last) {
          last = key;
          setAnchor({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  /* Close returns focus to him. Without this it lands on <body> and the next
     Tab restarts from the top of the document. */
  useEffect(() => {
    if (!open && opener.current) {
      opener.current = false;
      btn.current?.focus();
    }
  }, [open]);

  /* Escape closes him, the same key that closed the panel he replaced. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  /* content/gary.md has no voice in it, so there is nobody to talk to. */
  if (!enabled) return null;

  const width = height * (CELL_W / CELL_H);

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

        Gone once he is saying it. The real trail leaves his mouth then, and
        two sets of puffs coming off one man at once reads as a drawing
        mistake rather than as a thought.
      */}
      {!open && (
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
                opacity: hot ? 0.95 : 0.4,
                transition: "opacity 0.25s ease",
                pointerEvents: "none",
              }}
            />
          ))}
        </span>
      )}

      <button
        ref={btn}
        type="button"
        data-gary
        onClick={() => {
          opener.current = true;
          setOpen(!open);
        }}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
        title={title}
        aria-label={title}
        aria-expanded={open}
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
               reads as a broken GIF; a long hold with an occasional gesture
               reads as alive. Named keyframes rather than steps() for that
               reason, and those keyframes cut with step-end rather than
               sliding the sheet across the cell: see gary-idle in globals.css,
               which is where the tear came from. */
            animation: "gary-idle 4s infinite",
            "--gary-w": `${width}px`,
          } as React.CSSProperties
        }
      />

      <Bubble
        open={open}
        anchor={anchor}
        draw={draw}
        height={height}
        width={width}
        mode={mode}
        onClose={() => setOpen(false)}
      />
    </span>
  );
}

/**
 * The conversation, coming off him.
 *
 * Fixed-position and portalled to the body, for the reason StoryGary is:
 * his ancestors carry transforms (BlurFade), a transformed ancestor becomes
 * the containing block for a fixed child, so a bubble left in the tree would
 * re-anchor itself to the card grid and be clipped by it. Everything here is
 * in viewport coordinates, which is the space getBoundingClientRect reports
 * in and the space the portal paints in, so no conversion is needed.
 *
 * Its own component so the placement runs only while he is talking. The
 * measuring is pure and cheap, but it reads window, and the parent renders on
 * every hover.
 */
function Bubble({
  open,
  anchor,
  draw,
  height,
  width,
  mode,
  onClose,
}: {
  open: boolean;
  anchor: Anchor | null;
  draw: Draw | null;
  height: number;
  width: number;
  mode: React.MutableRefObject<BubbleMode | null>;
  onClose: () => void;
}) {
  if (!open || !anchor || !draw || typeof document === "undefined") return null;

  /* The painted drawing may use the whole viewport below the sticky nav. */
  const bounds: Bounds = {
    left: 0,
    right: window.innerWidth,
    top: NAV_H,
    bottom: window.innerHeight,
  };

  const placed = placeBubble({
    speaker: {
      x: anchor.x,
      top: anchor.top,
      bottom: anchor.bottom,
      /* His cell is 114 wide in 144, so half of him is 0.396 of his height.
         0.42 rounds that up a hair so the side-mode margin is honest against
         his arms and not just his centre line, the same allowance /story
         makes. */
      halfW: height * 0.42,
      /* The smile, not the top of his head. Without this the trail aims at
         his scalp going down and at his shoes coming up, and stops short of
         whichever it hit; with it the puffs step sideways past his cheek and
         the last one arrives level with the mouth the words are coming out
         of. */
      mouth: {
        x: anchor.x - width / 2 + width * MOUTH_X,
        y: anchor.top + height * MOUTH_Y,
        clearX: MOUTH_CLEAR_X,
      },
    },
    draw,
    w: fitWidth(CHAT_W, bounds),
    hMax: CHAT_H,
    hMin: H_MIN,
    bounds,
    prev: mode.current,
  });
  mode.current = placed.mode;

  return createPortal(
    <ThoughtBubble
      role="dialog"
      ariaLabel="Chat with Gary"
      tail={placed.tail}
      tailX={placed.tailX}
      variant={draw.variant}
      wobble={draw.wobble}
      style={{
        position: "fixed",
        zIndex: 50,
        left: placed.left,
        top: placed.top,
        width: placed.w,
        height: placed.h,
      }}
    >
      <header
        className="flex items-center justify-between"
        style={{ paddingBottom: "0.35rem" }}
      >
        <span
          style={{
            color: F.ink,
            fontFamily: "var(--font-hand)",
            fontSize: "1.15rem",
            lineHeight: 1,
          }}
        >
          Gary
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ color: F.inkFaint, fontSize: "1rem", lineHeight: 1 }}
        >
          &times;
        </button>
      </header>
      <GaryConversation />
    </ThoughtBubble>,
    document.body,
  );
}
