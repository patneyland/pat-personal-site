"use client";

import { useState } from "react";
import type { PullupDay } from "@/lib/pullups";

/**
 * Daily volume, drawn the way the little screen would draw it if it were 300
 * pixels wide instead of 128.
 *
 * One series, so there is no legend: the heading names it. Labels are
 * selective rather than one per bar, because thirty numbers over thirty bars
 * is a table with extra steps, and the table is further down the page.
 *
 * IMPORTANT, and the thing that broke the first version: everything inside the
 * panel must wear --oled-* colours, never the site's text tokens. The panel is
 * an object and does not invert with the page, so a label set in --text-muted
 * is legible in dark mode and invisible in light.
 */

const H = 64; // plot height, in panel units
const GAP = 1;
const BAR = 6;

export function PixelChart({ days, label }: { days: PullupDay[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const step = BAR + GAP;
  const W = days.length * step - GAP;
  const max = Math.max(1, ...days.map((d) => d.total));
  const peak = max > 0 ? days.findIndex((d) => d.total === max) : -1;

  const barH = (total: number) =>
    total === 0 ? 0 : Math.max(2, Math.round((total / max) * (H - 10)));

  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="oled-text mb-3 text-[0.7rem] uppercase tracking-[0.2em] text-muted">
        {label}
      </figcaption>

      <div className="oled-panel-frame">
        <svg
          viewBox={`0 0 ${W} ${H + 1}`}
          shapeRendering="crispEdges"
          className="oled-panel w-full"
          role="img"
          aria-label={`${label}. ${days.length} days, peak ${max} reps.`}
          onMouseLeave={() => setHover(null)}
        >
          <rect x="0" y="0" width={W} height={H + 1} fill="var(--oled-off)" />
          <rect x="0" y={H} width={W} height="1" fill="var(--oled-dim)" />

          {days.map((d, i) => {
            const h = barH(d.total);
            const x = i * step;
            const on = hover === i;
            return (
              <g key={d.day}>
                {/* Full-height hit target, so rest days are hoverable too. */}
                <rect
                  x={x}
                  y={0}
                  width={BAR}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                {h > 0 ? (
                  <rect
                    x={x}
                    y={H - h}
                    width={BAR}
                    height={h}
                    fill={on ? "var(--oled-on)" : "var(--oled-mid)"}
                    pointerEvents="none"
                  />
                ) : (
                  /* A rest day still reads as a day, not a gap in the axis. */
                  <rect
                    x={x}
                    y={H - 1}
                    width={BAR}
                    height="1"
                    fill={on ? "var(--oled-on)" : "var(--oled-dim)"}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* One direct label, on the peak, clamped so it cannot ride off the
              top of the viewBox the way it did when the peak was full height. */}
          {peak >= 0 && (
            <text
              x={
                peak < 2
                  ? peak * step
                  : peak > days.length - 3
                    ? peak * step + BAR
                    : peak * step + BAR / 2
              }
              y={Math.max(7, H - barH(max) - 2)}
              className="oled-text"
              fontSize="7"
              fill="var(--oled-on)"
              textAnchor={peak < 2 ? "start" : peak > days.length - 3 ? "end" : "middle"}
            >
              {max}
            </text>
          )}
        </svg>

        {/* A fixed readout rather than a floating tooltip. On a screen this
            shape the device tells you what it knows in one place, and a box
            chasing the cursor would cover the bars it is describing. */}
        <div
          className="oled-text mt-2 flex items-baseline justify-between gap-3 text-[0.62rem]"
          style={{ color: "var(--oled-mid)" }}
        >
          <span>{days[0]?.day.slice(5)}</span>
          <span aria-live="polite" style={{ color: "var(--oled-on)" }}>
            {active
              ? active.total === 0
                ? `${active.day.slice(5)}  rest`
                : `${active.day.slice(5)}  ${active.total} in ${active.sets} ${
                    active.sets === 1 ? "set" : "sets"
                  }  (${active.reps.join(", ")})`
              : ""}
          </span>
          <span>{days[days.length - 1]?.day.slice(5)}</span>
        </div>
      </div>
    </figure>
  );
}

/**
 * Best single set against the goal, as twenty blocks.
 *
 * A progress read, not a chart: one value, one target, and the thing worth
 * seeing is how much of the row is still unlit. It sits in a panel frame for
 * the same reason the chart does, because an unlit block on a white page is
 * darker than a lit one and the row would read backwards in light mode.
 */
export function GoalBlocks({ best, goal }: { best: number; goal: number }) {
  return (
    <div className="oled-panel-frame">
      <div
        className="flex gap-[3px]"
        role="img"
        aria-label={`Best single set ${best} of ${goal}.`}
      >
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className="h-6 flex-1"
            style={{ background: i < best ? "var(--oled-on)" : "var(--oled-dim)" }}
          />
        ))}
      </div>
    </div>
  );
}
