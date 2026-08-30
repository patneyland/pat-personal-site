/**
 * The journey across the story board, as a pure function of scroll position.
 *
 * The whole design turns on one decision. Gary's position is not a simulation
 * that gets stepped forward; it is `where(scrollY)`. Nothing about him is
 * remembered between frames except which way the page last moved.
 *
 * That is what buys the behaviour Patrick asked for. Scrolling back up does
 * not need a rewind mode, because there is nothing to rewind: the same
 * function returns the same place, and the only thing that changes is the sign
 * of the reader's travel, which is exactly what decides which way he faces. A
 * state machine would have to be taught to undo every transition, and would
 * get it wrong the first time somebody flicked a trackpad mid-jump.
 *
 * There are exactly two exceptions, both at the very end, and both because a
 * reader who has stopped scrolling has stopped supplying the clock: the
 * standing pose breathes, and then he paces. Everything before that is scroll.
 *
 * The other accumulator is the gait, in the caller: it counts distance walked
 * without a sign, so the legs always cycle forwards while the body goes back
 * the way it came. Feeding it signed distance is what makes a character
 * moonwalk.
 */

export interface Pt {
  x: number;
  y: number;
}

/**
 * Something to stand on, as a walkable line in board coordinates.
 *
 * Two points for a polaroid, whose top edge is straight. More for the torn
 * note, whose top is a clip path: a run of tears that rise to the top of the
 * box and dip 6% of its height between them. Storing that as a polyline is
 * what lets him walk it rather than hover over the low parts of it.
 */
export interface Platform {
  key: string;
  /** Vertices of the top edge, left to right. */
  edge: Pt[];
  /** Distance along the edge at each vertex. The last entry is the total. */
  cum: number[];
  /** Document-space extent, for anchoring the route to the reader's scroll. */
  docTop: number;
  docBottom: number;
}

export type Gait = "walk" | "run";

/** The final beat. He holds here, and then walks this span under his own clock. */
export interface Rest {
  p: Platform;
  /** Where he stops, and the ends of the stretch he paces between. */
  at: number;
  from: number;
  to: number;
}

type Seg =
  | {
      kind: "stand";
      s0: number;
      s1: number;
      p: Platform;
      t: number;
      dir: number;
      clip: "land" | "stand";
      d0: number;
      rest?: Rest;
    }
  | {
      kind: "ground";
      s0: number;
      s1: number;
      p: Platform;
      t0: number;
      t1: number;
      clip: Gait;
      d0: number;
      len: number;
    }
  | {
      kind: "air";
      s0: number;
      s1: number;
      from: Pt;
      to: Pt;
      rise: number;
      d0: number;
      len: number;
    };

export interface Route {
  segs: Seg[];
  s0: number;
  s1: number;
}

export interface Pose {
  x: number;
  y: number;
  clip: string;
  /** 0..1 through the clip, for the clips that are not gait driven. */
  phase: number;
  /** Which way the body is travelling along the route, +1 right. */
  dir: number;
  tilt: number;
  /** Distance covered so far. Signed; the caller takes the absolute step. */
  dist: number;
  gaitDriven: boolean;
  /** Runs on its own clock rather than on the reader's. */
  ambient?: boolean;
  /** Present only on the last pose, where the caller takes over the clock. */
  rest?: Rest;
}

/** What the route needs to know about the window it has to stay inside. */
export interface Viewport {
  height: number;
  /** Furthest the reader can scroll. */
  maxScroll: number;
  /** Document y of the board's origin, so board points can be put on screen. */
  boardDocTop: number;
  /** How tall he is drawn. Headroom has to clear his head, not his feet. */
  charHeight: number;
}

/* ── Tuning ─────────────────────────────────────────────────────────────
   Everything not listed here is geometry measured off the page. */

/**
 * Clear window kept above his head and below his feet, in pixels.
 *
 * These are a constraint rather than a preference, and the departure anchors
 * below are solved backwards from them. The nav bar sits across the top of the
 * window, so the headroom has to clear that too.
 */
