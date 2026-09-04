/**
 * Where a thought bubble stands, relative to whoever is thinking it.
 *
 * This is the one place on the site that knows how far a bubble keeps from
 * Gary. Both pages that draw a bubble off him (/fun in GaryPacing, /story in
 * StoryGary) call `placeBubble` here with their own bounds, and neither
 * carries a clearance number of its own. That is deliberate and it is the
 * point of the file. The trail is a drawing whose painted length varies by
 * recipe and seed (about 45 to 137px past the box), so a fixed gap written
 * into a page is wrong the moment the tail art changes. /fun had one (48px)
 * after /story had already switched to measuring, and the next trail change
 * put the last puff on his head. If a page needs the bubble somewhere new,
 * add a mode or a bound here; do not write a gap in the page.
 *
 * The rule itself is `standoff`: the exact painted reach of the trail THIS
 * drawing will make (`tailReach` over the same pure `buildBubbleShape` call
 * the bubble renders) plus SPEAKER_MARGIN. Everything else in here is the
 * solving of where the box goes so that rule holds against the page's edges.
 *
 * Coordinates are whatever the caller measures in, as long as the speaker
 * and the bounds agree: /story works in viewport px, /fun in the card
 * wrapper's px. The placement comes back in the same space.
 */
import { buildBubbleShape, tailReach, VARIANT_COUNT } from "./bubbleShape";

/** Gap between the trail's last puff and his ink. 12px is the clearance the
    approved drawing already had in the common case (the old fixed gap minus
    the ~66px a typical trail reaches), so the spacing Pat liked is kept; it
    also swallows his drop shadow (up to ~6px of blur) and the integer
    rounding of a published anchor, with room to spare, while staying under
    one head-height so the trail still reads as attached. The trail's own
    length is never budgeted here: it is measured off the actual drawing
    (`trailReach`) per open, so a short-trailed recipe stands close to him
    and a long-trailed one further out, and neither touches. */
export const SPEAKER_MARGIN = 12;

/* ── The painted bleed ───────────────────────────────────────────────────
   The clamps below keep the bubble's LAYOUT BOX inside the caller's bounds,
   but ThoughtBubble's SVG is overflow:visible and the drawing reaches past
   that box, so the box has to stay clear of the edges by the drawing's
   worst reach, not by a flat margin. Both numbers are derived from the caps
   in bubbleShape.ts and were checked against 960k generated shapes (worst
   lobe 42.7, worst tail 131.2). If that generator's caps change, re-derive
   these. They live here, not in a page, because a page that forgot them
   had its lobes sliced flat at the viewport edge around 720-800px wide.

   A lobe past the box edge: valley jitter (6 x wobble, wobble <= 1.2, so
   7.2) plus the cubic's bulge (control offset k <= 46, and a cubic with
   both controls at k peaks at 3/4 of k, so 34.5) plus half the heaviest
   stroke (2.4 / 2): 7.2 + 34.5 + 1.2 = 42.9. */
export const LOBE_BLEED = 44;
/* The trail hangs much further past the box on the side it leaves:
   tailStart (a lobe's reach + 3, so 44.7) plus up to four puffs (unit
   u <= 26; radii u * (0.42 - 0.1 * i) * 1.15 with gaps of 8, so 87.0)
   plus the last puff's rotated rx (4.4) and its stroke (0.8): 136.9.

   This is the CAP across every recipe and seed, and it is used only where
   a worst case is the right number: sizing `h` so the bounds clamps stay
   satisfiable whatever gets drawn. The clamps themselves, and all of the
   placement against Gary, use the REAL reach of the drawing being made,
   which tops out at this figure by construction. */
export const TAIL_BLEED = 138;

/** The chat box will shrink this far to stay out of pinned mode: header, a
    couple of lines and the input still fit at 160. A shorter bubble above
    or below him beats a full-size one clamped over the top of him. */
export const H_MIN = 160;
/** His head centre sits about 15% below the top of the drawn figure. The
    side-mode trail exits at this height so it points at his head. */
