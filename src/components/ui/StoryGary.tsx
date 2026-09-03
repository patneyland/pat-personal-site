"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Character } from "@/lib/character/player";
import {
  useGary,
  claimConversation,
  GaryConversation,
  F,
} from "@/components/ui/GaryChat";
import ThoughtBubble from "@/components/ui/ThoughtBubble";
import {
  buildBubbleShape,
  tailReach,
  VARIANT_COUNT,
} from "@/lib/bubbleShape";
import {
  buildRoute,
  measurePlatforms,
  pacePose,
  restingPose,
  sampleRoute,
  type Platform,
  type Route,
} from "@/lib/character/route";

const MANIFEST = "/assets/character/character.json";

/**
 * The cards he crosses, in order. Anything not listed he flies over.
 *
 * `presenting` is deliberately left off: it sits in the same row as `neyland`,
 * so a hop between them would have no scroll to happen in.
 *
 * The torn note is on, and it has to be. It is the last thing still on screen
 * when the page bottoms out, so it is the only surface he can finish on
 * without sliding up behind the nav bar. It also happens to be the right
 * ending: he crosses the whole career and lands on the real stuff.
 */
export const ROUTE_KEYS = [
  "graduation",
  "masters",
  "fiscalsim",
  "asu",
  "neyland",
  "realstuff",
];

/* ── Talking to him ──────────────────────────────────────────────────────
   The numbers the bubble is placed with. The bubble itself is the same
   ThoughtBubble the /fun conversation uses; only the placement is new,
   because here he can be anywhere on a scrolling board rather than on one
   fixed track. */

/** Same conversation size as /fun and the corner panel. */
const CHAT_W = 480;
const CHAT_H = Math.round((CHAT_W * 9) / 16);
/** Gap between the trail's last puff and his ink. 12px is the clearance the
    approved drawing already had in the common case (the old fixed 78px gap
    minus the ~66px a typical trail reaches), so the spacing Pat liked is
    kept; it also swallows his drop shadow (up to ~6px of blur) and the
    integer rounding of the published anchor, with room to spare, while
    staying under one head-height so the trail still reads as attached. The
    trail's own length is no longer budgeted here: it is measured off the
    actual drawing (tailReach) per open, so a short-trailed recipe stands
    close to him and a long-trailed one further out, and neither touches. */
const MARGIN = 12;
/** The chat box will shrink this far to stay out of pinned mode: header,
    a couple of lines and the input still fit at 160. A shorter bubble
    above or below him beats a full-size one clamped over the top of him,
    which is what pinned used to do on short windows. */
const H_MIN = 160;
/** His head centre sits about 15% below the top of the drawn figure. The
    side-mode trail exits at this height so it points at his head, and the
    above mode stops the last puff MARGIN short of the figure's top. */
const HEAD_FRAC = 0.85;
/** Pinned only: minimum sideways offset between the trail column and his
    centre line when the trail cannot stop short of him. His half-width is
    garyH * 0.42 (~28px), the fattest puff adds ~15px with its stroke, and
    the puffs drift up to ~5px sideways, so 48 keeps every puff clear of
    his figure while staying as close as the guarantee allows. */
const PINNED_CLEAR_X = 48;
/* ── The painted bleed ───────────────────────────────────────────────────
   The clamp below keeps the bubble's LAYOUT BOX inside the viewport, but
   ThoughtBubble's SVG is overflow:visible and the drawing reaches past that
   box, so the box has to stay clear of the edges by the drawing's worst
   reach, not by a flat margin. Both numbers are derived from the caps in
   src/lib/bubbleShape.ts and were checked against 960k generated shapes
   (worst lobe 42.7, worst tail 131.2). If that generator's caps change,
   re-derive these.

   A lobe past the box edge: valley jitter (6 x wobble, wobble <= 1.2, so
   7.2) plus the cubic's bulge (control offset k <= 46, and a cubic with
   both controls at k peaks at 3/4 of k, so 34.5) plus half the heaviest
   stroke (2.4 / 2): 7.2 + 34.5 + 1.2 = 42.9. */
