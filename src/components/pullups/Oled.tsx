/**
 * The 0.96" SSD1306 next to the bar, drawn to scale.
 *
 * Everything here is in the panel's own units: 128 x 64, one unit per pixel,
 * shape-rendering="crispEdges" so it stays pixel-exact at any size. The layout
 * mirrors drawIdle() in the firmware rather than reinterpreting it, down to the
 * y positions (0, 14, 52) and the 5x7 font's 6-unit advance.
 *
 * The panel does NOT invert in light mode. It is an object on the page, not a
 * background, the same argument globals.css makes for /fun's white card and
 * /story's cream polaroids. A screen that turns white when the site does is a
 * picture of nothing.
 */

const ON = "var(--oled-on)";

/* The firmware positions text by computing the 5x7 font's 6-unit advance by
   hand. Reproducing that arithmetic here put the big number visibly off
   centre, because Silkscreen's advance is not Adafruit's. Anchors instead:
   same result, and correct for whatever glyphs the digits turn out to be. */

export function OledPanel({
  today,
  sets,
  best,
  goal,
  daysLeft,
  offline = false,
  beat = false,
}: {
  today: number;
  sets: number;
  best: number;
  goal: number;
  daysLeft: number;
  offline?: boolean;
  /** Lit briefly when a new set lands, so the panel shows it is live. */
  beat?: boolean;
}) {
  const big = String(today);
  const bigSize = 4;

  const right = offline ? "no wifi" : `${daysLeft}d`;
  const prLabel = `PR ${best}/${goal}`;
  const setsLabel = `${sets} sets`;

  return (
    <svg
      viewBox="0 0 128 64"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Bar-side screen: ${today} pull-ups today across ${sets} sets, best set ever ${best} of a ${goal} goal, ${daysLeft} days left.`}
      className="oled-panel w-full"
    >
      <rect x="0" y="0" width="128" height="64" fill="var(--oled-off)" />

      {/* Top row: TODAY on the left, days remaining on the right. */}
      <text x="0" y="7" className="oled-text" fontSize="8" fill={ON}>
        TODAY
      </text>
      <text x="128" y="7" textAnchor="end" className="oled-text" fontSize="8" fill={ON}>
        {right}
      </text>

      {/* The count, centred, exactly as bigNumber(today, 14, 4) places it. */}
      <text
        x="64"
        y={14 + 8 * bigSize - 2}
        textAnchor="middle"
        className="oled-text"
        fontSize={8 * bigSize}
        fill={ON}
      >
        {big}
      </text>

      {/* Bottom row: sets today on the left, the PR against the goal right. */}
      <text x="0" y="59" className="oled-text" fontSize="8" fill={ON}>
        {setsLabel}
      </text>
      <text x="128" y="59" textAnchor="end" className="oled-text" fontSize="8" fill={ON}>
        {prLabel}
      </text>

      {/* One pixel, bottom left of the header row, lit for a moment when the
          numbers actually change. No words, and nothing to read when nothing
          is happening. */}
      <rect
        x="124"
        y="20"
        width="3"
        height="3"
        fill={beat ? ON : "var(--oled-dim)"}
      />
    </svg>
  );
}
