/**
 * The districts.
 *
 * One row per section of the site, in nav order.
 *
 * These used to carry a hue each, and the nav wore them so the bar doubled as
 * a legend. Patrick cut that on 2026-09-05: the nav is one colour now. A
 * district's own hue still exists, in gardenTheme.ts and portfolioTheme.ts and
 * as the --hue-* tokens in globals.css, and is worn by the page itself rather
 * than announced in the menu.
 *
 * Adding a section means adding a row here and nowhere else.
 */
export type Section = {
  href: string;
  label: string;
};

export const SECTIONS: Section[] = [
  { href: "/fun", label: "Home" },
  { href: "/story", label: "Story" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/garden", label: "Garden" },
];

/** The district a path is inside, or null for the front door and anything unlisted. */
export function sectionFor(pathname: string): Section | null {
  return SECTIONS.find((s) => pathname.startsWith(s.href)) ?? null;
}