const LOBE_BLEED = 44;
/* The trail hangs much further past the box on the side it leaves:
   tailStart (a lobe's reach + 3, so 44.7) plus up to four puffs (unit
   u <= 26; radii u * (0.42 - 0.1 * i) * 1.15 with gaps of 8, so 87.0)
   plus the last puff's rotated rx (4.4) and its stroke (0.8): 136.9.

   This is the CAP across every recipe and seed, and it is used only where
   a worst case is the right number: sizing `h` so the viewport clamps
   below stay satisfiable whatever gets drawn. The clamps themselves, and
   all of the placement against Gary, use the REAL reach of the drawing
   being made (tailReach over the same buildBubbleShape call the bubble
   will render), which tops out at this figure by construction. */
const TAIL_BLEED = 138;
/** The sticky nav is 54px tall. */
const NAV_H = 54;
/** The box top stays below the nav by the lobes' reach, so the drawing
    neither paints over the nav nor gets sliced under it. */
const NAV_SAFE = NAV_H + LOBE_BLEED;
/** How long he takes to rejoin the route if the reader scrolled while the
    chat was open. */
const BLEND_MS = 450;

type BubbleMode = "above" | "below" | "left" | "right" | "pinned";
type TailSide = "up" | "down" | "left" | "right";

/** His feet, in viewport coordinates, while he is stopped for a chat. */
type Anchor = { gx: number; gy: number };

/** The drawing being made this open: which recipe and which wobble seed.
    Rolled once per open and held, so placement and rendering agree on one
    shape and nothing re-rolls mid-conversation. */
type Draw = { variant: number; wobble: number };

/**
 * Where the bubble goes, given where he is frozen on screen.
 *
 * Deterministic, and sticky on purpose: `prev` is whatever was chosen last
 * time, and it is kept for as long as it still fits, so a reader scrolling
 * around the threshold does not get a bubble that flips back and forth on
 * every wheel tick. Preference order when a fresh choice is needed: above his
 * head, below his feet, beside him, and finally pinned inside the viewport
 * with the tail pointing at wherever he is.
 *
 * The trail is one drawn gesture everywhere: it leaves the box off the edge
 * that faces him, runs toward him, and its last puff stops MARGIN short of
 * his ink. The clearance is the measured reach of the trail actually being
 * drawn (tailReach over the same pure buildBubbleShape call the bubble
 * renders), never a worst-case constant, so the bubble stands as close to
 * him as this particular recipe allows. In the side modes the trail leaves
 * the side edge at his head height and points straight at his head; the old
 * behaviour, a top/bottom exit aimed at nothing, is what put puffs on his
 * face.
 *
 * The final clamp is unconditional, which is what guarantees the box is never
 * clipped by the viewport or hidden behind the nav even when he has been
 * scrolled clean off the screen.
 */