export const HEAD_FRAC = 0.85;
/** Pinned only: minimum sideways offset between the trail column and his
    centre line when the trail cannot stop short of him. His half-width is
    about 28px, the fattest puff adds ~15px with its stroke, and the puffs
    drift up to ~5px sideways, so 48 keeps every puff clear of his figure
    while staying as close as the guarantee allows. */
export const PINNED_CLEAR_X = 48;
/** The trail never leaves within this of a box corner, where the lobes of
    two edges meet and the exit clearance is not sampled. */
const TAIL_INSET = 24;
/** How much shorter each rung of the shrink ladder is, px. */
const H_STEP = 20;

export type TailSide = "up" | "down" | "left" | "right";
export type BubbleMode = "above" | "below" | "left" | "right" | "pinned";

/** The drawing being made this open: which recipe and which wobble seed.
    Rolled once per open and held, so placement and rendering agree on one
    shape and nothing re-rolls mid-conversation. */
export type Draw = { variant: number; wobble: number };

/**
 * One drawing per open, rolled by the page rather than inside ThoughtBubble,
 * because the placement needs the trail's true reach before the bubble
 * exists. `?bubble=N` (0..3) pins the recipe and `?wobble=N` the seed, on
 * any page, for eyeballing every recipe deliberately.
 */
export function rollDraw(search?: string): Draw {
  const q = new URLSearchParams(
    search ?? (typeof window === "undefined" ? "" : window.location.search),
  );
  const v = q.get("bubble") === null ? NaN : Number(q.get("bubble"));
  const s = q.get("wobble") === null ? NaN : Number(q.get("wobble"));
  return {
    variant:
      Number.isInteger(v) && v >= 0 && v < VARIANT_COUNT
        ? v
        : Math.floor(Math.random() * VARIANT_COUNT),
    wobble: Number.isInteger(s) ? s | 0 : (Math.random() * 0x7fffffff) | 0,
  };
}

/** How far past the box edge the trail of THIS drawing paints, px. */
export function trailReach(
  w: number,
  h: number,
  draw: Draw,
  tailX: number,
  side: TailSide,
): number {
  return tailReach(
    buildBubbleShape(w, h, draw.variant, draw.wobble, tailX, side),
  );
}

/**
 * THE clearance rule: how far the box edge the trail leaves must stand off
 * the speaker's ink, so the last puff stops SPEAKER_MARGIN short of him.
 * Measured off the drawing actually being made, never a constant.
 */
export function standoff(
  w: number,
  h: number,
  draw: Draw,
  tailX: number,
  side: TailSide,
): number {
  return trailReach(w, h, draw, tailX, side) + SPEAKER_MARGIN;
}

/** The figure being spoken from: centre x, top of his ink, his feet, and
    half his drawn width, all in the caller's coordinates. */
export type Speaker = { x: number; top: number; bottom: number; halfW: number };

/** Where the PAINTED drawing may go: lobes, trail and all. The layout box is
    kept inside this by the bleeds above, so a caller passes the real clip
    edges (viewport, nav, section) and nothing tighter. */
export type Bounds = { left: number; right: number; top: number; bottom: number };

export type Placement = {
  left: number;
  top: number;
  w: number;
  h: number;
  tail: TailSide;
  tailX: number;
  mode: BubbleMode;
};

/** The widest box whose lobes still paint inside the bounds. */
export function fitWidth(wanted: number, b: Bounds): number {
  return Math.floor(Math.min(wanted, b.right - b.left - 2 * LOBE_BLEED));
}

/** The tallest box that leaves room for lobes on one end and the longest
    possible trail on the other, so the bounds clamps stay satisfiable for
    any drawing. Sized by the cap rather than the live reach so `h` is
    stable across opens. */
export function fitHeight(wanted: number, b: Bounds): number {
  return Math.floor(
    Math.min(wanted, b.bottom - b.top - LOBE_BLEED - TAIL_BLEED),
  );
}

