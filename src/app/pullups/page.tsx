import type { Metadata } from "next";
import { Silkscreen } from "next/font/google";

import { OledPanel } from "@/components/pullups/Oled";
import { PixelChart, GoalBlocks } from "@/components/pullups/PixelChart";
import { densify, getPullupStats, sumOver, dayOf } from "@/lib/pullups";

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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-edge bg-bg-card px-4 py-3">
      <div className="oled-text text-[0.6rem] uppercase tracking-[0.2em] text-faint">
        {label}
      </div>
      <div className="oled-text mt-1 text-2xl text-ink">{value}</div>
      {sub && <div className="oled-text mt-1 text-[0.65rem] text-muted">{sub}</div>}
    </div>
  );
}

export default async function PullupsPage() {
  const stats = await getPullupStats();

  if (!stats) {
    return (
      <main className={`${silkscreen.variable} mx-auto max-w-narrow px-6 py-20`}>
        <h1 className="oled-text text-xl text-ink">Pull-ups</h1>
        <p className="oled-text mt-4 text-sm text-muted">
          The counter is not answering right now. It does this when the network
          is down, and it keeps the reps in flash until it comes back, so
          nothing is lost. Try again in a minute.
        </p>
      </main>
    );
  }

  const today = dayOf(stats.days, stats.today);
  const last30 = densify(stats.days, stats.today, 30);
  const week = sumOver(stats.days, stats.today, 7);
  const prevWeek = sumOver(stats.days, stats.today, 14) - week;
  const allTime = stats.days.reduce((a, d) => a + d.total, 0);
  const activeDays = stats.days.filter((d) => d.total > 0).length;

  const weekDelta = week - prevWeek;
  const weekSub =
    prevWeek === 0
      ? "first week on record"
      : `${weekDelta >= 0 ? "+" : ""}${weekDelta} vs the week before`;

  const recent = [...stats.days].reverse().slice(0, 14);

  return (
    <main className={`${silkscreen.variable} mx-auto max-w-narrow px-6 py-16`}>
      <header>
        <h1 className="oled-text text-xl text-ink">Pull-ups</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          There is a button and a small screen next to my pull-up bar. I tap it
          once per rep, walk away, and five seconds later the set is in a
          database. This page is that database, drawn the way the screen draws
          it. The goal is <strong className="text-ink">{stats.goal} consecutive</strong>{" "}
          by {stats.deadline}.
        </p>
      </header>

      {/* The screen itself, showing what is on the wall right now. */}
      <section className="mt-10">
        <div className="oled-bezel mx-auto max-w-[420px]">
          <OledPanel
            today={today?.total ?? 0}
            sets={today?.sets ?? 0}
            best={stats.best_ever}
            goal={stats.goal}
            daysLeft={stats.days_left}
          />
        </div>
        <p className="oled-text mt-3 text-center text-[0.6rem] uppercase tracking-[0.2em] text-faint">
          live, give or take a minute
        </p>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This week" value={String(week)} sub={weekSub} />
        <Stat label="Best set" value={`${stats.best_ever}/${stats.goal}`} sub="all time" />
        <Stat label="Days left" value={String(stats.days_left)} sub={`to ${stats.deadline}`} />
        <Stat label="All time" value={String(allTime)} sub={`over ${activeDays} days`} />
      </section>

      <section className="mt-12">
        <h2 className="oled-text text-[0.7rem] uppercase tracking-[0.2em] text-muted">
          Best set against the goal
        </h2>
        <div className="mt-3">
          <GoalBlocks best={Math.min(stats.best_ever, stats.goal)} goal={stats.goal} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {stats.goal - stats.best_ever > 0
            ? `${stats.goal - stats.best_ever} to go. The number that moves this is daily volume, not any single attempt.`
            : "Goal reached."}
        </p>
      </section>

      <section className="mt-12">
        <PixelChart days={last30} label="Daily reps, last 30 days" />
      </section>

      {/* The table view. Every chart above is one series and one glance; this
          is where the actual numbers live, and it is what a screen reader and a
          printout get. */}
      <section className="mt-12">
        <h2 className="oled-text text-[0.7rem] uppercase tracking-[0.2em] text-muted">
          Recent days
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-muted">
              <th className="py-2 font-normal">Day</th>
              <th className="py-2 text-right font-normal">Reps</th>
              <th className="py-2 text-right font-normal">Sets</th>
              <th className="py-2 text-right font-normal">Best</th>
              <th className="py-2 text-right font-normal">Each set</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.day} className="border-b border-border-subtle">
                <td className="py-2 text-muted">{d.day}</td>
                <td className="py-2 text-right text-ink">{d.total}</td>
                <td className="py-2 text-right text-muted">{d.sets}</td>
                <td className="py-2 text-right text-muted">{d.best}</td>
                <td className="py-2 text-right text-faint">{d.reps.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-16 border-t border-edge pt-6 text-xs leading-relaxed text-faint">
        An ESP32 with a 0.96&quot; OLED and an arcade button, on the wall by the
        bar. It posts each set to a Postgres function through a Supabase edge
        function, and queues to flash when the wifi drops so a dead router never
        costs a rep. Times are {stats.timezone}.
      </footer>
    </main>
  );
}
