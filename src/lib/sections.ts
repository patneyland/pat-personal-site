/**
 * The districts.
 *
 * One row per section of the site, and the single place a section's identity
 * colour is written down.
 *
 * The nav reads this and wears each district's hue, which turns the menu into
 * a legend: a visitor learns that green means garden by looking at it, before
 * they ever click. Arriving in a district then confirms what the nav promised,
 * because the same hue is what the page accents with.
 *
 * Adding a section means adding a row here and nowhere else. See
 * docs/refinement.md section 0.
 *
 * Two rules for a hue:
 *
 * 1. It has to be legible on the nav bar's near-black, so a district whose
 *    page colour is dark gets a brightened version here rather than the exact
 *    value the page uses. Home's gold is the case in point.
 * 2. It has to be tellable apart from every other row at a glance. That is the
 *    whole job. Two districts in the same hue means the legend says nothing.
 */
export type Section = {
  href: string;
  label: string;
  hue: string;
};

export const SECTIONS: Section[] = [
  /* Gold, brightened off the /fun accent (#b8922a) so it reads on the bar. */
  { href: "/fun", label: "Home", hue: "#d9a83c" },
  /* The story is cream paper, so its hue is the paper. */
  { href: "/story", label: "Story", hue: "#e6d9bf" },
  /* See portfolioTheme.ts. The one district that did not have its own colour. */
  { href: "/portfolio", label: "Portfolio", hue: "#7fc0e8" },
  /* See gardenTheme.ts. */
  { href: "/garden", label: "Garden", hue: "#9ecb7e" },
];

/** The district a path is inside, or null for the front door and anything unlisted. */
export function sectionFor(pathname: string): Section | null {
  return SECTIONS.find((s) => pathname.startsWith(s.href)) ?? null;
}
