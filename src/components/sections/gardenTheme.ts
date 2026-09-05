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
  accent: "#a9a3ec",
  accentDim: "#4f4a86",
  edge: "var(--border)",
  edgeHot: "rgba(169,163,236,0.45)",
  surface: "rgba(255,255,255,0.015)",
  surfaceHot: "rgba(169,163,236,0.05)",
};
