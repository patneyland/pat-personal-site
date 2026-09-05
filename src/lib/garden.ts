import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

/**
 * What a garden entry is.
 *
 * There used to be a `stage` field with four values: seed, sprout, growing,
 * ripe. It was cut on 2026-09-04. Nobody could fill it in honestly, including
 * its author, so it was a taxonomy that looked like information and was not.
 * All four values rendered an identical card with a different word in it.
 *
 * What replaced it is the rule that a signal has to be true without anyone
 * making a judgment call. Exactly one thing about an entry qualifies, and it
 * was already being computed here: whether there is anything to read yet.
 *
 *   note - something is written, or it points somewhere that has writing.
 *          It links.
 *   line - a title and a date so far. It does not link.
 *
 * Neither is labelled on the page, because the difference is already visible:
 * one is a block you can click and the other is a line you cannot. The honesty
 * the stages were reaching for is carried by the page's own eyebrow instead,
 * once, at the top, in Patrick's words.
 *
 * See docs/refinement.md section 4.
 */
export type Kind = "note" | "line";

export type Entry = {
  slug: string;
  title: string;
  kind: Kind;
  planted: string;
  tended: string;
  tags: string[];
  /** Set to point the entry off-site, at a Substack post for example. */
  external: string | null;
  /** Rendered markdown body, or null when the file is frontmatter only. */
  body: string | null;
  /**
   * The entry's own opening line, as plain text, for the plot.
   *
   * Lifted from what Patrick already wrote rather than authored separately, so
   * there is no second place to keep in sync and no copy on this site that he
   * did not write. Null when nothing is written yet.
   */
  excerpt: string | null;
};

/** First paragraph of rendered markdown, as plain text, trimmed to fit a card. */
function firstParagraph(rendered: string | null): string | null {
  if (!rendered) return null;
  const m = rendered.match(/<p>([\s\S]*?)<\/p>/);
  if (!m) return null;
  const text = m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&#x26;|&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= 165) return text;
  const cut = text.slice(0, 165);
  return cut.slice(0, cut.lastIndexOf(" ")) + "...";
}

const DIR = path.join(process.cwd(), "content", "garden");

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

      const external = data.external ? String(data.external) : null;

      return {
        slug,
        title: String(data.title ?? slug),
        // Derived, never authored. This is the whole point: no field for
        // Patrick to get wrong, and it cannot drift out of date.
        kind: (body || external ? "note" : "line") as Kind,
        planted: data.planted ? String(data.planted) : "",
        tended: data.tended ? String(data.tended) : "",
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        external,
        body,
        excerpt: firstParagraph(body),
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