function placeBubble(
  a: Anchor,
  garyH: number,
  vw: number,
  vh: number,
  prev: BubbleMode | null,
  draw: Draw,
): {
  left: number;
  top: number;
  w: number;
  h: number;
  tail: TailSide;
  tailX: number;
  mode: BubbleMode;
} {
  const w = Math.min(CHAT_W, vw - 2 * LOBE_BLEED);
  /* The vertical budget reserves TAIL_BLEED, the cap across every recipe,
     for whichever end the trail turns out to leave. Both cases cost the
     same: nav + lobes above and tail below, or nav + tail above and lobes
     below, both come to NAV_SAFE + TAIL_BLEED. Sizing by the cap rather
     than the live reach keeps `h` stable across opens and keeps the
     viewport clamps at the bottom satisfiable for any drawing. */
  const hMax = Math.min(CHAT_H, vh - NAV_SAFE - TAIL_BLEED);
  /* His half-width. The idle sprite's box is 114 x 144, so at height 66 he
     measures 54 wide on screen, 27 a side; 0.42 rounds up a hair so the
     side-mode margin is honest against his arms, not just his centre. */
  const halfGary = garyH * 0.42;
  const headTop = a.gy - garyH;
  const headY = a.gy - garyH * HEAD_FRAC;

  const reachOf = (along: number, side: TailSide, hh: number) =>
    tailReach(buildBubbleShape(w, hh, draw.variant, draw.wobble, along, side));

  /* The true painted reach of THIS drawing's trail, per exit edge. The
     along-edge coordinate is settled before the perpendicular offset is
     chosen, so there is no circularity: for the vertical modes, left (and
     so tailX) depends only on his x; for the side modes, top (and so the
     exit height) depends only on his head's y. */
  const vLeft = Math.max(
    LOBE_BLEED,
    Math.min(a.gx - w / 2, vw - LOBE_BLEED - w),
  );
  const vTailX = Math.max(24, Math.min(a.gx - vLeft, w - 24));
  const reachDown = reachOf(vTailX, "down", hMax);
  const reachUp = reachOf(vTailX, "up", hMax);

  const sTop = Math.max(
    NAV_SAFE,
    Math.min(headY - hMax / 2, vh - LOBE_BLEED - hMax),
  );
  const sTailY = Math.max(24, Math.min(headY - sTop, hMax - 24));
  const reachRight = reachOf(sTailY, "right", hMax);
  const reachLeft = reachOf(sTailY, "left", hMax);

  /* The room above his head, and below his feet, that a box plus its own
     trail plus MARGIN must fit into. */
  const availAbove = headTop - MARGIN - NAV_SAFE;
  const availBelow = vh - LOBE_BLEED - (a.gy + MARGIN);

  /* The tallest box (full height first, then 20px steps down to H_MIN)
     whose OWN trail still fits the available run: the reach is recomputed
     at each candidate height because the scallop walk re-deals when the
     box changes, so reach is not continuous in h and a smooth solve could
     oscillate; a fixed ladder always settles, and the accepted pair is
     self-consistent with what gets drawn. This is what keeps him visible
     on short windows: a slightly shorter bubble above or below him instead
     of a full-size one pinned over the top of him. */
  const solveH = (avail: number, side: TailSide) => {
    let hc = hMax;
    for (;;) {
      const r = reachOf(vTailX, side, hc);
      if (avail >= r + hc) return { h: hc, r };
      if (hc <= H_MIN) return null;
      hc = Math.max(H_MIN, hc - 20);
    }
  };
  const above = solveH(availAbove, "down");
  const below = solveH(availBelow, "up");

  const fits: Record<Exclude<BubbleMode, "pinned">, boolean> = {
    above: above !== null,
    below: below !== null,
    left: a.gx - halfGary - MARGIN - reachRight - w >= LOBE_BLEED,
    right: a.gx + halfGary + MARGIN + reachLeft + w <= vw - LOBE_BLEED,
  };

  /* Preference when a fresh choice is needed: a full-height box above,
     then below, then beside him; only then a shrunken box (the taller of
     the two), and pinned last of all. */
  let mode: BubbleMode;
  if (prev && prev !== "pinned" && fits[prev]) mode = prev;
  else if (above && above.h === hMax) mode = "above";
  else if (below && below.h === hMax) mode = "below";
  else if (fits.left || fits.right) {
    // The side with more room, so he is never squeezed against an edge.
    mode =
      a.gx > vw / 2 && fits.left ? "left" : fits.right ? "right" : "left";
  } else if (above || below) {
    mode = above && (!below || above.h >= below.h) ? "above" : "below";
  } else mode = "pinned";

  let left: number;
  let top: number;
  let h: number;
  let tail: TailSide;
  let tailX: number;
  let reach: number;
  switch (mode) {
    case "above":
      /* Trail off the bottom, straight down at his head: the last puff's
         far edge lands MARGIN above the top of his figure. */
      left = vLeft;
      h = above ? above.h : hMax;
      reach = above ? above.r : reachDown;
      top = headTop - MARGIN - reach - h;
      tail = "down";
      tailX = vTailX;
      break;
    case "below":
      /* Trail off the top, rising at him along his centre line. It stops
         MARGIN below his feet: his body is in the way of his head from
         down here, so short of the figure is as close as it can point. */
      left = vLeft;
      h = below ? below.h : hMax;
      reach = below ? below.r : reachUp;
      top = a.gy + MARGIN + reach;
      tail = "up";
      tailX = vTailX;
      break;
    case "left":
      /* Beside him on his left, trail off the box's RIGHT edge at his head
         height, running horizontally at his head. halfGary keeps the last
         puff clear of his arms as well as his face. */
      left = a.gx - halfGary - MARGIN - reachRight - w;
      top = sTop;
      h = hMax;
      tail = "right";
      tailX = sTailY;
      reach = reachRight;
      break;
    case "right":
      left = a.gx + halfGary + MARGIN + reachLeft;
      top = sTop;
      h = hMax;
      tail = "left";
      tailX = sTailY;
      reach = reachLeft;
      break;
    case "pinned":
      left = vLeft;
      h = hMax;
      top = headTop - MARGIN - reachDown - h;
      tail = "down"; // settled properly after the clamps below
      tailX = vTailX;
      reach = reachDown;
      break;
  }

  left = Math.max(LOBE_BLEED, Math.min(left, vw - LOBE_BLEED - w));
  top = Math.max(NAV_SAFE, Math.min(top, vh - LOBE_BLEED - h));

  if (mode === "pinned") {
    /* Nothing fits, or he is off the screen. The trail still leaves the
       edge that faces him and aims at his x. */
    tail = headY >= top + h / 2 ? "down" : "up";
    reach = tail === "down" ? reachDown : reachUp;

    /* But pinned means the gap to him may be shorter than the trail, and
       a trail that cannot stop short of him must not cross his face. If
       he is on screen and too close, the trail dodges sideways: same
       edge, still running his way, but down a column at least
       PINNED_CLEAR_X off his centre line, so every puff passes beside
       him. A trail landing next to his head still reads as his; one on
       his face does not. Off screen there is no face, and the straight
       aim is kept. */
    const visible =
      a.gx > -halfGary && a.gx < vw + halfGary && a.gy > 0 && headTop < vh;
    const room = tail === "down" ? headTop - (top + h) : top - a.gy;
    if (visible && room < reach + MARGIN) {
      const c = a.gx - left;
      const lo = c - PINNED_CLEAR_X;
      const hi = c + PINNED_CLEAR_X;
      /* The nearer allowed column that still exists inside the box. */
      if (lo >= 24 && hi <= w - 24) tailX = c >= w / 2 ? lo : hi;
      else if (lo >= 24) tailX = lo;
      else if (hi <= w - 24) tailX = hi;
      tailX = Math.max(24, Math.min(tailX, w - 24));
      reach = reachOf(tailX, tail, h);
    }
  }

  /* The painted trail must stay inside the viewport and clear of the nav,
     by the reach of the drawing actually being made. Satisfiable by
     construction: the sizing of `h` reserves TAIL_BLEED (the cap over
     every recipe, >= any reach) on the trail side, and the side modes are
     only chosen when the horizontal budget already covers their reach. */
  if (tail === "down") top = Math.min(top, vh - reach - h);
  else if (tail === "up") top = Math.max(top, NAV_H + reach);
  else if (tail === "right") left = Math.min(left, vw - reach - w);
  else left = Math.max(left, reach);

  return { left, top, w, h, tail, tailX, mode };
}

