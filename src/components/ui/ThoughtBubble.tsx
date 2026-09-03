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
  /** Which way the trailing puffs run, towards wherever Gary is standing. */
  tail = "down",
  /** Where the trail sits along the bubble's width, in px. */
  tailX,
  /** Extra scramble on the wobble. Kept for callers that pass it; the
      drawing itself is picked per mount, not per seed. */
  seed = 11,
  /** Pin one of the recipes (0..3). Omit for the per-mount random pick. */
  variant,
  role,
  ariaLabel,
  className,
  style,
  children,
}: {
  tail?: "up" | "down";
  tailX: number;
  seed?: number;
  variant?: number;
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

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
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
            (pick.wobble + seed * 1013904223) | 0,
            tailX,
            tail,
          )
        : null,
    [w, h, variant, pick, seed, tailX, tail],
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
            const cx = tailX + p.dx;
            const cy =
              tail === "down"
                ? h + shape.tailStart + p.dy
                : -(shape.tailStart + p.dy);
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