const TOP_SAFE = 74; // the sticky nav is 54 tall, so this clears it by 20
const BOTTOM_SAFE = 76;
/**
 * Slack on the headroom, in pixels.
 *
 * The arc is solved for his feet, and three things sit above them that the
 * solve does not know about: the drawing itself reaches higher than his
 * nominal height on the frames where his arms go up, the lean pivots on his
 * feet so it swings his head as well as tipping it, and the two passes leave a
 * residual of their own. Measured together they came to under two pixels, so
 * this is mostly margin on the margin, and it costs nothing but leaving each
 * card six pixels sooner.
 */
const TOP_SLACK = 6;
/**
 * How much of the gap between two departures is spent in the air. The rest is
 * spent on the card he landed on.
 */
const AIR_SHARE = 0.46;
/**
 * Scroll span of the landing beat, and of a walk back for a running start.
 *
 * The landing beat is two drawings held still. Much longer than this and it
 * stops reading as absorbing the impact and starts reading as stuck, wide eyed
 * face and all.
 */
const LAND_SPAN = 60;
const BACKUP_SHARE = 0.42;
/** After the last surface he walks in, stops, and settles. */
const REST_TAIL = 280;
/** Floors for a hop and for the run before it, when the page is running out. */
const MIN_AIR = 150;
const MIN_GROUND = 150;
/**
 * Scroll a card needs before he will bother walking to the back of it for a
 * running start. Below this the there-and-back covers more distance than the
 * page has room to show, and it reads as a shuttle rather than a run up.
 */
const RUNUP_MIN = 200;
/**
 * How high he actually climbs above the edge he leaves, in board pixels.
 *
 * Note what this is not. The arc is y = (drop + rise)u^2 - rise*u, so `rise`
 * is a throw coefficient rather than a height, and the apex it produces is
 * only rise^2 / (4 * (drop + rise)). Against the drops on this page a rise of
 * 40 bought three quarters of one pixel: he ran off the edge, played the jump
 * drawing, and started falling, with no hop in between. Tuning the height and
 * solving for the coefficient is what makes the hop visible.
 *
 * It also makes every hop climb the same amount whatever is below it. A single
 * shared coefficient does the opposite, because the same throw over a longer
 * drop is a flatter arc, so the biggest gaps got the smallest hops.
 */
const HOP_RISE = 26;

/**
 * The throw coefficient whose apex sits HOP_RISE above the launch edge.
 *
 * Inverting apex = rise^2 / (4 * (drop + rise)) for rise. A drop clamped at
 * zero because landing higher than he left only ever needs more throw, and the
 * extra comes out of the same arc for free.
 */
const riseFor = (drop: number) =>
  2 * HOP_RISE + 2 * Math.sqrt(HOP_RISE * (HOP_RISE + Math.max(drop, 0)));
/**
 * Where along an edge he plants his feet at either end of a hop. He leaves
 * from the very end of a card and comes down well in from the end of the next
 * one. Dead on the corner reads as precarious, and the collage's own dashed
 * connectors are aimed at exactly those corners, so landing there put an
 * arrowhead through him twice on the way down the page.
 */
const NEAR_EDGE = 0.22;
const FAR_EDGE = 0.9;
/**
 * How far past the launching card's own edge he must come down.
 *
 * Without this, two cards that overlap horizontally produce a hop that goes
 * nowhere: he steps off the left end of one and lands on the right end of the
 * next, which is further right than he started, so the whole fall happens down
 * the face of the card he just left. On a card with a white photo that means
 * a white figure falling across white, invisible for a third of a second.
 */
const CLEAR = 60;
/** The stretch of the last surface he paces, and where he stops before it. */
const PACE_FROM = 0.15;
const PACE_TO = 0.85;
/** Never let two anchors collapse onto each other on a short page. */
const MIN_SPAN = 140;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const edgeLength = (p: Platform) => p.cum[p.cum.length - 1];

/** Index of the edge segment holding distance `d`. */
function segAt(p: Platform, d: number) {
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < d) i++;
  return i;
}

/**
 * The point `t` of the way along a surface, by distance rather than by
 * vertex. Parameterising on arc length is what keeps his speed even as he
 * crosses a tear, and what lets `pushGround` treat a span of `t` as a distance
 * the legs have to cover.
 */
