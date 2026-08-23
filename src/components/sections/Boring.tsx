import fs from "node:fs";
import path from "node:path";
import { remark } from "remark";
import html from "remark-html";

/**
 * The front door, and it is deliberately undesigned.
 *
 * A resume, set the way a resume is set: Times, white, sections, dated
 * entries, bullets, blue underlined links. It opens with a note asking you not
 * to settle for it.
 *
 * All content comes from content/resume.md. The plainness is the point, so do
 * not add design to this page.
 */
export default async function Boring() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "content", "resume.md"),
    "utf8",
  );

  /**
   * sanitize: false lets Patrick write raw HTML directly in resume.md when
   * markdown is not granular enough, and keeps markdown for everything else.
   * (remark-html uses `sanitize`, not `allowDangerousHtml`, which silently
   * strips tags instead of erroring.)
   *
   * Safe here because the only author is the repo owner and this runs at build
   * time. Never point this at content submitted by anyone else.
   */
  const rendered = String(
    await remark().use(html, { sanitize: false }).process(source),
  );

  return (
    <main className="boring">
      <div dangerouslySetInnerHTML={{ __html: rendered }} />
    </main>
  );
}
