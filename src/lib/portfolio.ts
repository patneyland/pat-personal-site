import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

export type Item = {
  slug: string;
  order: number;
  tag: string;
  year: string;
  title: string;
  /** Where the card goes. Omit for entries that are not linked anywhere. */
  href: string | null;
  /** Link text. Defaults to "Take a look" when there is an href but no cta. */
  cta: string | null;
  /** Internal routes use next/link instead of opening a new tab. */
  internal: boolean;
  /** Thumbnail path under public/. `npm run thumbnails` can generate these. */
  image: string | null;
  /**
   * Rendered markdown body, or null.
   *
   * Optional on purpose. A link with a thumbnail is a complete entry, the same
   * way a one sentence seed is a complete garden entry.
   */
  blurb: string | null;
};

const DIR = path.join(process.cwd(), "content", "portfolio");

export async function getItems(): Promise<Item[]> {
  if (!fs.existsSync(DIR)) return [];

  const files = fs.readdirSync(DIR).filter((n) => n.endsWith(".md"));

  const items = await Promise.all(
    files.map(async (name) => {
      const slug = name.replace(/\.md$/, "");
      const { data, content } = matter(
        fs.readFileSync(path.join(DIR, name), "utf8"),
      );

      const trimmed = content.trim();
      const blurb = trimmed
        ? String(await remark().use(html).process(trimmed))
        : null;

      const href = data.href ? String(data.href) : null;

      return {
        draft: data.draft === true,
        slug,
        order: Number.isFinite(Number(data.order)) ? Number(data.order) : 999,
        tag: String(data.tag ?? ""),
        year: data.year ? String(data.year) : "",
        title: String(data.title ?? slug),
        href,
        cta: href ? String(data.cta ?? "Take a look") : null,
        internal: data.internal === true,
        image: data.image ? String(data.image) : null,
        blurb,
      };
    }),
  );

  // `draft: true` keeps an entry in the repo but off the page, for work that
  // is real but not ready to show yet.
  const published: Item[] = items
    .filter((i) => !i.draft)
    .map((i) => {
      const item = { ...i } as Partial<typeof i>;
      delete item.draft;
      return item as Item;
    });

  // Explicit order, then filename, so the grid never shuffles between builds.
  return published.sort(
    (a, b) => a.order - b.order || a.slug.localeCompare(b.slug),
  );
}
