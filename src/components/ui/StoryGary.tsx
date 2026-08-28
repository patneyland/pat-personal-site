"use client";

import { useEffect } from "react";
import { Character } from "@/lib/character/player";
import {
  buildRoute,
  measurePlatforms,
  pacePose,
  restingPose,
  sampleRoute,
  type Platform,
  type Route,
} from "@/lib/character/route";

const MANIFEST = "/assets/character/character.json";

/**
 * The cards he crosses, in order. Anything not listed he flies over.
 *
 * `presenting` is deliberately left off: it sits in the same row as `neyland`,
 * so a hop between them would have no scroll to happen in.
 *
 * The torn note is on, and it has to be. It is the last thing still on screen
 * when the page bottoms out, so it is the only surface he can finish on
 * without sliding up behind the nav bar. It also happens to be the right
 * ending: he crosses the whole career and lands on the real stuff.
 */
export const ROUTE_KEYS = [
  "graduation",
  "masters",
  "fiscalsim",
  "asu",
  "neyland",
  "realstuff",
];

export interface StoryGaryProps {
  /** The board the polaroids live in. He is appended to it. */
  board: HTMLElement | null;
  /** Height on screen, in px. */
  height?: number;
  /** Below this viewport width the cards stack and he stays away. */
  minWidth?: number;
  /** Bump to re-measure: images loading, reveals settling, a layout change. */
  version?: number;
  /** Draw the surfaces and the arcs he is following. */
  debug?: boolean;
  /** Overrides for the numbers worth arguing about, from the lab. */
  strides?: Record<string, number>;
  onSample?: (info: { clip: string; dir: number; scroll: number }) => void;
}

/**
 * Gary crossing the story board.
 *
 * He is appended to the board rather than rendered into it, so the board's own
 * markup does not have to know he exists. Everything he does comes out of
 * `route.ts`; the only thing this file decides is which way the reader is
 * travelling, because that is the one fact scroll position alone cannot tell
 * you.
 */
