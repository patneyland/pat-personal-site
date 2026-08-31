/**
 * The house Patrick drew, rebuilt from its schedule rather than traced.
 *
 * Every number below comes from `docs/drawing-to-geometry.md`, which is the
 * source of truth. Read it before changing anything here: the numbers are not
 * taste, they are a reading of the drawing, and each one is defended there.
 *
 * Two things make this a piece of the world rather than a decoration.
 *
 * 1. It is sized against Gary, not against the viewport. He is 5.5u tall in the
 *    drawing and 72px tall on the page, so one schedule unit is 13.09px and the
 *    house lands at 177 x 202. Change his display height and the house follows,
 *    which is why GARY_HEIGHT is duplicated here rather than a magic 13.09.
 *
 * 2. It is drawn with his pen. His sprite is a 2x sheet 144px tall inked at
 *    5 to 6px through the torso, which is 0.19u to 0.23u at his scale. PEN is
 *    0.27u rather than 0.23u because that is what it took to measure equal on
 *    screen: an antialiased SVG stroke reads thinner than the sprite's hard
 *    edged ink at the same nominal width. Both now render 3.5 CSS px, checked
 *    by sampling the same screenshot. Matching his weight is what stops the
 *    house reading as a different hand.
 *
 * The SVG coordinates are the schedule's, scaled by ten and flipped: 1u = 10,
 * and the schedule's origin (the foot of the left wall, y up) is at (90, 165).
 * That is why the numbers here are the same numbers as in the doc.
 */

/** Must match HEIGHT in GaryPacing. The house is sized off him. */
const GARY_HEIGHT = 72;
/** His height in schedule units, measured off the drawing he stands in. */
const GARY_UNITS = 5.5;

/**
 * How much smaller than the schedule the house is drawn.
 *
 * This is the one place the build knowingly departs from the drawing. At 1 the
 * house is 2.8 times Gary, which is what he drew; Patrick asked for it a touch
 * smaller once it was on the page, so it stands at 2.5 times him instead. Set
 * this back to 1 to get the drawing's own proportion.
 */
const SCALE = 0.88;

const U = (GARY_HEIGHT / GARY_UNITS) * SCALE;

/** Eave to eave, and ground to apex. */
const WIDTH = 13.5 * U;
const HEIGHT = 15.4 * U;

/**
 * Gary's body line as it renders, in schedule units. See the note above.
 *
 * Divided by SCALE because the pen is not part of the house. Shrinking the
 * building shrinks its roof board, which is a real dimension of the roof, but
 * the pen has to keep drawing at his weight or the house stops matching him,
 * which was the whole point of measuring it.
 */
const PEN = 0.27 / SCALE;
/** The roof is a drawn board, not a pen width: it measured 0.43u. */
const PLANK = 0.45;

interface Props {
  /**
   * Inset from the card's right edge, as a CSS length. He paces the whole
   * width, so this only decides where along his walk he passes in front of it.
   */
  right?: string;
  /**
   * Ink. Gary's sprite is pure white, so the house matches him by default.
   *
   * The trade to know about: at full white his outline merges into the window
   * mullions on the frames where he walks across the front, because both are
   * white line art of the same weight on the same ground. Dropping this to
   * something like `rgba(255,255,255,0.42)` pushes the house behind him and
   * fixes it, at the cost of the house reading lighter than he does.
   */
  ink?: string;
}

export default function House({ right = "6%", ink = "#ffffff" }: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right,
        /* The card's top edge is the ground line, the same one his feet use. */
        bottom: "100%",
        width: WIDTH,
        height: HEIGHT,
        pointerEvents: "none",
        /* Behind his track, which is a sibling. He walks in front of it. */
        zIndex: 0,
      }}
    >
      <svg
        viewBox="80.5 8.5 139 159"
        width={WIDTH}
        height={HEIGHT}
        fill="none"
        stroke={ink}
        strokeWidth={PEN * 10}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Wall: 12u x 8u. Verticals only, because the gable is open to the
            roof and the ground is the card's edge. */}
        <line x1="90" y1="85" x2="90" y2="165" />
        <line x1="210" y1="85" x2="210" y2="165" />

        {/* Roof: isoceles, 80 degree apex, 0.75u of overhang each side, sitting
            0.6u down over the wall so its underside crosses the wall tops. That
            drop is the whole reason the corners are closed. */}
        <polyline
          points="82.5,91 150,11 217.5,91"
          strokeWidth={PLANK * 10}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* Gable window: circle r 1u, 3u above the eaves, on the axis. */}
        <circle cx="150" cy="55" r="10" />
        <line x1="150" y1="45" x2="150" y2="65" />
        <line x1="140" y1="55" x2="160" y2="55" />

        {/* Door: 3u x 6.5u, centred, semicircular head springing at y 5. */}
        <path d="M135,165 L135,115 A15,15 0 0 1 165,115 L165,165" />
        <circle cx="140" cy="140" r="1.5" fill={ink} stroke="none" />

        {/* Windows: 3u x 4u, 1u in from each corner, 0.5u off the door. */}
        <rect x="100" y="110" width="30" height="40" />
        <line x1="115" y1="110" x2="115" y2="150" />
        <line x1="100" y1="130" x2="130" y2="130" />

        <rect x="170" y="110" width="30" height="40" />
        <line x1="185" y1="110" x2="185" y2="150" />
        <line x1="170" y1="130" x2="200" y2="130" />
      </svg>
    </div>
  );
}