export function at(p: Platform, t: number): Pt {
  const total = edgeLength(p);
  const d = Math.min(total, Math.max(0, t * total));
  const i = segAt(p, d);
  const u = (d - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1] || 1);
  return {
    x: lerp(p.edge[i - 1].x, p.edge[i].x, u),
    y: lerp(p.edge[i - 1].y, p.edge[i].y, u),
  };
}

/**
 * The slope he is standing on there, in degrees. He leans to match it.
 *
 * Measured across the span between his feet rather than at the point itself.
 * Taking the exact segment means the answer jumps the instant he crosses a
 * vertex of the tear, which on the note is a 19 degree snap in one frame and
 * throws his head sideways. A person crossing a ridge has one foot either side
 * of it, so the chord is both smoother and more nearly true.
 */
const STANCE = 26;

export function tiltAt(p: Platform, t: number): number {
  const half = STANCE / 2 / (edgeLength(p) || 1);
  const a = at(p, Math.max(0, t - half));
  const b = at(p, Math.min(1, t + half));
  if (a.x === b.x && a.y === b.y) return 0;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/**
 * A landing on `next` that is at least `CLEAR` past the far edge of `here`,
 * in the direction of travel. Anything nearer and the fall happens down the
 * front of the card he just left.
 */
function cleared(
  here: Platform,
  next: Platform,
  right: boolean,
  want: number,
): number {
  const beyond = right
    ? here.edge[here.edge.length - 1].x + CLEAR
    : here.edge[0].x - CLEAR;
  const t = tAtX(next, beyond);
  return Math.min(
    1 - NEAR_EDGE,
    Math.max(NEAR_EDGE, right ? Math.max(want, t) : Math.min(want, t)),
  );
}

/** Inverse of `at`, on x alone. Every edge here runs left to right. */
function tAtX(p: Platform, x: number): number {
  const e = p.edge;
  if (x <= e[0].x) return 0;
  if (x >= e[e.length - 1].x) return 1;
  for (let i = 1; i < e.length; i++) {
    if (x > e[i].x) continue;
    const u = (x - e[i - 1].x) / (e[i].x - e[i - 1].x || 1);
    return (p.cum[i - 1] + u * (p.cum[i] - p.cum[i - 1])) / edgeLength(p);
  }
  return 1;
}

/**
 * The walkable top of one element, in its own untransformed pixels.
 *
 * A plain card is its top two corners. An element cut by a `polygon()` clip
 * path is the run of vertices before the path turns back on itself, which for
 * the torn note is the tear across its top. Reading it from the computed style
 * rather than hard coding the numbers means the note can be re-torn in
 * `Story.tsx` without anything here knowing.
 */
function topEdge(el: HTMLElement, w: number, h: number): Pt[] {
  const m = /^polygon\(([^)]*)\)$/.exec(getComputedStyle(el).clipPath);
  if (m) {
    const pts: Pt[] = [];
    for (const pair of m[1].split(",")) {
      const [sx, sy] = pair.trim().split(/\s+/);
      const q = {
        x: sx.endsWith("%") ? (parseFloat(sx) / 100) * w : parseFloat(sx),
        y: sy.endsWith("%") ? (parseFloat(sy) / 100) * h : parseFloat(sy),
      };
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) break;
      if (pts.length && q.x <= pts[pts.length - 1].x) break; // turned the corner
      pts.push(q);
    }
    if (pts.length >= 2) return pts;
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
  ];
}

/**
 * Measure the surfaces.
 *
 * Two traps here, and both put his feet in the wrong place rather than
 * throwing anything.
 *
 * The cards are each rotated a couple of degrees, so a bounding rect is not a
 * top edge; it is the box around one. The edge has to be rebuilt from the
 * card's own untransformed geometry and its rotation.
 *
 * And the reveal animation holds every card 12px low until the reader reaches
 * it. Measure with `getBoundingClientRect` and cards below the fold are
 * recorded 12px lower than where they will settle, which is a gap you only see
 * once you scroll to them. Layout offsets do not move: `offsetTop` is where
 * the card sits, not where a transform is currently drawing it.
 *
 * Surfaces are looked up across the whole section, not just the board, because
 * the last one he stands on is the torn note and that sits outside it. Offsets
 * are taken relative to the page and then differenced against the board's, so
 * the answer is in board coordinates either way.
 */
