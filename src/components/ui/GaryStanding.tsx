"use client";

import { useGary } from "@/components/ui/GaryChat";

/**
 * Gary, standing, on the pages he does not walk.
 *
 * He was on two of four pages, and the two he was missing from are the two
 * that feel least like the rest of the site. Worse, his conversation could not
 * be *started* anywhere else: GaryPanel renders only once `open` is true, and
 * the only things that set it were GaryPacing on /fun and StoryGary on /story.
 * Follow a link off either page and the talk came with you; arrive anywhere
 * else cold and he was unreachable. This is the fix.
 *
 * Deliberately still. On /fun he paces and on /story he runs the polaroids,
 * because those pages are his. The portfolio and the garden have work to do,
 * so he stands at the end of the rule under the heading and waits to be
 * clicked. His energy scales down as the page gets more serious.
 *
 * He does not claim the conversation, so the corner panel presents it. A
 * bubble off his head would be better and is what the other two pages do, but
 * that needs the placement work in lib/bubblePlacement.ts to understand a
 * third context. Not worth it to get him standing here.
 *
 * The sprite is the same two-pose facing sheet /fun uses when he stops to
 * talk, cycling slowly so he reads as alive rather than as a decal. Only the
 * white sheet, no `-solid` companion: that second layer exists so he can knock
 * a hole in the house behind him on /fun, and there is nothing behind him here.
 */

/* Measured off gary-facing.png: two poses in a 114x144 cell. */
const CELL_W = 114;
const CELL_H = 144;
const FRAMES = 2;
/* Seconds for both poses. Slow on purpose; he is idling, not animating. */
const CYCLE = 1.6;

export default function GaryStanding({
  /* 72 is his display height on /fun. Same character, same size, so he does
     not read as a different Gary from page to page. */
  height = 72,
  title = "Ask Gary about this site",
}: {
  height?: number;
  title?: string;
}) {
  const { enabled, setOpen } = useGary();

  /* content/gary.md has no voice in it, so there is nobody to talk to. */
  if (!enabled) return null;

  const width = height * (CELL_W / CELL_H);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={title}
      aria-label={title}
      style={
        {
          width,
          height,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "block",
          flexShrink: 0,
          backgroundImage: "url(/assets/gary-facing.png)",
          backgroundSize: `${width * FRAMES}px ${height}px`,
          backgroundRepeat: "no-repeat",
          animation: `gary-step ${CYCLE}s steps(${FRAMES}) infinite`,
          "--gary-w": `${width}px`,
          "--gary-cells": -FRAMES,
        } as React.CSSProperties
      }
    />
  );
}
