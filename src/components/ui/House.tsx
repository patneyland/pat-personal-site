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
 *    That size is a maximum: on a card too narrow to hold it (see W_EXPR
 *    below) the whole drawing scales down, pen included, so it is always
 *    complete rather than sometimes full-scale and cropped.
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

/** Eave to eave: the house's full width at Gary's own scale, in px. */
const WIDTH = 13.5 * U;

/** The viewBox below, which is the drawing plus its pen margins. */
const VIEW_W = 139;
const VIEW_H = 159;

/**
 * How wide the house may render, as CSS. Percentages resolve against the
 * card, which is the house's containing block, so this is one expression the
 * browser re-evaluates at every card width and no JS measures anything.
 *
 * Full size is WIDTH, the size Gary gives it. It shrinks only when a smaller
 * card forces it, for two reasons:
 *
 * - So it is never clipped and never dwarfs the card: 38% of the card is the
 *   most it may take.
 * - So the greeting bubble cannot draw over the roof. The greeting is up to
 *   320px wide (GREET_W in GaryPacing), anchored near the card's left edge,
 *   with its underside 120px above the card top (his height 72 plus the 48px
 *   gap). So the house is clear of it when either its left edge stays right
 *   of x = 328 (the `94% - 328px` term: 94% is where its right edge sits,
 *   given `right: 6%`), or it is shorter than 112px, which keeps the whole
 *   roof below the bubble (the 98px floor: 112 / (VIEW_H / VIEW_W)).
 *
 * If GREET_W, GAP, or Gary's height change in GaryPacing, the 328 and 98
 * change with them.
 */
const W_EXPR = `min(${WIDTH.toFixed(2)}px, 38%, max(94% - 328px, 98px))`;

/**
 * The vertical room the card's wrapper must hold open above itself so the
 * house is never cut off by the section's overflow: hidden. Imported by
 * Hero.tsx as a margin-top on the wrapper: margin rather than padding,
 * because the house hangs from the wrapper's top edge (`bottom: 100%`) and
 * padding would lift it off the card's ground line.
 *
 * It is the house's rendered height less 24px, because the section keeps
 * 2rem of its own padding above the wrapper: the apex still clears the clip
 * edge by 8px on the tightest layout, and every looser layout has centring
 * slack on top of that.
 */
export const HOUSE_HEADROOM = `calc(${W_EXPR} * ${(VIEW_H / VIEW_W).toFixed(5)} - 24px)`;

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

export default function House({ right = "6%", ink = "var(--gary-ink)" }: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right,
        /* The card's top edge is the ground line, the same one his feet use. */
        bottom: "100%",
        width: W_EXPR,
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        pointerEvents: "none",
        /* Behind his track, which is a sibling. He walks in front of it. */
        zIndex: 0,
      }}
    >
      {/* The svg fills the div, so shrinking the div scales the whole
          drawing, stroke included: a smaller house is drawn with a
          proportionally finer pen, which keeps the line weight the same
          relative to the building. Gary's own pen is matched at full size. */}
      <svg
        viewBox={`80.5 8.5 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="100%"
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
