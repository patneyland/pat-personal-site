import { notFound } from "next/navigation";
import StoryGaryLab from "./StoryGaryLab";

/**
 * Gary crossing the story board, with the knobs exposed.
 *
 * Not a page on the site. It renders the real /story section and lays the
 * route over it, so what is being judged is the actual layout rather than a
 * diagram of it. Nothing links here and it does not build in production.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StoryGaryLab />;
}
