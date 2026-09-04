"use client";

/**
 * One verse, walking across the bottom of /fun forever.
 *
 * The track holds two identical copies of the line and slides left by exactly
 * half its own width, so the moment the first copy clears the frame the second
 * is sitting where it started and the loop is invisible. Because the travel is
 * measured against the text and not the frame, the words move at the same
 * speed however wide the card gets.
 *
 * The gap after each copy is what keeps it from reading as a wall of words. It
 * is part of the copy width, so it scrolls along with everything else.
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

/**
 * One copy of the line. Every copy is decoration: the accessible version is
 * the single static link below the track, so these are taken out of the tab
 * order rather than putting two identical links in a visitor's way.
 */
function Line() {
  return (
    <span className="shrink-0 whitespace-nowrap" style={{ paddingRight: "7rem" }}>
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
  return (
    <div className="scripture-marquee relative w-full overflow-hidden">
      {/* Decoration. Hovering holds it still, which is the only way a moving
          reference is clickable. */}
      <div className="scripture-track flex w-max" aria-hidden>
        <Line />
        <Line />
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