export default function StoryGary({
  board,
  height = 66,
  minWidth = 720,
  version = 0,
  debug = false,
  strides,
  onSample,
}: StoryGaryProps) {
  useEffect(() => {
    if (!board) return;

    /* Narrow layouts stack every polaroid into one column. The hops would be
       vertical drops down a corridor barely wider than he is, which is not the
       thing Patrick drew, so he simply is not there. */
    if (window.innerWidth < minWidth) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let alive = true;
    let raf = 0;
    let char: Character | null = null;
    let route: Route | null = null;
    let platforms: Platform[] = [];

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:5;color:var(--fg,#EDEDE8)";
    board.append(layer);

    let svg: SVGSVGElement | null = null;
    if (debug) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.style.cssText =
        "position:absolute;inset:0;pointer-events:none;z-index:4;overflow:visible";
      board.append(svg);
    }

    /* The one thing that is remembered. Gait counts distance without a sign,
       so his legs cycle forwards even when the reader is going back up the
       page and his body is retracing its steps. Feed it signed distance and
       he moonwalks. */
    let gait = 0;
    let lastDist: number | null = null;
    let lastScroll = window.scrollY;
    let facing = 1;
    let dirty = true;
    /* Milliseconds he has been standing on the last surface. The reader has
       stopped supplying a clock by then, so this is the one that drives the
       settle and the pacing after it. Reset the moment he is anywhere else. */
    let resting = 0;
    /* Whether the pacing walk has already started. The gait counter has the
       whole journey in it by the time he gets here, so it would drop him into
       the walk at an arbitrary frame, and the ease-in then holds that frame
       for a quarter of a second. Setting off is a fresh cycle. */
    let pacing = false;

    const paintDebug = () => {
      if (!svg || !route) return;
      const r = board.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
      svg.setAttribute("width", String(r.width));
      svg.setAttribute("height", String(r.height));
      const bits = platforms.map(
        (p) =>
          `<polyline points="${p.edge.map((q) => `${q.x},${q.y}`).join(" ")}" fill="none" stroke="#4ade80" stroke-width="2"/>`,
      );
      for (const seg of route.segs) {
        if (seg.kind !== "air") continue;
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const x = seg.from.x + (seg.to.x - seg.from.x) * u;
          const drop = seg.to.y - seg.from.y;
          pts.push(
            `${x},${seg.from.y + (drop + seg.rise) * u * u - seg.rise * u}`,
          );
        }
        bits.push(
          `<polyline points="${pts.join(" ")}" fill="none" stroke="#f472b6" stroke-width="2" stroke-dasharray="5 6"/>`,
        );
      }
      svg.innerHTML = bits.join("");
    };

    /**
     * Re-read the board.
     *
     * This runs on every scroll, not once at startup, and that is deliberate.
     * The page settles for a long time after it first paints: images arrive,
     * fonts swap, reveals fire. A route measured once is a route measured
     * against a layout that no longer exists, and the failure is silent, so he
     * just quietly lands somewhere that used to be a polaroid. Five offset
     * lookups per scroll event is a cheap price for never having to wonder.
     */
    const measure = () => {
      if (!char) return;
      const m = measurePlatforms(board, ROUTE_KEYS);
      platforms = m.platforms;
      route = buildRoute(platforms, {
        height: window.innerHeight,
        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
        boardDocTop: m.boardDocTop,
        charHeight: height,
      });
      paintDebug();
    };

    Character.load(MANIFEST)
      .then((c) => {
        if (!alive) return;
        char = c;
        c.mount(layer);
        /* He is white ink, and half the surfaces he crosses are photographs
           with white in them. A shadow traced from his own alpha is what keeps
           him readable over both grounds; on the dark board it costs nothing
           because there is nothing for it to darken. It goes on his own root
           rather than on the layer, which spans the whole board and would be
           an enormous surface to rasterise every frame. */
        (layer.firstElementChild as HTMLElement).style.filter =
          "drop-shadow(0 0 2px rgba(0,0,0,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
        c.play("run");
        measure();

        if (still) {
          // Motion is unwelcome, so he does not move. He is still on the page
          // though, standing where he would have set off from: the drawing is
          // part of the story, only the running is decoration.
          const pose = restingPose(platforms);
          if (!pose) return;
          c.play(pose.clip);
          c.setScale(height / c.box[1]);
          c.setPhase(0);
          c.setTilt(pose.tilt);
          c.placeFeet(pose.x, pose.y);
          return;
        }

        let lastT = performance.now();

        const frame = (t: number) => {
          if (!alive || !char) return;
          raf = requestAnimationFrame(frame);
          const dt = t - lastT;
          lastT = t;

          const s = window.scrollY;
          if (s !== lastScroll || dirty) {
            dirty = false;
            measure();
          }
          if (!route) return;
          /* At the very top of the page he has not set off yet, so he stands
             on the first card rather than being caught mid-stride with both
             feet off the paper. He starts running the moment the reader does. */
          let pose = s <= 0 ? restingPose(platforms) : sampleRoute(route, s);
          if (!pose) return;

          /* The end of the line. He has arrived, the page has run out, and
             nobody is scrolling: from here he keeps himself company. */
          if (pose.rest) {
            resting += dt;
            pose = pacePose(pose.rest, resting, pose.dist);
            if (pose.gaitDriven && !pacing) gait = 0;
            pacing = pose.gaitDriven;
            /* And here his facing is his own, not the reader's. Deriving it
               from the scroll direction, as everything above does, leaves it
               frozen the moment the page stops moving, which is exactly when
               he starts pacing: he would walk the return leg backwards. */
            facing = pose.dir;
          } else {
            resting = 0;
            pacing = false;
            if (s !== lastScroll) facing = pose.dir * (s > lastScroll ? 1 : -1);
          }
          lastScroll = s;

          char.play(pose.clip);
          const scale = height / char.box[1];
          char.setScale(scale);

          if (pose.ambient) {
            // The one thing that is not a function of the page. Standing still
            // has to keep going once the reader stops scrolling.
            char.tick(dt);
          } else if (pose.gaitDriven) {
            const stride =
              strides?.[pose.clip] ??
              char.manifest.clips[pose.clip]?.stride ??
              char.box[0];
            if (lastDist !== null) gait += Math.abs(pose.dist - lastDist);
            char.setPhase(gait / (stride * scale));
          } else {
            char.setPhase(pose.phase);
          }
          lastDist = pose.dist;

          char.setFacing(facing);
          char.setTilt(pose.tilt);
          char.placeFeet(pose.x, pose.y);

          onSample?.({ clip: pose.clip, dir: facing, scroll: s });
        };
        raf = requestAnimationFrame(frame);
      })
      .catch(() => {
        /* No atlas, no Gary. The story reads exactly as it did before. */
      });

    const touch = () => {
      dirty = true;
    };
    const ro = new ResizeObserver(touch);
    ro.observe(board);
    ro.observe(document.documentElement);
    window.addEventListener("resize", touch);
    const settle = [300, 900, 1800].map((ms) => setTimeout(touch, ms));

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", touch);
      settle.forEach(clearTimeout);
      layer.remove();
      svg?.remove();
    };
  }, [board, height, minWidth, version, debug, strides, onSample]);

  return null;
}