export function measurePlatforms(
  board: HTMLElement,
  keys: string[],
): { boardDocTop: number; platforms: Platform[] } {
  const boardDocTop = board.getBoundingClientRect().top + window.scrollY;
  const scope = board.closest("section") ?? board;
  const platforms: Platform[] = [];

  /** Layout position on the page, with every ancestor transform ignored. */
  const offset = (el: HTMLElement) => {
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = el;
    while (node) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { x, y };
  };
  const origin = offset(board);

  for (const key of keys) {
    const el = scope.querySelector<HTMLElement>(`[data-surface="${key}"]`);
    if (!el) continue;

    const o = offset(el);
    const left = o.x - origin.x;
    const top = o.y - origin.y;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const ang = Math.atan2(m.b, m.a);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);

    const edge = topEdge(el, w, h).map((q) => {
      const dx = q.x - w / 2;
      const dy = q.y - h / 2;
      return {
        x: left + w / 2 + dx * cos - dy * sin,
        y: top + h / 2 + dx * sin + dy * cos,
      };
    });

    const cum = [0];
    for (let i = 1; i < edge.length; i++)
      cum.push(
        cum[i - 1] + Math.hypot(edge[i].x - edge[i - 1].x, edge[i].y - edge[i - 1].y),
      );

    platforms.push({
      key,
      edge,
      cum,
      docTop: boardDocTop + top,
      docBottom: boardDocTop + top + h,
    });
  }
  return { boardDocTop, platforms };
}

/**
 * Lay the hops out along the page.
 *
 * The departure anchors are solved from the frame rather than chosen. Falling
 * is the only part of the journey that can take him out of the window, and it
 * carries him upward before it carries him down: scroll advances at a constant
 * rate while the arc barely moves for its first third, so against the frame he
 * rises by
 *
 *     (rise + air)^2 / (4 * (drop + rise))
 *
 * before gravity catches up. Leaving each card that much lower than the
 * headroom, plus his own height, puts the peak of every hop exactly on the
 * margin instead of somewhere behind the nav bar.
 *
 * The air time depends on the departures and the departures depend on the air
 * time, so it is solved twice. The second pass moves it by a few pixels and a
 * third would not move it at all.
 */
