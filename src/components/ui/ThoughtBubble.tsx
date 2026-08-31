"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A hand-drawn thought bubble for Gary to talk inside.
 *
 * The first version of this walked the perimeter of a rectangle laying down
 * evenly spaced bumps of near-identical size, which reads as a doily rather
 * than a drawing. Looking at how thought bubbles are actually drawn (the
 * reference was the CC0 Fxemoji cloud on Wikimedia Commons), the difference is
 * not subtlety, it is scale and variation: a real one is maybe six to a dozen
 * lobes, each a large fraction of the whole shape, with the biggest two or
 * three times the smallest, and no two sitting at the same distance out.
 *
 * So the lobes here are few and big, their radii vary by about 2x, and each is
 * pushed out from the edge by a different amount.
 *
 * The outline is a true union of overlapping circles, drawn without any path
 * arithmetic. Every lobe is stroked and filled first, then every lobe is filled
 * again on top with no stroke. The second pass paints over the stroke segments
 * that fall inside a neighbour, and the only stroke left is the silhouette. A
 * plain rounded rect sits under both passes so the middle is solid; its own
 * edges are always at least a lobe radius inside the union, so it never shows.
 *
 * All of it is generated from the measured box rather than being a fixed asset,
 * because the bubble holds a one line greeting one moment and a scrolling
 * conversation the next, and a stretched drawing would flatten the lobes on one
 * axis. The wobble is seeded, so it does not shiver on re-render.
 */

const INK = "#1a1a1a";
const PAPER = "#ffffff";

type Lobe = { cx: number; cy: number; r: number };

/** Big enough to read as drawn, small enough to leave room to write in. */
function baseRadius(w: number, h: number): number {
  return Math.max(16, Math.min(Math.min(w, h) * 0.42, 56));
}

/**
 * Corners get their own, much larger lobe.
 *
 * Running one size of lobe all the way round gives an evenly lumpy blob, and on
 * a wide bubble that reads as a squarish cloud. Making the four corners half
 * again as big as the edge lobes is what turns the silhouette into a wide shape
 * with properly round corners.
 */
const CORNER = [1.24, 1.46] as const;
const EDGE = [0.52, 0.86] as const;

function buildLobes(w: number, h: number, seed: number): Lobe[] {
  let s = seed * 2654435761 % 2147483647;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);

  const R = baseRadius(w, h);
  const x0 = R;
  const y0 = R;
  const x1 = Math.max(x0 + 1, w - R);
  const y1 = Math.max(y0 + 1, h - R);

  const lobes: Lobe[] = [];

  /* The four corners first, big and round. Everything else fills the straight
     runs between them. */
  const corners: Array<[number, number, number, number]> = [
    [x0, y0, -1, -1],
    [x1, y0, 1, -1],
    [x1, y1, 1, 1],
    [x0, y1, -1, 1],
  ];
  for (const [cx, cy, nx, ny] of corners) {
    const r = R * between(CORNER[0], CORNER[1]);
    const push = R * between(0.02, 0.16);
    lobes.push({
      cx: cx + nx * push * 0.7,
      cy: cy + ny * push * 0.7,
      r,
    });
  }

  /* Walk one edge between two corners, dropping lobes at uneven intervals.
     `nx, ny` is the outward normal, used to shove each lobe out by its own
     amount so the silhouette is not a constant offset from the box. */
  const run = (
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    nx: number,
    ny: number,
  ) => {
    const len = Math.hypot(tx - fx, ty - fy);
    if (len < 1) return;
    const ux = (tx - fx) / len;
    const uy = (ty - fy) / len;
    /* Start and finish inside the corner lobes, which already cover the ends,
       and space the rest evenly enough that neighbours always overlap. */
    const span = Math.max(0, len - R * 0.7);
    const steps = Math.max(1, Math.round(span / (R * 0.78)));
    for (let i = 0; i <= steps; i++) {
      const t = R * 0.35 + (span * i) / steps;
      const r = R * between(EDGE[0], EDGE[1]);
      const push = R * between(0.16, 0.42);
      lobes.push({
        cx: fx + ux * t + nx * push,
        cy: fy + uy * t + ny * push,
        r,
      });
    }
  };

  run(x0, y0, x1, y0, 0, -1); // top
  run(x1, y0, x1, y1, 1, 0); // right
  run(x1, y1, x0, y1, 0, 1); // bottom
  run(x0, y1, x0, y0, -1, 0); // left

  return lobes;
}

export default function ThoughtBubble({
  /** Which way the trailing puffs run, towards wherever Gary is standing. */
  tail = "down",
  /** Where the trail sits along the bubble's width, in px. */
  tailX,
  seed = 11,
  role,
  ariaLabel,
  className,
  style,
  children,
}: {
  tail?: "up" | "down";
  tailX: number;
  seed?: number;
  role?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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
  const lobes = useMemo(
    () => (w > 0 && h > 0 ? buildLobes(w, h, seed) : []),
    [w, h, seed],
  );

  const R = w > 0 ? baseRadius(w, h) : 0;

  /* The trail: three lobes shrinking away towards him. Sized off the bubble so
     they stay in proportion to it. */
  const trail = [
    { d: R * 0.42, r: Math.max(4.5, R * 0.17) },
    { d: R * 0.82, r: Math.max(3, R * 0.11) },
    { d: R * 1.12, r: Math.max(2, R * 0.06) },
  ];

  return (
    <div
      ref={box}
      role={role}
      aria-label={ariaLabel}
      className={className}
      style={{ position: "relative", ...style }}
    >
      {w > 0 && (
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
          {/* Pass one: every lobe stroked. */}
          {lobes.map((l, i) => (
            <circle
              key={`s${i}`}
              cx={l.cx}
              cy={l.cy}
              r={l.r}
              fill={PAPER}
              stroke={INK}
              strokeWidth={2.1}
            />
          ))}
          {/* Pass two covers every stroke that fell inside the shape. Both
              parts of it have to come after the whole of pass one, the rect
              included: the lobes sit on the edges and reach inward, so the
              inner half of each one's outline lands in the middle where no
              other lobe covers it. Painting the middle first leaves those arcs
              on show, which looks like a pile of circles rather than a cloud. */}
          <rect
            x={R}
            y={R}
            width={Math.max(0, w - R * 2)}
            height={Math.max(0, h - R * 2)}
            fill={PAPER}
          />
          {lobes.map((l, i) => (
            <circle key={`f${i}`} cx={l.cx} cy={l.cy} r={l.r} fill={PAPER} />
          ))}

          {trail.map((t, i) => (
            <circle
              key={`t${i}`}
              cx={tailX}
              cy={tail === "down" ? h + t.d : -t.d}
              r={t.r}
              fill={PAPER}
              stroke={INK}
              strokeWidth={1.9}
            />
          ))}
        </svg>
      )}

      {/* Above the drawn outline. Inset by part of a lobe rather than all of
          one: the lobes bulge outward, so the writing can sit closer in than
          their radius without touching the edge. */}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: `${Math.round(R * 0.42)}px ${Math.round(R * 0.5)}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
