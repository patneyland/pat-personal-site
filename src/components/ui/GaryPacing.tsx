"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gary, pacing the top edge of the card.
 *
 * The only interesting part is that his speed is not chosen, it is derived.
 * The sprite advances a fixed distance per walk cycle, so if the element moves
 * at any other rate his feet slide along the edge. Everything below exists to
 * make travel-per-second equal stride-per-cycle.
 *
 *   stride  98px at source scale, where the figure is 177px tall
 *           (measured off the drawings: 49px step length, two steps per cycle)
 *
 * The sheet is cropped so its bottom row is his lowest foot pixel, which is
 * why bottom: 100% lands him exactly on the card's edge at any size.
 */

const FRAMES = 8;
const FPS = 12;
const STRIDE_RATIO = 98 / 177; // distance per cycle, as a fraction of his height
const HEIGHT = 72; // display height of one cell, px
const ASPECT = 114 / 144;

export default function GaryPacing() {
  const track = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth - HEIGHT * ASPECT;
      if (width <= 0) return;
      // one cycle covers STRIDE_RATIO of his height, and a cycle takes
      // FRAMES/FPS seconds, so this is the only speed his feet agree with
      const speed = (STRIDE_RATIO * HEIGHT) / (FRAMES / FPS);
      setSeconds((width / speed) * 2); // there and back
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={track}
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "100%",
        height: HEIGHT,
        containerType: "inline-size",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        data-gary
        style={
          {
            position: "absolute",
            bottom: 0,
            width: HEIGHT * ASPECT,
            height: HEIGHT,
            "--gary-w": `${HEIGHT * ASPECT}px`,
            backgroundImage: "url(/assets/gary-pace.png)",
            backgroundSize: `${HEIGHT * ASPECT * FRAMES}px ${HEIGHT}px`,
            animation: seconds
              ? `gary-step ${FRAMES / FPS}s steps(${FRAMES}) infinite,` +
                ` gary-pace ${seconds}s linear infinite`
              : "none",
          } as React.CSSProperties
        }
      />
    </div>
  );
}