export function buildRoute(platforms: Platform[], view: Viewport): Route {
  if (platforms.length < 2) return { segs: [], s0: 0, s1: 0 };

  const n = platforms.length;
  const { height: vh, maxScroll, boardDocTop, charHeight } = view;

  /* Where he leaves each surface and where he lands on the next. Fixing these
     first is what makes every drop a known quantity. */
  const launchT: number[] = [];
  const landT: number[] = [NEAR_EDGE];
  for (let i = 0; i < n; i++) {
    const next = platforms[i + 1];
    if (!next) {
      launchT[i] = FAR_EDGE;
      break;
    }
    const here = platforms[i];
    const right = at(next, 0.5).x >= at(here, 0.5).x;
    launchT[i] = right ? FAR_EDGE : 1 - FAR_EDGE;
    landT[i + 1] = cleared(here, next, right, right ? NEAR_EDGE : 1 - NEAR_EDGE);
  }

  const drop: number[] = [];
  for (let i = 0; i < n - 1; i++)
    drop[i] =
      at(platforms[i + 1], landT[i + 1]).y - at(platforms[i], launchT[i]).y;

  const depart: number[] = new Array(n).fill(0);
  const air = drop.map((g) => AIR_SHARE * Math.max(g, MIN_SPAN));
  /** Viewport y of his feet at the moment he leaves surface i. */
  const startY = (i: number) =>
    boardDocTop + at(platforms[i], launchT[i]).y - depart[i];

  const solve = () => {
    for (let i = 0; i < n - 1; i++) {
      const r = riseFor(drop[i]);
      const rise = (r + air[i]) ** 2 / (4 * (Math.max(drop[i], 1) + r));
      depart[i] =
        boardDocTop +
        at(platforms[i], launchT[i]).y -
        (TOP_SAFE + TOP_SLACK + charHeight + rise);
    }
  };

  solve();
  for (let i = 0; i < n - 1; i++) {
    const span = i + 1 < n - 1 ? depart[i + 1] - depart[i] : drop[i];
    air[i] = AIR_SHARE * Math.max(span, MIN_SPAN);
  }
  /* Air time and departure each depend on the other: longer in the air is a
     bigger climb against the frame, which means leaving lower down, which
     changes how far there is to fall before the fold. Three passes settle it
     to well under a pixel. */
  for (let pass = 0; pass < 3; pass++) {
    solve();
    for (let i = 0; i < n - 1; i++)
      air[i] = Math.max(air[i], startY(i) + drop[i] - (vh - BOTTOM_SAFE));
  }
  solve();

  const arrive: number[] = [0];
  for (let i = 0; i < n - 1; i++) arrive[i + 1] = depart[i] + air[i];

  /* The last surface is never departed, so nothing above stops him arriving on
     it with less page left than the landing takes. It is also the one surface
     that has to be reached, because it is the only thing still on screen when
     the page bottoms out. So the tail wins: work backwards from the end of the
     page, pulling departures earlier until the ending fits. Earlier is always
     safe overhead, which is the direction that matters. */
  const tail = LAND_SPAN + REST_TAIL;
  if (Number.isFinite(maxScroll)) {
    let cap = maxScroll - tail;
    for (let i = n - 1; i >= 1; i--) {
      arrive[i] = Math.min(arrive[i], cap);
      depart[i - 1] = Math.min(depart[i - 1], arrive[i] - MIN_AIR);
      // the landing beat is dead time, so it does not count as ground
      cap = depart[i - 1] - MIN_GROUND - LAND_SPAN;
    }
  }

  const marks: number[] = [];
  for (let i = 0; i < n; i++) marks.push(arrive[i], depart[i]);
  for (let i = 1; i < marks.length; i++)
    marks[i] = Math.max(marks[i], marks[i - 1] + MIN_SPAN / 4);

  /* One correction now that the scroll each card actually gets is known.
     Coming down at the near end only works if there is room to walk back for a
     running start; where the page has run out and there is not, he would land
     a few pixels from the edge he has to leave from and shuffle to it. Landing
     at the far end instead turns that dead beat into the run up itself. The
     drop changes by a few pixels, which is far inside the margins the anchors
     were solved with, so they are not worth solving again. */
  for (let i = 1; i < n - 1; i++) {
    const room = marks[i * 2 + 1] - marks[i * 2] - LAND_SPAN;
    const sameSide = Math.sign(launchT[i] - 0.5) === Math.sign(landT[i] - 0.5);
    if (!sameSide || room >= RUNUP_MIN) continue;
    const far = launchT[i] > 0.5 ? NEAR_EDGE : 1 - NEAR_EDGE;
    const right = at(platforms[i], 0.5).x >= at(platforms[i - 1], 0.5).x;
    landT[i] = cleared(platforms[i - 1], platforms[i], right, far);
  }

  const segs: Seg[] = [];
  let d = 0;

  const pushGround = (
    p: Platform,
    t0: number,
    t1: number,
    s0: number,
    s1: number,
    clip: Gait,
  ) => {
    if (s1 <= s0) return;
    const len = Math.abs(t1 - t0) * edgeLength(p);
    segs.push({ kind: "ground", s0, s1, p, t0, t1, clip, d0: d, len });
    d += len;
  };

  for (let i = 0; i < n; i++) {
    const p = platforms[i];
    const next = platforms[i + 1];
    const sArrive = marks[i * 2];
    const sDepart = marks[i * 2 + 1];
    const leaveT = launchT[i];
    const landedT = landT[i];

    let cursor = sArrive;

    if (i > 0) {
      // The hard landing gets its own beat, standing still on the spot.
      const s1 = next
        ? Math.min(cursor + LAND_SPAN, sDepart)
        : cursor + LAND_SPAN;
      segs.push({
        kind: "stand",
        s0: cursor,
        s1,
        p,
        t: landedT,
        dir: landedT < 0.5 ? 1 : -1,
        clip: "land",
        d0: d,
      });
      cursor = s1;
    }

    if (!next) {
      /* End of the road, and the end of him. He has just crossed the whole
         board, so where he comes down is where he stops: no walking in off the
         corner, because a man who still has two paces in him is not out of
         breath. From here the caller has the clock, the reader having stopped
         supplying one. He gets his breath back, and if they stay, he paces. */
      segs.push({
        kind: "stand",
        s0: cursor,
        s1: cursor + 6000,
        p,
        t: landedT,
        dir: landedT < 0.5 ? 1 : -1,
        clip: "stand",
        d0: d,
        rest: {
          p,
          at: landedT,
          /* The pacing window has to contain wherever he came down, and it can
             always be widened to: he is standing there already, so it is
             ground he has been proved able to stand on. */
          from: Math.min(PACE_FROM, landedT),
          to: Math.max(PACE_TO, landedT),
        },
      });
      break;
    }

    // He needs room to build up speed. If he came down on the same end he has
    // to leave from, he walks to the back of the card first and turns around,
    // but only when there is enough page left to see him do it.
    if (
      Math.sign(leaveT - 0.5) === Math.sign(landedT - 0.5) &&
      sDepart - cursor >= RUNUP_MIN
    ) {
      const backT = leaveT > 0.5 ? 1 - FAR_EDGE : FAR_EDGE;
      const sMid = lerp(cursor, sDepart, BACKUP_SHARE);
      pushGround(p, landedT, backT, cursor, sMid, "walk");
      pushGround(p, backT, leaveT, sMid, sDepart, "run");
    } else {
      pushGround(p, landedT, leaveT, cursor, sDepart, "run");
    }

    const from = at(p, leaveT);
    const to = at(next, landT[i + 1]);
    segs.push({
      kind: "air",
      s0: sDepart,
      s1: marks[(i + 1) * 2],
      from,
      to,
      rise: riseFor(to.y - from.y),
      d0: d,
      len: Math.hypot(to.x - from.x, to.y - from.y),
    });
    d += Math.hypot(to.x - from.x, to.y - from.y);
  }

  return { segs, s0: segs[0]?.s0 ?? 0, s1: segs[segs.length - 1]?.s1 ?? 0 };
}

