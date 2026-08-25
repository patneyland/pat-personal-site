/**
 * The canonical origin, with no trailing slash.
 *
 * Used by robots.ts and sitemap.ts, which need absolute URLs. layout.tsx sets
 * the same value as `metadataBase`. If the domain ever changes, both places
 * have to change.
 */
export const SITE = "https://www.patrickneyland.com";
