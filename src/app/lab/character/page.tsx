import { notFound } from "next/navigation";
import CharacterLab from "./CharacterLab";

/**
 * A workbench for the character pipeline, not a page on the site.
 *
 * It does not exist in production: the route is here so the pipeline can be
 * checked against a real browser during a working session, and nothing links
 * to it. See docs/character-session-1.md.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CharacterLab />;
}