/**
 * Where he stands if he is never going to move: on the first card, at the
 * corner he would have started from.
 */
export function restingPose(platforms: Platform[]): Pose | null {
  if (!platforms.length) return null;
  const p = platforms[0];
  const spot = at(p, NEAR_EDGE);
  return {
    x: spot.x,
    y: spot.y,
    clip: "stand",
    phase: 0,
    dir: 1,
    tilt: tiltAt(p, NEAR_EDGE),
    dist: 0,
    gaitDriven: false,
    ambient: true,
  };
}

/** Where he is, and what he is doing, at scroll position `s`. */
export function sampleRoute(route: Route, s: number): Pose | null {
  const { segs } = route;
  if (!segs.length) return null;

  let seg = segs[0];
  for (const c of segs) {
    if (s >= c.s0) seg = c;
    else break;
  }
  const u = Math.min(1, Math.max(0, (s - seg.s0) / (seg.s1 - seg.s0 || 1)));

  if (seg.kind === "stand") {
    const spot = at(seg.p, seg.t);
    return {
      x: spot.x,
      y: spot.y,
      clip: seg.clip,
      phase: seg.clip === "land" ? u : 0,
      dir: seg.dir,
      tilt: tiltAt(seg.p, seg.t),
      dist: seg.d0,
      gaitDriven: false,
      // He should keep breathing once the reader stops scrolling. Everything
      // else on the route is a function of the page; this one thing is not.
      ambient: seg.clip === "stand",
      rest: seg.rest,
    };
  }

  if (seg.kind === "ground") {
    const t = lerp(seg.t0, seg.t1, u);
    const p = at(seg.p, t);
    return {
      x: p.x,
      y: p.y,
      clip: seg.clip,
      phase: 0,
      dir: seg.t1 >= seg.t0 ? 1 : -1,
      tilt: tiltAt(seg.p, t),
      dist: seg.d0 + seg.len * u,
      gaitDriven: true,
    };
  }

  // In the air. x is linear, y is a throw: up off the edge, then down, landing
  // exactly on the next card's paper however far below it happens to be.
  const x = lerp(seg.from.x, seg.to.x, u);
  const drop = seg.to.y - seg.from.y;
  const y = seg.from.y + (drop + seg.rise) * u * u - seg.rise * u;
  const dir = seg.to.x >= seg.from.x ? 1 : -1;

  // He drives off the edge, windmills the whole way down, and tucks to absorb
  // the last of it just before the paper.
  let clip: string;
  let phase: number;
  if (u < 0.2) {
    clip = "jump";
    phase = u / 0.2;
  } else if (u < 0.9) {
    clip = "fall";
    phase = ((u - 0.2) / 0.7) * 2.5;
  } else {
    clip = "land";
    phase = (u - 0.9) / 0.1;
  }

  return {
    x,
    y,
    clip,
    phase,
    dir,
    // A little tip into the direction of travel reads as weight.
    tilt: dir * lerp(-6, 10, u),
    dist: seg.d0 + seg.len * u,
    gaitDriven: false,
  };
}

