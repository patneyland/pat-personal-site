/**
 * The garden's two marks.
 *
 * PLACEHOLDER. These are drawn here in code so the garden has something in the
 * right shape and the right weight while it waits for Patrick's own hand. They
 * are geometry, not his line. Replacing them means swapping the two path
 * strings below and nothing else, so this file is the whole seam.
 *
 * They exist because the garden used to label its entries with emoji: a
 * seedling, a herb and a sunflower, which rendered as full-colour vendor
 * artwork inside a two-colour world and changed shape between Windows, Mac and
 * Android. On a site whose visual thesis is Patrick's own pencil, that was
 * borrowed art. See docs/refinement.md section 4.2.
 *
 * The pen: one stroke weight, round caps, no fill, currentColor. Whatever
 * replaces these should measure the same, because the weight is what makes a
 * mark look like it came from the same hand as the next one.
 */

/** The pen, in the same terms the house on /fun uses: a ratio, not a pixel. */
const STROKE = 1.6;

export type Mark = "note" | "line";

const PATHS: Record<Mark, React.ReactNode> = {
  /* Something is written here. A stem with one leaf off it. */
  note: (
    <>
      <path d="M8 14.5V6" />
      <path d="M8 8.2c0-2.9 2.3-5.2 5.2-5.2 0 2.9-2.3 5.2-5.2 5.2Z" />
      <path d="M8 10.4c0-2-1.6-3.6-3.6-3.6 0 2 1.6 3.6 3.6 3.6Z" />
    </>
  ),
  /* A title so far, and nothing under it yet. A seed on the ground. */
  line: (
    <>
      <path d="M3.5 14h9" />
      <path d="M8 11.2c1.6 0 2.9-1.3 2.9-2.9S9.6 4 8 4 5.1 6.7 5.1 8.3s1.3 2.9 2.9 2.9Z" />
    </>
  ),
};

export default function PenMark({
  mark,
  size = 16,
}: {
  mark: Mark;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {PATHS[mark]}
    </svg>
  );
}
