import type { MetadataRoute } from "next";

import { getEntries } from "@/lib/garden";
import { SITE } from "@/lib/site";

/**
 * Every route a reader can reach. The garden section is generated from
 * content/garden, so adding a markdown file adds it here with no code change.
 * Drafts are already filtered out by getEntries, and an entry with no body has
 * no page of its own, so neither shows up.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ["", "/fun", "/story", "/portfolio", "/portfolio/woodworking", "/garden"];

  const entries = await getEntries();
  const gardenPages = entries
    .filter((entry) => entry.body)
    .map((entry) => `/garden/${entry.slug}`);

  return [...fixed, ...gardenPages].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: "monthly" as const,
  }));
}
