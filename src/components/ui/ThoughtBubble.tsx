"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildBubbleShape,
  VARIANT_COUNT,
} from "@/lib/bubbleShape";

/**
 * A hand-drawn thought bubble for Gary to talk inside.
 *
 * Two earlier attempts are recorded here so they do not get rebuilt.
 *
 * The first walked the perimeter of a rectangle laying down evenly spaced
 * bumps of near-identical size, which reads as a doily rather than a
 * drawing. A real thought balloon is scalloped, not fringed.
 *
 * The second was a union of overlapping circles with oversized lobes at the
 * four corners and smaller ones along the edges. The corner/edge size split
 * was the mistake: on a wide bubble the four fat corners merge into two fat
 * ends with the small edge lobes tucked between them, and the silhouette
 * reads as a dog bone. Any construction that gives corners their own lobe
 * class will do this; do not bring it back.
 *
 * The current outline is built in src/lib/bubbleShape.ts as a scalloped
 * walk around a convex rounded-rect spine, which is how comic letterers
 * construct a cloud balloon (Comicraft: "a cloudy scalloped balloon shape"
 * with "three or four circles" for a tail). Irregular chords, per-lobe
 * depth and lean, and four different corner radii give it the
 * "consistently inconsistent" quality of a freehand pass; the convex spine
 * makes a waist geometrically impossible. One closed path, filled and
 * stroked once, so there is no multi-pass painting to keep in order.
 *
 * There are four distinct recipes, four bubbles drawn on four different
 * days, and one is picked at random each time a bubble mounts. Within a
 * mount the drawing is deterministic (seeded), so it does not shiver on
 * re-render, and the greeting growing into the conversation keeps its
 * character while re-fitting the new box.
 *
 * All of it is generated from the measured box rather than being a fixed
 * asset, because the bubble holds a one line greeting one moment and a
 * scrolling conversation the next, and a stretched drawing would flatten
 * the lobes on one axis. That constraint is still true; keep it.
 */

const INK = "#1a1a1a";
const PAPER = "#ffffff";

export default function ThoughtBubble({
  /** Which edge the trailing puffs leave, running towards wherever Gary is
      standing: off the bottom, the top, or either side. */
  tail = "down",
  /** Where the trail sits along that edge, in px: x from the left for
      up/down, y from the top for left/right. */
  tailX,
  /** Extra scramble on the wobble. Kept for callers that pass it; the
      drawing itself is picked per mount, not per seed. */
  seed = 11,
  /** Pin one of the recipes (0..3). Omit for the per-mount random pick. */
  variant,
  /** Pin the exact draw seed. A caller that has to know the trail's true
      reach BEFORE the bubble mounts (StoryGary places the box by it) rolls
      this itself, measures the shape with buildBubbleShape + tailReach, and
      passes variant and wobble down so the drawing here is byte-for-byte
      the one it measured. Omit for the per-mount random wobble. */
  wobble,
  /** Reports the measured box, the same integers the outline is built from,
      whenever it changes. A caller placing an auto-height bubble (the /fun
      greeting) uses it to measure the trail of exactly the drawing being
      made rather than of a guessed height. Optional; nothing else changes
      when it is omitted. */
  onSize,
  role,
  ariaLabel,
  className,
  style,
  children,
}: {
  tail?: "up" | "down" | "left" | "right";
  tailX: number;
  seed?: number;
  variant?: number;
  wobble?: number;
  onSize?: (size: { w: number; h: number }) => void;
  role?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* One drawing per open. Picked once when the bubble mounts and held for
     its whole life, so opening Gary twice gives two different bubbles while
     a single conversation never redraws its own outline character. */
  const [pick] = useState(() => ({
    variant: Math.floor(Math.random() * VARIANT_COUNT),
    wobble: (Math.random() * 0x7fffffff) | 0,
  }));

  /* Held in a ref so a caller passing a fresh arrow each render does not
     re-subscribe the observer. */
  const report = useRef(onSize);
  report.current = onSize;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const next = { w: el.offsetWidth, h: el.offsetHeight };
      setSize(next);
      report.current?.(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  /* Rebuilt only when the box actually changes size, so typing into the
     conversation does not redraw the outline on every keystroke. */
  const shape = useMemo(
    () =>
      w > 0 && h > 0
        ? buildBubbleShape(
            w,
            h,
            variant ?? pick.variant,
            wobble ?? ((pick.wobble + seed * 1013904223) | 0),
            tailX,
            tail,
          )
        : null,
    [w, h, variant, wobble, pick, seed, tailX, tail],
  );

  return (
    <div
      ref={box}
      role={role}
      aria-label={ariaLabel}
      className={className}
      style={{ position: "relative", ...style }}
    >
      {shape && (
        <svg
          aria-hidden
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <path
            d={shape.path}
            fill={PAPER}
            stroke={INK}
            strokeWidth={shape.strokeWidth}
            strokeLinejoin="round"
          />

          {shape.tail.map((p, i) => {
            /* dy runs away from the exit edge, dx drifts across the trail's
               axis; for a side exit those roles rotate with it. */
            const out = shape.tailStart + p.dy;
            const cx =
              tail === "left" ? -out : tail === "right" ? w + out : tailX + p.dx;
            const cy =
              tail === "up" ? -out : tail === "down" ? h + out : tailX + p.dx;
            return (
              <ellipse
                key={i}
                cx={cx}
                cy={cy}
                rx={p.rx}
                ry={p.ry}
                transform={`rotate(${p.rot} ${cx} ${cy})`}
                fill={PAPER}
                stroke={INK}
                strokeWidth={Math.max(1.6, shape.strokeWidth - 0.2)}
              />
            );
          })}
        </svg>
      )}

      {/* Above the drawn outline. The scallop valleys sit on the measured
          box itself and only the lobes bulge outward, so a small inset is
          all the writing needs to stay on paper. */}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: `${shape?.padY ?? 15}px ${shape?.padX ?? 18}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
