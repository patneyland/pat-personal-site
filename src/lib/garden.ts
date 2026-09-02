import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

export const STAGES = ["seed", "sprout", "growing", "ripe"] as const;
export type Stage = (typeof STAGES)[number];

export type Entry = {
  slug: string;
  title: string;
  stage: Stage;
  planted: string;
  tended: string;
  tags: string[];
  /** Set to point the card off-site, at a Substack post for example. */
  external: string | null;
  /** Rendered markdown body, or null when the file is frontmatter only. */
  body: string | null;
};

const DIR = path.join(process.cwd(), "content", "garden");

function isStage(value: unknown): value is Stage {
  return STAGES.includes(value as Stage);
}

/**
 * Rewrite [[some-slug]] into a link to that entry.
 *
 * Runs before markdown so the output goes through the normal pipeline. The
 * garden is small today, but writing this way from the start is what makes
 * densely linked notes possible later without a migration.
 */
function expandWikiLinks(source: string, titles: Map<string, string>): string {
  return source.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_all, rawSlug, label) => {
    const slug = String(rawSlug).trim();
    const text = (label ?? titles.get(slug) ?? slug).toString().trim();
    return `[${text}](/garden/${slug})`;
  });
}

function readFiles() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const slug = name.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(DIR, name), "utf8");
      const { data, content } = matter(raw);
      return { slug, data, content };
    });
}

export async function getEntries(): Promise<Entry[]> {
  const files = readFiles();

  const titles = new Map(
    files.map((f) => [f.slug, String(f.data.title ?? f.slug)]),
  );

  const entries = await Promise.all(
    files.map(async ({ slug, data, content }) => {
      const trimmed = content.trim();
      // sanitize:false keeps raw HTML in the markdown, which is what lets an
      // entry use <figure>/<figcaption> around an illustration. Safe here
      // because every entry in content/garden is written by hand, never by a
      // reader. Without it remark-html silently drops the tags.
      const body = trimmed
        ? String(
            await remark()
              .use(html, { sanitize: false })
              .process(expandWikiLinks(trimmed, titles)),
          )
        : null;

      return {
        slug,
        title: String(data.title ?? slug),
        stage: isStage(data.stage) ? data.stage : "seed",
        planted: data.planted ? String(data.planted) : "",
        tended: data.tended ? String(data.tended) : "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        external: data.external ? String(data.external) : null,
        body,
      } satisfies Entry;
    }),
  );

  // Most recently tended first. A garden shows what is being worked on, not
  // what was planted longest ago.
  return entries.sort((a, b) => (b.tended || b.planted).localeCompare(a.tended || a.planted));
}

export async function getEntry(slug: string): Promise<Entry | null> {
  const entries = await getEntries();
  return entries.find((e) => e.slug === slug) ?? null;
}
