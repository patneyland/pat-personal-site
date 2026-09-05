/* The garden world.
 *
 * A hue, and nothing else. Patrick ruled out a depicted garden on 2026-09-04:
 * no moss, no soil, no shafts of overhead light. He then cut the green itself
 * later the same day, so the ground is now the site's own dark and only the
 * accent tells the district apart.
 *
 * Periwinkle sits next to the portfolio's blue on purpose. The two pages are
 * laid out identically and are meant to read as siblings, with the colour
 * carrying the difference. See docs/refinement.md section 0.
 */
export const G = {
  ground: "var(--bg)",
  ink: "var(--text)",
  inkSoft: "var(--text-muted)",
  accent: "var(--hue-garden)",
  accentDim: "color-mix(in srgb, var(--hue-garden) 55%, var(--bg))",
  edge: "var(--border)",
  edgeHot: "color-mix(in srgb, var(--hue-garden) 45%, transparent)",
  surface: "color-mix(in srgb, var(--text) 2%, transparent)",
  surfaceHot: "color-mix(in srgb, var(--hue-garden) 5%, transparent)",
};
