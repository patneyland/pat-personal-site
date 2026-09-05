/* The portfolio world.
 *
 * Portfolio used to accent with the site's base gold, which meant it wore the
 * same colour as /fun and the nav could not tell the two apart. It has its own
 * hue now: a clean, cool blue, sitting opposite the warm districts (gold home,
 * cream story) and clear of the garden's green.
 *
 * Ground and ink are the site's cool neutrals from globals.css rather than
 * page-local values, because portfolio is the district closest to the site's
 * default. Only the accent is its own.
 */
export const P = {
  ground: "var(--bg)",
  card: "var(--bg-card)",
  ink: "var(--text)",
  inkSoft: "var(--text-muted)",
  accent: "var(--hue-portfolio)",
  /* Dimmed for resting borders, so a card edge is tinted rather than lit. */
  accentDim: "color-mix(in srgb, var(--hue-portfolio) 55%, var(--bg))",
  edge: "var(--border)",
  edgeHot: "color-mix(in srgb, var(--hue-portfolio) 45%, transparent)",
  surface: "var(--bg-card)",
  surfaceHot: "color-mix(in srgb, var(--hue-portfolio) 5%, transparent)",
};
