"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OledPanel } from "@/components/pullups/Oled";
import { PixelChart, GoalBlocks } from "@/components/pullups/PixelChart";
import {
  PULLUP_FEED,
  densify,
  dayOf,
  sumOver,
  type PullupStats,
} from "@/lib/pullups";

/**
 * The page, seeded by the server and kept current by polling.
 *
 * The server render is what the first paint and any JS-less visitor gets, so
 * the page is never blank and never flashes a loading state. From there this
 * polls the endpoint directly. That endpoint sets permissive CORS and turns out
 * not to be CDN-cached at all (Cloudflare answers DYNAMIC for edge functions
 * and drops the cache-control), so every poll is a genuinely fresh read.
 *
 * Polling stops while the tab is hidden and fires once immediately on return,
 * so a page left open on a second monitor is not making a request every twenty
 * seconds all day, and is still correct the moment it is looked at.
 */

const POLL_MS = 20_000;

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

export function LiveDashboard({ initial }: { initial: PullupStats }) {
  const [stats, setStats] = useState<PullupStats>(initial);
  const [beat, setBeat] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(PULLUP_FEED, { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as PullupStats;
      if (next?.ok !== true) return;
      setStats((prev) => {
        // Blink the panel's corner pixel only when something actually changed,
        // so it reads as "a rep landed" rather than "a timer fired".
        const a = JSON.stringify(prev.days);
        const b = JSON.stringify(next.days);
        if (a !== b) {
          setBeat(true);
          setTimeout(() => setBeat(false), 900);
        }
        return next;
      });
    } catch {
      // A dropped poll is not worth surfacing. The numbers on screen stay put
      // and the next tick tries again.
    }
  }, []);

  useEffect(() => {
    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(refresh, POLL_MS);
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const today = dayOf(stats.days, stats.today);
  const last30 = densify(stats.days, stats.today, 30);
  const week = sumOver(stats.days, stats.today, 7);
  const prevWeek = sumOver(stats.days, stats.today, 14) - week;
  const allTime = stats.days.reduce((a, d) => a + d.total, 0);
  const activeDays = stats.days.filter((d) => d.total > 0).length;

  const weekDelta = week - prevWeek;
  const weekSub = prevWeek === 0 ? "" : `${weekDelta >= 0 ? "+" : ""}${weekDelta} vs prev`;

  const recent = [...stats.days].reverse().slice(0, 14);

  return (
    <>
      <section className="mt-10">
        <div className="oled-bezel mx-auto max-w-[420px]">
          <OledPanel
            today={today?.total ?? 0}
            sets={today?.sets ?? 0}
            best={stats.best_ever}
            goal={stats.goal}
            daysLeft={stats.days_left}
            beat={beat}
          />
        </div>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="This week" value={String(week)} sub={weekSub || undefined} />
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
      </section>

      <section className="mt-12">
        <PixelChart days={last30} label="Daily reps, last 30 days" />
      </section>

      {/* The table view. Everything above is one series and one glance; the
          actual numbers live here, and this is what a screen reader gets. */}
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
    </>
  );
}