/* The arrival, in milliseconds. He has just crossed the whole board in a few
   seconds of scrolling and the reader has stopped supplying a clock, so this
   is the one beat that is his own. A flat wait here read as a freeze; what
   fixes it is having something to do. He gets his breath first.

   The landing runs straight into the buckle with nothing between them. There
   was an upright beat here once, on the theory that it sells "arrives, then
   the legs give out", but the landing already ends in a crouch, so it played
   as a bounce: down, up, down. Worse, a held beat of any length shows the
   first frame of the idle, which is a relaxed arm out gesture, and one calm
   pose between two winded ones undoes both. `drop` opens nearly upright of its
   own accord, so the recoil survives as an accent inside one continuous
   motion rather than as a pause. */
const DROP = 215;    // knees going
const PUFF = 2100;   // hands on knees, roughly three breaths
const STAND_UP = 340; // straightening up
const RAMP = 600;    // and easing into the walk rather than snapping into it

const SPEED = 52;    // board px per second, once he is up to it

/**
 * How far he has walked `t` seconds after setting off, easing from a standstill.
 *
 * Speed follows a smoothstep over RAMP, so this is its integral: the first
 * steps are short because the distance is short, and the gait is driven by
 * distance, so his legs slow down to match without being told to.
 */
function eased(t: number): number {
  const T = RAMP / 1000;
  if (t >= T) return SPEED * T * 0.5 + SPEED * (t - T);
  const u = t / T;
  return SPEED * T * (u * u * u - (u * u * u * u) / 2);
}

/**
 * The last beat, which the reader is no longer driving.
 *
 * He arrives, doubles over to get his breath back, straightens up, and then
 * walks the tear back and forth for as long as anybody is still there.
 * `elapsed` is milliseconds spent on the last surface, so the whole thing is
 * still a function of one number, just a different one from the scroll.
 */
export function pacePose(rest: Rest, elapsed: number, baseDist: number): Pose {
  const total = edgeLength(rest.p);
  const span = (rest.to - rest.from) * total;
  const START = DROP + PUFF + STAND_UP;

  if (elapsed < START || span <= 0) {
    const spot = at(rest.p, rest.at);
    /* Each of these is a clip with its own frame rate, so the boundaries are
       the durations above and not the art. A clip that finishes early holds
       its last drawing, which is what `drop` and `rise` are shaped to do. */
    const clip =
      elapsed < DROP ? "drop"
      : elapsed < DROP + PUFF ? "puff"
      : "rise";
    return {
      x: spot.x,
      y: spot.y,
      clip,
      phase: 0,
      dir: rest.at < 0.5 ? 1 : -1,
      tilt: tiltAt(rest.p, rest.at),
      dist: baseDist,
      gaitDriven: false,
      ambient: true,
      rest,
    };
  }

  // A triangle wave along the span, entered at wherever he stopped so he sets
  // off from there rather than teleporting to one end.
  const walked = eased((elapsed - START) / 1000);
  const offset = (rest.at - rest.from) * total + walked;
  const phase = ((offset % (2 * span)) + 2 * span) % (2 * span);
  const along = phase < span ? phase : 2 * span - phase;
  const t = rest.from + along / total;
  const spot = at(rest.p, t);

  return {
    x: spot.x,
    y: spot.y,
    clip: "walk",
    phase: 0,
    dir: phase < span ? 1 : -1,
    tilt: tiltAt(rest.p, t),
    dist: baseDist + walked,
    gaitDriven: true,
  };
}