export interface StoryGaryProps {
  /** The board the polaroids live in. He is appended to it. */
  board: HTMLElement | null;
  /** Height on screen, in px. */
  height?: number;
  /** Below this viewport width the cards stack and he stays away. */
  minWidth?: number;
  /** Bump to re-measure: images loading, reveals settling, a layout change. */
  version?: number;
  /** Draw the surfaces and the arcs he is following. */
  debug?: boolean;
  /** Overrides for the numbers worth arguing about, from the lab. */
  strides?: Record<string, number>;
  onSample?: (info: { clip: string; dir: number; scroll: number }) => void;
}

/**
 * Gary crossing the story board.
 *
 * He is appended to the board rather than rendered into it, so the board's own
 * markup does not have to know he exists. Everything he does comes out of
 * `route.ts`; the only thing this file decides is which way the reader is
 * travelling, because that is the one fact scroll position alone cannot tell
 * you.
 *
 * And, since the chat, whether he is doing any of that at all. While the
 * conversation is open he is out of the route's hands entirely: frozen where
 * he was, turned to face the reader, with the thought bubble coming off him,
 * exactly the way he stops on /fun. The route takes him back when it closes.
 */
export default function StoryGary({
  board,
  height = 66,
  minWidth = 720,
  version = 0,
  debug = false,
  strides,
  onSample,
}: StoryGaryProps) {
  /* He is clickable here too, but the chat is not what this file is about, so
     the handler is held in a ref. Putting setOpen in the effect's dependencies
     would tear down and rebuild the whole crossing every time the chat opened
     or closed, which would drop him back at the start of the board. The same
     goes for `open` itself: the animation loop reads it through a ref every
     frame instead of depending on it. */
  const { enabled, open, setOpen } = useGary();
  const talk = useRef<() => void>(() => {});
  talk.current = () => setOpen(!open);
  const openRef = useRef(false);
  openRef.current = open;

  /* Where his feet are on screen while he is stopped for a chat. Published by
     the animation loop, consumed by the bubble below. Null while he walks. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorSet = useRef(setAnchor);
  anchorSet.current = setAnchor;
  const bubbleMode = useRef<BubbleMode | null>(null);

  /* One drawing per open, rolled HERE rather than inside ThoughtBubble,
     because the placement needs the trail's true reach before the bubble
     exists: variant and wobble go into buildBubbleShape for measuring and
     are handed down so the bubble draws exactly the shape that was
     measured. Cleared on close, so the next open is a fresh drawing and a
     fresh placement. `?bubble=N` (0..3) pins the recipe and `?wobble=N`
     the seed, for eyeballing every recipe deliberately. */
  const [draw, setDraw] = useState<Draw | null>(null);
  useEffect(() => {
    if (!open) {
      setDraw(null);
      bubbleMode.current = null;
      return;
    }
    const q = new URLSearchParams(window.location.search);
    const v = q.get("bubble") === null ? NaN : Number(q.get("bubble"));
    const s = q.get("wobble") === null ? NaN : Number(q.get("wobble"));
    setDraw({
      variant:
        Number.isInteger(v) && v >= 0 && v < VARIANT_COUNT
          ? v
          : Math.floor(Math.random() * VARIANT_COUNT),
      wobble: Number.isInteger(s) ? s | 0 : (Math.random() * 0x7fffffff) | 0,
    });
  }, [open]);

  useEffect(() => {
    if (!board) return;
    const talkable = enabled;

    /* Narrow layouts stack every polaroid into one column. The hops would be
       vertical drops down a corridor barely wider than he is, which is not the
       thing Patrick drew, so he simply is not there. */
    if (window.innerWidth < minWidth) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let alive = true;
    let raf = 0;
    let char: Character | null = null;
    let route: Route | null = null;
    let platforms: Platform[] = [];
    let release: (() => void) | null = null;

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:5;color:var(--fg,#EDEDE8)";
    board.append(layer);

    let svg: SVGSVGElement | null = null;
    if (debug) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText =
        "position:absolute;inset:0;pointer-events:none;z-index:4;overflow:visible";
      board.append(svg);
    }

    /* The one thing that is remembered. Gait counts distance without a sign,
       so his legs cycle forwards even when the reader is going back up the
       page and his body is retracing its steps. Feed it signed distance and
       he moonwalks. */
    let gait = 0;
    let lastDist: number | null = null;
    let lastScroll = window.scrollY;
    let facing = 1;
    let dirty = true;
    /* Milliseconds he has been standing on the last surface. The reader has
       stopped supplying a clock by then, so this is the one that drives the
       settle and the pacing after it. Reset the moment he is anywhere else. */
    let resting = 0;
    /* Whether the pacing walk has already started. The gait counter has the
       whole journey in it by the time he gets here, so it would drop him into
       the walk at an arbitrary frame, and the ease-in then holds that frame
       for a quarter of a second. Setting off is a fresh cycle. */
    let pacing = false;
    /* Where he last stood, in board coordinates. This is what the chat
       freezes: wherever he was the frame it opened. */
    let last: { x: number; y: number; tilt: number } | null = null;
    /* Set while the chat is open. While this holds a spot he ignores the
       route, the scroll, and every accumulator above: he stands there facing
       the reader. Note what freezing deliberately does NOT stop: the reader
       scrolling. He is drawn inside the board, so a frozen board position
       scrolls with the content, like anything else standing on the page. */
    let frozen: { x: number; y: number; tilt: number } | null = null;
    /* Set for a moment after the chat closes when the reader scrolled while
       it was open. The route is a pure function of scrollY, so on close it
       answers with wherever the new scroll puts him; rather than teleporting
       there, he runs from where he stood to rejoin it. When the scroll did
       not move this is zero distance and invisible. */
    let blend: {
      fx: number;
      fy: number;
      lx: number;
      ly: number;
      t: number;
      dist: number;
    } | null = null;

    /* The bubble is keyed to integers so the re-render happens on real
       movement, not on sub-pixel noise. */
    let lastPub = "";
    const publish = (a: Anchor | null) => {
      const key = a ? `${Math.round(a.gx)}:${Math.round(a.gy)}` : "";
      if (key === lastPub) return;
      lastPub = key;
      anchorSet.current(
        a ? { gx: Math.round(a.gx), gy: Math.round(a.gy) } : null,
      );
    };

    const paintDebug = () => {
      if (!svg || !route) return;
      const r = board.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
      svg.setAttribute("width", String(r.width));
      svg.setAttribute("height", String(r.height));
      const bits = platforms.map(
        (p) =>
          `<polyline points="${p.edge.map((q) => `${q.x},${q.y}`).join(" ")}" fill="none" stroke="#4ade80" stroke-width="2"/>`,
      );
      for (const seg of route.segs) {
        if (seg.kind !== "air") continue;
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const x = seg.from.x + (seg.to.x - seg.from.x) * u;
          const drop = seg.to.y - seg.from.y;
          pts.push(
            `${x},${seg.from.y + (drop + seg.rise) * u * u - seg.rise * u}`,
          );
        }
        bits.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="#f472b6" stroke-width="2" stroke-dasharray="5 6"/>`,
        );
      }
      svg.innerHTML = bits.join("");
    };

    /**
     * Re-read the board.
     *
     * This runs on every scroll, not once at startup, and that is deliberate.
     * The page settles for a long time after it first paints: images arrive,
     * fonts swap, reveals fire. A route measured once is a route measured
     * against a layout that no longer exists, and the failure is silent, so he
     * just quietly lands somewhere that used to be a polaroid. Five offset
     * lookups per scroll event is a cheap price for never having to wonder.
     */
    const measure = () => {
      if (!char) return;
      const m = measurePlatforms(board, ROUTE_KEYS);
      platforms = m.platforms;
      route = buildRoute(platforms, {
        height: window.innerHeight,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        boardDocTop: m.boardDocTop,
        charHeight: height,
      });
      paintDebug();
    };

    Character.load(MANIFEST)
      .then((c) => {
        if (!alive) return;
        char = c;
        c.mount(layer);
        /* He is white ink, and half the surfaces he crosses are photographs
           with white in them. A shadow traced from his own alpha is what keeps
           him readable over both grounds; on the dark board it costs nothing
           because there is nothing for it to darken. It goes on his own root
           rather than on the layer, which spans the whole board and would be
           an enormous surface to rasterise every frame. */
        const figure = layer.firstElementChild as HTMLElement;
        figure.style.filter =
          "drop-shadow(0 0 2px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))";

        /* Clickable, so you can stop him and ask him something on this page as
           well. He introduces himself only on /fun; here he waits to be asked.
           The layer keeps pointer-events off so the rest of the board stays
           clickable, and only he takes the pointer. */
        if (talkable) {
          layer.removeAttribute("aria-hidden");
          figure.style.pointerEvents = "auto";
          figure.style.cursor = "pointer";
          figure.setAttribute("role", "button");
          figure.setAttribute("tabindex", "0");
          figure.setAttribute("aria-label", "Chat with Gary");
          figure.addEventListener("click", () => talk.current());
          figure.addEventListener("keydown", (e) => {
            const k = (e as KeyboardEvent).key;
            if (k === "Enter" || k === " ") {
              e.preventDefault();
              talk.current();
            }
          });
        }
        c.play("run");
        measure();

        if (still) {
          // Motion is unwelcome, so he does not move. He is still on the page
          // though, standing where he would have set off from: the drawing is
          // part of the story, only the running is decoration.
          // The conversation stays in the corner panel here: with no animation
          // loop there is nothing to freeze or to anchor a bubble to.
          const pose = restingPose(platforms);
          if (!pose) return;
          c.play(pose.clip);
          c.setScale(height / c.box[1]);
          c.setPhase(0);
          c.setTilt(pose.tilt);
          c.placeFeet(pose.x, pose.y);
          return;
        }

        /* From here on he can hold a conversation beside himself, so the
           corner panel stands down for as long as this crossing is alive. */
        if (talkable) release = claimConversation();

        let lastT = performance.now();

        const frame = (t: number) => {
          if (!alive || !char) return;
          raf = requestAnimationFrame(frame);
          const dt = t - lastT;
          lastT = t;

          const s = window.scrollY;
          if (s !== lastScroll || dirty) {
            dirty = false;
            measure();
          }
          if (!route) return;

          /* The chat is open: he stops what he is doing and looks at you.
             Frozen in board coordinates, so if the reader scrolls he rides
             the page like everything else on it, and the bubble (which reads
             this anchor) rides with him. Every accumulator above is left
             exactly as it was, which is what lets him resume from precisely
             here, in the direction he was going, when the bubble closes. */
          if (talkable && openRef.current) {
            if (!frozen) {
              /* Where does he stop? Usually exactly where he is drawn. The
                 exceptions: caught mid leap, he comes down on the nearer end
                 of the arc rather than hanging in the air (`ground`), and
                 opened before he ever drew a frame (arriving here with the
                 chat already going), the route is asked directly. Note the
                 pacing case must NOT ask the route: it would answer with
                 where he first stopped pacing, not where he paced to, which
                 is `last`. */
              const p = s <= 0 ? restingPose(platforms) : sampleRoute(route, s);
              if (p?.ground) frozen = { x: p.ground.x, y: p.ground.y, tilt: 0 };
              else if (last) frozen = last;
              else if (p) frozen = { x: p.x, y: p.y, tilt: p.tilt };
              if (!frozen) return;
              blend = null;
            }
            /* The head-on drawing, the same pair of poses the /fun figure
               swaps to: `idle` is that art's slot in this atlas. Facing is
               forced to +1 because the drawing already looks out of the page;
               mirroring it would only swap which arm is out. */
            char.play("idle");
            const sc = height / char.box[1];
            char.setScale(sc);
            char.tick(dt);
            char.setFacing(1);
            char.setTilt(frozen.tilt);
            char.placeFeet(frozen.x, frozen.y);

            const r = board.getBoundingClientRect();
            publish({ gx: r.left + frozen.x, gy: r.top + frozen.y });

            lastScroll = s;
            onSample?.({ clip: "idle", dir: 1, scroll: s });
            return;
          }

          if (frozen) {
            /* The chat just closed. He turns back the way he was facing and
               picks the route up again. If the reader scrolled while he was
               talking, the route now answers with somewhere else, and the
               blend below runs him over to it instead of teleporting. */
            blend = {
              fx: frozen.x,
              fy: frozen.y,
              lx: frozen.x,
              ly: frozen.y,
              t: 0,
              dist: 0,
            };
            frozen = null;
            publish(null);
            dirty = true;
          }

          /* At the very top of the page he has not set off yet, so he stands
             on the first card rather than being caught mid-stride with both
             feet off the paper. He starts running the moment the reader does. */
          const atTop = s <= 0;
          let pose = atTop ? restingPose(platforms) : sampleRoute(route, s);
          if (!pose) return;

          /* The end of the line. He has arrived, the page has run out, and
             nobody is scrolling: from here he keeps himself company. */
          if (pose.rest) {
            resting += dt;
            pose = pacePose(pose.rest, resting, pose.dist);
            if (pose.gaitDriven && !pacing) gait = 0;
            pacing = pose.gaitDriven;
            /* And here his facing is his own, not the reader's. Deriving it
               from the scroll direction, as everything above does, leaves it
               frozen the moment the page stops moving, which is exactly when
               he starts pacing: he would walk the return leg backwards. */
            facing = pose.dir;
          } else {
            resting = 0;
            pacing = false;
            /* Both ends of the page are places he stands while nobody is
               scrolling, so the top takes its facing from the pose for the
               same reason the pacing does. Reading it off the reader's travel
               instead leaves him wearing the direction he came home in, which
               is how he ended up back at the start looking off the left edge
               of the first polaroid. */
            if (atTop) facing = pose.dir;
            else if (s !== lastScroll) facing = pose.dir * (s > lastScroll ? 1 : -1);
          }
          lastScroll = s;

          if (blend) {
            blend.t += dt;
            const u = Math.min(1, blend.t / BLEND_MS);
            const e = 1 - (1 - u) * (1 - u);
            const bx = blend.fx + (pose.x - blend.fx) * e;
            const by = blend.fy + (pose.y - blend.fy) * e;
            const step = Math.hypot(bx - blend.lx, by - blend.ly);
            blend.dist += step;
            blend.lx = bx;
            blend.ly = by;
            const remaining = Math.hypot(pose.x - bx, pose.y - by);
            if (u >= 1 || remaining < 1) {
              blend = null;
            } else {
              /* Hurrying back to his route: legs driven by the distance the
                 dash itself covers, facing the way it is going. */
              if (Math.abs(pose.x - blend.fx) > 1)
                facing = pose.x >= blend.fx ? 1 : -1;
              char.play("run");
              const sc = height / char.box[1];
              char.setScale(sc);
              const stride =
                strides?.run ?? char.manifest.clips.run?.stride ?? char.box[0];
              char.setPhase(blend.dist / (stride * sc));
              lastDist = pose.dist;
              char.setFacing(facing);
              char.setTilt(pose.tilt);
              char.placeFeet(bx, by);
              last = { x: bx, y: by, tilt: pose.tilt };
              onSample?.({ clip: "run", dir: facing, scroll: s });
              return;
            }
          }

          char.play(pose.clip);
          const scale = height / char.box[1];
          char.setScale(scale);

          if (pose.ambient) {
            // The one thing that is not a function of the page. Standing still
            // has to keep going once the reader stops scrolling.
            char.tick(dt);
          } else if (pose.gaitDriven) {
            const stride =
              strides?.[pose.clip] ??
              char.manifest.clips[pose.clip]?.stride ??
              char.box[0];
            if (lastDist !== null) gait += Math.abs(pose.dist - lastDist);
            char.setPhase(gait / (stride * scale));
          } else {
            char.setPhase(pose.phase);
          }
          lastDist = pose.dist;

          char.setFacing(facing);
          char.setTilt(pose.tilt);
          char.placeFeet(pose.x, pose.y);
          last = { x: pose.x, y: pose.y, tilt: pose.tilt };

          onSample?.({ clip: pose.clip, dir: facing, scroll: s });
        };
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {
        /* No atlas, no Gary. The story reads exactly as it did before, and
           the conversation keeps its corner panel because nothing claims it. */
      });

    const touch = () => {
      dirty = true;
    };
    const ro = new ResizeObserver(touch);
    ro.observe(board);
    ro.observe(document.documentElement);
    window.addEventListener("resize", touch);
    const settle = [300, 900, 1800].map((ms) => setTimeout(touch, ms));

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", touch);
      settle.forEach(clearTimeout);
      layer.remove();
      svg?.remove();
      release?.();
      anchorSet.current(null);
    };
  }, [board, height, minWidth, version, debug, strides, onSample, enabled]);

  /* The conversation, coming off him. Fixed-position and portalled to the
     body: the board's ancestors carry transforms (BlurFade), which would
     re-anchor a fixed child, and the board itself clips nothing he says this
     way. The anchor is republished every frame he is frozen, so scrolling
     with the chat open moves the bubble in step with him. */
  if (!enabled || !open || !anchor || !draw || typeof document === "undefined")
    return null;

  const placed = placeBubble(
    anchor,
    height,
    window.innerWidth,
    window.innerHeight,
    bubbleMode.current,
    draw,
  );
  bubbleMode.current = placed.mode;

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
        zIndex: 40,
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
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ color: F.inkFaint, fontSize: "1rem", lineHeight: 1 }}
        >
          ×
        </button>
      </header>
      <GaryConversation />
    </ThoughtBubble>,
    document.body,
  );
}
