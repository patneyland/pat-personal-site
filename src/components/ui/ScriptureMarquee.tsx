"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * One verse, walking across the bottom of /fun forever.
 *
 * The track holds two identical copies of the line and slides left by exactly
 * half its own width, so the moment the first copy clears the frame the second
 * is sitting where it started and the loop is invisible. Because the travel is
 * measured against the text and not the frame, the words move at the same
 * speed however wide the card gets.
 *
 * On load the whole thing starts three quarters of a frame off to the right,
 * so a visitor sees the verse from its first word rather than joining it
 * mid-sentence, and the line is already a quarter across at t=0 rather than
 * making them watch empty space first. That entrance is a separate animation
 * on a separate wrapper: one transform cannot both walk in and loop, and
 * stacking them on nested elements composes cleanly where a single element
 * would fight itself.
 */

/* Verbatim from churchofjesuschrist.org, semicolon and all: the sentence runs
   on into verse 28, so it does not end on a full stop. Do not tidy it. */
const VERSE =
  "Verily I say, men should be anxiously engaged in a good cause, and do many things of their own free will, and bring to pass much righteousness;";

const REFERENCE = "Doctrine and Covenants 58:27";

/* Deep link to the verse itself rather than the section, so it opens scrolled
   to and highlighting v27 instead of at the top of a long chapter. */
const SOURCE =
  "https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/58?lang=eng&id=p27#p27";

/* Seconds for the loop to travel one whole copy of the line. This is the one
   number that sets the reading pace; the entrance derives its own duration
   from it so both move at the same speed. */
const LOOP_SECONDS = 46;

/* How far off to the right the verse begins, as a share of the frame. A full
   1 starts it past the right edge on a bare screen; 0.75 has it already a
   quarter of the way in when the page opens, which is enough to read from the
   beginning without a wait. It shortens the entrance rather than hurrying it:
   the speed is set by the loop either way. */
const ENTRANCE_FRACTION = 0.75;

/**
 * One copy of the line. Every copy is decoration: the accessible version is
 * the single static link below the track, so these are taken out of the tab
 * order rather than putting two identical links in a visitor's way.
 */
function Line({ measureRef }: { measureRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={measureRef}
      className="shrink-0 whitespace-nowrap"
      style={{ paddingRight: "7rem" }}
    >
      {VERSE}
      <span
        style={{
          color: "var(--accent)",
          padding: "0 0.9em",
          fontSize: "0.75em",
          verticalAlign: "0.12em",
        }}
      >
        &#9674;
      </span>
      <a
        href={SOURCE}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={-1}
        className="scripture-ref"
      >
        {REFERENCE}
      </a>
    </span>
  );
}

export default function ScriptureMarquee() {
  const frameRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const [introSeconds, setIntroSeconds] = useState<number | null>(null);

  /**
   * The entrance covers ENTRANCE_FRACTION of a frame; the loop covers one copy
   * width in LOOP_SECONDS. Dividing the first by the second's speed is what
   * keeps the verse from sprinting in and then settling, or crawling in on a
   * phone where the frame is narrow. Measured in a layout effect so the
   * duration is set before the first paint and the animation never visibly
   * retimes.
   */
  useLayoutEffect(() => {
    const measure = () => {
      const frame = frameRef.current;
      const copy = copyRef.current;
      if (!frame || !copy) return;
      const pxPerSecond = copy.offsetWidth / LOOP_SECONDS;
      if (pxPerSecond > 0) {
        setIntroSeconds((frame.offsetWidth * ENTRANCE_FRACTION) / pxPerSecond);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={frameRef}
      className="scripture-marquee relative w-full overflow-hidden"
      style={
        {
          "--scripture-loop": `${LOOP_SECONDS}s`,
          "--scripture-from": `${ENTRANCE_FRACTION * 100}%`,
          ...(introSeconds ? { "--scripture-intro": `${introSeconds}s` } : {}),
        } as CSSProperties
      }
    >
      {/* Decoration. Hovering holds it still, which is the only way a moving
          reference is clickable. */}
      <div className="scripture-intro" aria-hidden>
        <div className="scripture-track flex w-max">
          <Line measureRef={copyRef} />
          <Line />
        </div>
      </div>

      {/* The same verse, standing still, for screen readers and for anyone
          reaching the link by keyboard. */}
      <p className="sr-only">
        {VERSE}{" "}
        <a href={SOURCE} target="_blank" rel="noopener noreferrer">
          {REFERENCE}
        </a>
      </p>
    </div>
  );
}
