/**
 * The bar-side pull-up counter's public feed.
 *
 * The endpoint is deliberately open and deliberately narrow: it can return
 * pull-up history and nothing else, so this site holds no Supabase credentials
 * at all. The alternative, a service key in this project's env, would give a
 * public website read access to an entire personal health database in order to
 * draw a bar chart.
 *
 * Source of the numbers is an ESP32 next to the bar. Tap once per rep, stop
 * tapping, and five seconds later the set is in Postgres.
 */

export const PULLUP_FEED =
  "https://pikvadotiruvanjjnfid.supabase.co/functions/v1/pullup-stats";

export type PullupDay = {
  day: string; // YYYY-MM-DD, local to the device's timezone
  total: number;
  sets: number;
  best: number;
  reps: number[]; // each set of that day, in the order they were done
};

export type PullupStats = {
  ok: true;
  goal: number;
  deadline: string;
  days_left: number;
  today: string;
  best_ever: number;
  timezone: string;
  days: PullupDay[];
};

/**
 * Revalidated every 60s, matching the endpoint's own CDN cache. The device
 * commits a set five seconds after the last tap, so a minute is the difference
 * between "live" and "live enough" for a page about pull-ups.
 */
export async function getPullupStats(): Promise<PullupStats | null> {
  try {
    const res = await fetch(PULLUP_FEED, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as PullupStats | { ok: false };
    if (!("ok" in data) || data.ok !== true) return null;
    return data;
  } catch {
    // A dashboard for a hobby is not worth a 500. The page renders its
    // disconnected state instead, which is also what the real screen does.
    return null;
  }
}

/** Fills gaps so a chart shows rest days as zero rather than closing over them. */
export function densify(days: PullupDay[], upTo: string, span: number): PullupDay[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const end = new Date(upTo + "T00:00:00Z");
  const out: PullupDay[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { day: key, total: 0, sets: 0, best: 0, reps: [] });
  }
  return out;
}

/** Total reps over the last `span` days, today included. */
export function sumOver(days: PullupDay[], upTo: string, span: number): number {
  return densify(days, upTo, span).reduce((a, d) => a + d.total, 0);
}

export function dayOf(days: PullupDay[], key: string): PullupDay | null {
  return days.find((d) => d.day === key) ?? null;
}
