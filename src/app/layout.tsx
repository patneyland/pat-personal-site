import type { Metadata } from "next";
import {
  Playfair_Display,
  DM_Sans,
  JetBrains_Mono,
  Caveat,
  EB_Garamond,
} from "next/font/google";
import "./globals.css";
import Nav from "@/components/ui/Nav";
import { SITE } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { GaryProvider, GaryPanel } from "@/components/ui/GaryChat";
import { readVoice, readGreeting } from "@/lib/gary/prompt";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
});

/* The scripture on /fun. A Garamond revival rather than Times: same old book
   authority, but rounder bowls and a warmer, less clinical colour on the page.
   Upright only. The verse is set roman, so the italic face would be dead
   weight in the page's font payload. */
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-scripture",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * The description is Patrick's own line from content/resume.md, word for word.
 * It is what Google prints under the title and what a pasted link shows in
 * Slack or LinkedIn, so it should say what the front page says. If the front
 * page line changes, change this to match rather than writing a new one.
 */
const DESCRIPTION =
  "I am an AI engineer and researcher. I am currently on a leave of absence from my PhD program, to get more hands-on experience with AI.";

export const metadata: Metadata = {
  /**
   * Required for the relative openGraph image path below to resolve. Without
   * it Next emits a warning and social crawlers get a relative URL they cannot
   * fetch, so the preview card silently loses its image.
   */
  metadataBase: new URL(SITE),
  title: "Patrick Neyland",
  description: DESCRIPTION,
  openGraph: {
    title: "Patrick Neyland",
    description: DESCRIPTION,
    siteName: "Patrick Neyland",
    /* No url here on purpose. Set in the layout it is inherited by every
       page, so each one would claim the homepage as its canonical URL.
       Left out, sharing a page identifies that page. */
    type: "website",
    images: [
      {
        url: "/assets/headshot.png",
        width: 512,
        height: 512,
        alt: "Patrick Neyland",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Patrick Neyland",
    description: DESCRIPTION,
    images: ["/assets/headshot.png"],
  },
};

/**
 * Stamps data-theme on <html> before the first paint.
 *
 * Dark, always, whatever the machine is set to. Patrick, 2026-09-05: "I want
 * the default to be dark, not computer." That is a design call rather than a
 * technical one, and it is the right one here: dark is the palette the site
 * was built in, and the black ground is what makes the /fun card and a white
 * Gary work. Light is the compromise version, so nobody should be dropped
 * into it by an OS setting they set for a different reason. The toggle is how
 * you get there.
 *
 * Nothing is stored either. A click holds while you move around the site,
 * because App Router navigation leaves the document and its stamp alone, and
 * a hard reload puts you back on dark.
 *
 * It stays inline and in <head> even though the value is now a constant,
 * because the alternative is writing the attribute into the server-rendered
 * <html> tag, and React would then own it and clobber the toggle's change on
 * the next render. globals.css has no prefers-color-scheme query for the same
 * reason it never did: the CSS describes two states and the light palette is
 * written down once.
 *
 * The arcade never sees any of this. It is a static document in
 * public/arcade/ with its own reset and its own tokens, served outside this
 * layout, and it stays exactly as it is whatever the rest of the site does.
 */
const THEME_STAMP =
  `document.documentElement.setAttribute("data-theme","dark");`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${caveat.variable} ${ebGaramond.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_STAMP }} />
      </head>
      <body className="bg-bg text-ink antialiased">
        {/* Gary's panel is mounted here rather than in /fun on purpose. His job
            is handing out links, and a panel inside a page would unmount
            itself the moment a visitor followed one. See docs/gary-chat.md. */}
        <GaryProvider enabled={readVoice().ok} greeting={readGreeting()}>
          <Nav />
          {children}
          <GaryPanel />
        </GaryProvider>
        {/* Page views only. No cookies, and it reports nothing until
            Analytics is switched on for the project in the Vercel dashboard. */}
        <Analytics />
      </body>
    </html>
  );
}
