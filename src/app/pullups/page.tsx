import type { Metadata } from "next";
import { Silkscreen } from "next/font/google";

import { LiveDashboard } from "@/components/pullups/LiveDashboard";
import { getPullupStats } from "@/lib/pullups";

/* The panel's own typeface. Scoped to this page rather than layout.tsx: no
   other district wants a pixel font, and it should not ride in the payload of
   every page to serve one. */
const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
  display: "swap",
});

/**
 * Unlisted, not secret. It is absent from SECTIONS so the nav never shows it,
 * and absent from sitemap.ts so nothing enumerates it, and this says so to any
 * crawler that finds the URL anyway. Anyone with the link can read it, which is
 * the intent.
 */
export const metadata: Metadata = {
  title: "Pull-ups",
  description: "A button next to a pull-up bar, counting toward 20 consecutive.",
  robots: { index: false, follow: false },
};

export const revalidate = 60;

export default async function PullupsPage() {
  const stats = await getPullupStats();

  if (!stats) {
    return (
      <main className={`${silkscreen.variable} mx-auto max-w-narrow px-6 py-20`}>
        <h1 className="oled-text text-xl text-ink">Pull-ups</h1>
        <p className="oled-text mt-4 text-sm text-muted">No signal.</p>
      </main>
    );
  }

  return (
    <main className={`${silkscreen.variable} mx-auto max-w-narrow px-6 py-16`}>
      <header>
        <h1 className="oled-text text-xl text-ink">Pull-ups</h1>
      </header>

      {/* Server-rendered once for the first paint, then it polls itself. */}
      <LiveDashboard initial={stats} />

      <footer className="oled-text mt-16 border-t border-edge pt-6 text-[0.6rem] uppercase tracking-[0.2em] text-faint">
        {stats.timezone}
      </footer>
    </main>
  );
}