/**
 * Where the bubble goes, given where he is.
 *
 * Deterministic, and sticky on purpose: `prev` is whatever was chosen last
 * time, and it is kept for as long as it still fits, so a reader scrolling
 * around the threshold does not get a bubble that flips back and forth on
 * every wheel tick. Preference order when a fresh choice is needed: a
 * full-height box above his head, then below his feet, then beside him;
 * only then a shrunken box above or below (the taller of the two, in H_STEP
 * rungs down to `hMin`), and pinned inside the bounds last of all, with the
 * trail aimed at wherever he is. `modes` restricts which of the four
 * attached placements a page allows; pinned is always the last resort.
 *
 * The trail is one drawn gesture everywhere: it leaves the box off the edge
 * that faces him, runs toward him, and its last puff stops SPEAKER_MARGIN
 * short of his ink. The clearance is `standoff` over the drawing actually
 * being made, never a worst-case constant, so the bubble stands as close to
 * him as this particular recipe allows. In the side modes the trail leaves
 * the side edge at his head height and points straight at his head.
 *
 * The final clamp is unconditional, which is what guarantees the box is
 * never clipped by the bounds even when he has been scrolled clean off
 * them.
 */
export function placeBubble({
  speaker: sp,
  draw,
  w,
  hMax: hWanted,
  hMin: hFloor,
  bounds: b,
  modes = ["above", "below", "left", "right"],
  prev = null,
}: {
  speaker: Speaker;
  draw: Draw;
  /** Box width, already fitted by the caller (see fitWidth). */
  w: number;
  /** Full box height wanted. Capped by fitHeight against the bounds. */
  hMax: number;
  /** How short the box may shrink to stay attached. Omit for no shrinking
      (a box whose height is its content, like the greeting). */
  hMin?: number;
  bounds: Bounds;
  modes?: Exclude<BubbleMode, "pinned">[];
  prev?: BubbleMode | null;
}): Placement {
  const allow = new Set<BubbleMode>(modes);
  const hMax = Math.max(1, fitHeight(hWanted, b));
  const hMin = Math.min(hFloor ?? hMax, hMax);

  /* Where the layout box may sit: the bounds, inset by the lobes' reach. */
  const boxL = b.left + LOBE_BLEED;
  const boxR = b.right - LOBE_BLEED;
  const boxT = b.top + LOBE_BLEED;
  const boxB = b.bottom - LOBE_BLEED;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(v, hi));

  const headTop = sp.top;
  const headY = sp.bottom - (sp.bottom - sp.top) * HEAD_FRAC;

  const reachOf = (along: number, side: TailSide, hh: number) =>
    trailReach(w, hh, draw, along, side);

  /* The true painted reach of THIS drawing's trail, per exit edge. The
     along-edge coordinate is settled before the perpendicular offset is
     chosen, so there is no circularity: for the vertical modes, left (and
     so tailX) depends only on his x; for the side modes, top (and so the
     exit height) depends only on his head's y. */
  const vLeft = clamp(sp.x - w / 2, boxL, boxR - w);
  const vTailX = clamp(sp.x - vLeft, TAIL_INSET, w - TAIL_INSET);
  const reachDown = reachOf(vTailX, "down", hMax);
  const reachUp = reachOf(vTailX, "up", hMax);

  const sTop = clamp(headY - hMax / 2, boxT, boxB - hMax);
  const sTailY = clamp(headY - sTop, TAIL_INSET, hMax - TAIL_INSET);
  const reachRight = reachOf(sTailY, "right", hMax);
  const reachLeft = reachOf(sTailY, "left", hMax);

  /* The room above his head, and below his feet, that a box plus its own
     standoff must fit into. */
  const availAbove = headTop - boxT;
  const availBelow = boxB - sp.bottom;

  /* The tallest box (full height first, then H_STEP rungs down to hMin)
     whose OWN trail still fits the available run: the reach is recomputed
     at each candidate height because the scallop walk re-deals when the
     box changes, so reach is not continuous in h and a smooth solve could
     oscillate; a fixed ladder always settles, and the accepted pair is
     self-consistent with what gets drawn. */
  const solveH = (avail: number, side: TailSide) => {
    let hc = hMax;
    for (;;) {
      const r = reachOf(vTailX, side, hc);
      if (avail >= r + SPEAKER_MARGIN + hc) return { h: hc, r };
      if (hc <= hMin) return null;
      hc = Math.max(hMin, hc - H_STEP);
    }
  };
  const above = allow.has("above") ? solveH(availAbove, "down") : null;
  const below = allow.has("below") ? solveH(availBelow, "up") : null;

  const fits: Record<Exclude<BubbleMode, "pinned">, boolean> = {
    above: above !== null,
    below: below !== null,
    left:
      allow.has("left") &&
      sp.x - sp.halfW - SPEAKER_MARGIN - reachRight - w >= boxL,
    right:
      allow.has("right") &&
      sp.x + sp.halfW + SPEAKER_MARGIN + reachLeft + w <= boxR,
  };

  let mode: BubbleMode;
  if (prev && prev !== "pinned" && fits[prev]) mode = prev;
  else if (above && above.h === hMax) mode = "above";
  else if (below && below.h === hMax) mode = "below";
  else if (fits.left || fits.right) {
    // The side with more room, so he is never squeezed against an edge.
    const mid = (b.left + b.right) / 2;
    mode = sp.x > mid && fits.left ? "left" : fits.right ? "right" : "left";
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
         far edge lands SPEAKER_MARGIN above the top of his figure. */
      left = vLeft;
      h = above ? above.h : hMax;
      reach = above ? above.r : reachDown;
      top = headTop - (reach + SPEAKER_MARGIN) - h;
      tail = "down";
      tailX = vTailX;
      break;
    case "below":
      /* Trail off the top, rising at him along his centre line. It stops
         SPEAKER_MARGIN below his feet: his body is in the way of his head
         from down here, so short of the figure is as close as it can
         point. */
      left = vLeft;
      h = below ? below.h : hMax;
      reach = below ? below.r : reachUp;
      top = sp.bottom + (reach + SPEAKER_MARGIN);
      tail = "up";
      tailX = vTailX;
      break;
    case "left":
      /* Beside him on his left, trail off the box's RIGHT edge at his head
         height, running horizontally at his head. halfW keeps the last
         puff clear of his arms as well as his face. */
      left = sp.x - sp.halfW - (reachRight + SPEAKER_MARGIN) - w;
      top = sTop;
      h = hMax;
      tail = "right";
      tailX = sTailY;
      reach = reachRight;
      break;
    case "right":
      left = sp.x + sp.halfW + (reachLeft + SPEAKER_MARGIN);
      top = sTop;
      h = hMax;
      tail = "left";
      tailX = sTailY;
      reach = reachLeft;
      break;
    case "pinned":
      left = vLeft;
      h = hMax;
      top = headTop - (reachDown + SPEAKER_MARGIN) - h;
      tail = "down"; // settled properly after the clamps below
      tailX = vTailX;
      reach = reachDown;
      break;
  }

  left = clamp(left, boxL, boxR - w);
  top = clamp(top, boxT, boxB - h);

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
      sp.x > b.left - sp.halfW &&
      sp.x < b.right + sp.halfW &&
      sp.bottom > b.top &&
      headTop < b.bottom;
    const room = tail === "down" ? headTop - (top + h) : top - sp.bottom;
    if (visible && room < reach + SPEAKER_MARGIN) {
      const c = sp.x - left;
      const lo = c - PINNED_CLEAR_X;
      const hi = c + PINNED_CLEAR_X;
      /* The nearer allowed column that still exists inside the box. */
      if (lo >= TAIL_INSET && hi <= w - TAIL_INSET)
        tailX = c >= w / 2 ? lo : hi;
      else if (lo >= TAIL_INSET) tailX = lo;
      else if (hi <= w - TAIL_INSET) tailX = hi;
      tailX = clamp(tailX, TAIL_INSET, w - TAIL_INSET);
      reach = reachOf(tailX, tail, h);
    }
  }

  /* The painted trail must stay inside the bounds too, by the reach of the
     drawing actually being made. Satisfiable by construction: fitHeight
     reserves TAIL_BLEED (the cap over every recipe, >= any reach) on the
     trail side, and the side modes are only chosen when the horizontal
     budget already covers their reach. */
  if (tail === "down") top = Math.min(top, b.bottom - reach - h);
  else if (tail === "up") top = Math.max(top, b.top + reach);
  else if (tail === "right") left = Math.min(left, b.right - reach - w);
  else left = Math.max(left, b.left + reach);

  return { left, top, w, h, tail, tailX, mode };
}
