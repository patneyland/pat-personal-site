import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { getItems } from "@/lib/portfolio";
import { getEntries } from "@/lib/garden";

/**
 * Everything Gary is allowed to know, assembled from the files that already
 * build the site.
 *
 * The whole corpus is a few thousand tokens, which is why there is no retrieval
 * layer here and should not be one. See docs/gary-chat.md.
 *
 * Nothing in this file is hand-maintained. Add a portfolio entry and Gary knows
 * about it on the next deploy, which is what stops him linking to pages that no
 * longer exist.
 */

const ROOT = process.cwd();

/** Rendered blurbs come back as HTML. Gary reads prose, not markup. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The story is written as JSX inside Story.tsx rather than as markdown, so the
 * prose is pulled out of the <Note> blocks and the handwritten captions.
 *
 * This is deliberately forgiving. If the component is restructured and the
 * patterns stop matching, Gary loses some story detail and still works, rather
 * than the build breaking. site-notes.md carries a summary as the floor.
 */
function readStory(): string {
  const file = path.join(ROOT, "src", "components", "sections", "Story.tsx");
  if (!fs.existsSync(file)) return "";
  const source = fs.readFileSync(file, "utf8");

  const notes = [...source.matchAll(/<Note[^>]*>([\s\S]*?)<\/Note>/g)]
    .map((m) => stripHtml(m[1]).replace(/\{"\s*"\}/g, " ").trim())
    .filter(Boolean);

  const captions = [...source.matchAll(/\bhand="([^"]+)"/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);

  if (!notes.length) return "";

  return [
    "The /story page is a polaroid collage of Patrick's path, in this order.",
    captions.length ? `Card captions: ${captions.join("; ")}.` : "",
    ...notes.map((n, i) => `${i + 1}. ${n}`),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The front page at / is the whole of resume.md, frontmatter aside. */
function readResume(): string {
  const file = path.join(ROOT, "content", "resume.md");
  if (!fs.existsSync(file)) return "";
  const { content } = matter(fs.readFileSync(file, "utf8"));
  return content.trim();
}

function readSiteNotes(): string {
  const file = path.join(ROOT, "src", "lib", "gary", "site-notes.md");
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").trim();
}

export type Corpus = {
  text: string;
  /** Every internal path Gary is allowed to link to. */
  routes: string[];
};

export async function buildCorpus(): Promise<Corpus> {
  // getItems and getEntries already drop `draft: true`, which is the filter
  // that keeps unpublished work out of Gary's mouth. Do not bypass them.
  const [items, entries] = await Promise.all([getItems(), getEntries()]);

  const portfolio = items
    .map((item) => {
      const where = item.href
        ? `${item.internal ? "internal link" : "external link"}: ${item.href}`
        : "no link";
      const blurb = item.blurb ? ` ${stripHtml(item.blurb)}` : "";
      return `- ${item.title} (${item.tag}${item.year ? `, ${item.year}` : ""}; ${where}).${blurb}`;
    })
    .join("\n");

  const garden = entries
    .map((entry) => {
      const where = entry.external
        ? `external link: ${entry.external}`
        : entry.body
          ? `internal link: /garden/${entry.slug}`
          : "no page of its own";
      const body = entry.body ? ` ${stripHtml(entry.body)}` : "";
      return `- ${entry.title} (stage: ${entry.stage}; ${where}).${body}`;
    })
    .join("\n");

  const routes = [
    "/",
    "/fun",
    "/story",
    "/portfolio",
    "/portfolio/woodworking",
    "/garden",
    ...entries.filter((e) => e.body).map((e) => `/garden/${e.slug}`),
    ...items
      .filter((i) => i.internal && i.href)
      .map((i) => i.href as string),
  ];

  const text = [
    "## The front page at /",
    "This is the plain resume, in Patrick's own words, word for word:",
    readResume(),
    "",
    "## Patrick's story, at /story",
    readStory(),
    "",
    "## What he has built, at /portfolio",
    portfolio || "Nothing published yet.",
    "",
    "## The garden, at /garden",
    "Works in progress, marked seed, sprout, growing or ripe.",
    garden || "Nothing planted yet.",
    "",
    "## Notes about the site",
    readSiteNotes(),
  ].join("\n");

  return { text, routes: [...new Set(routes)] };
}
