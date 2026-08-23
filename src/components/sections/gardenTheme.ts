/* The garden world. Shared by the plot and the reading pages. */
export const G = {
  ground: "#101a13",
  ink: "#e0e9d9",
  inkSoft: "#8fa286",
  accent: "#9ecb7e",
  edge: "rgba(158,203,126,0.2)",
  edgeHot: "rgba(158,203,126,0.55)",
};

export const STAGE_META = {
  seed: { label: "Seed", glyph: "•" },
  sprout: { label: "Sprout", glyph: "🌱" },
  growing: { label: "Growing", glyph: "🌿" },
  ripe: { label: "Ready to pick", glyph: "🌻" },
} as const;
