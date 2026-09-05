/**
 * The way into the arcade: a CX40, the joystick that came with the Atari 2600.
 *
 * Drawn here rather than taken from lucide, which the rest of the site uses
 * exclusively. Lucide has Gamepad2 and Joystick and neither is this: Gamepad2
 * is an Xbox pad, forty years too late for what the arcade page is doing, and
 * Joystick is a generic stick on a wide flat base with a stub hanging off one
 * side. Patrick asked for an Atari, 2026-09-05, and the CX40 is a specific
 * object: a base that tapers as it goes back, one stick, and a single round
 * button in the corner. That button is the whole tell, so it is worth the
 * exception. The lucide-only rule still holds for every UI icon.
 *
 * Drawn on lucide's own 24x24 grid at strokeWidth 1.5 so it sits at the same
 * weight as the icons beside it in the nav. Checked at 15px, the size the nav
 * actually uses, where the button survives as a dot and the taper still reads.
 */

type Props = {
  size?: number;
  strokeWidth?: number;
};

export default function AtariJoystick({ size = 15, strokeWidth = 1.5 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* The base, wider at the front than the back. */}
      <path d="M5.2 14h13.6a1.4 1.4 0 0 1 1.35 1.03l1 4A1.4 1.4 0 0 1 19.8 21H4.2a1.4 1.4 0 0 1-1.35-1.97l1-4A1.4 1.4 0 0 1 5.2 14Z" />
      {/* The stick, and the knob on top of it. */}
      <path d="M12 14V8" />
      <circle cx="12" cy="6" r="2.2" />
      {/* The red one. */}
      <circle cx="7" cy="18" r="1.3" />
    </svg>
  );
}
