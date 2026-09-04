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
