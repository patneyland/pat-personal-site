/**
 * Geometry for Gary's hand-drawn thought bubbles.
 *
 * The outline is a scalloped walk around a convex spine, which is how comic
 * letterers actually construct a thought balloon: a cloudy scalloped shape
 * whose tail is three or four shrinking circles pointing at the thinker
 * (Comicraft's glossary definition, near enough verbatim). The spine is a
 * rounded rectangle with a different radius at every corner, sampled at
 * irregular intervals; each pair of neighbouring samples is joined by a
 * cubic arc that bulges outward by its own depth and leans by its own
 * amount, so neighbouring lobes never match and the joins stay cuspy the
 * way a pen leaves them.
 *
 * Two properties fall out of the construction and are the point of it:
 *
 * - No waist, ever. The spine is convex and every lobe bulges outward from
 *   it, so the silhouette is a convex-ish cloud regardless of aspect ratio.
 *   There are no "corner lobes" and "edge lobes" as separate size classes,
 *   which is what used to turn a wide bubble into a dog bone.
 * - No countable rhythm. Chord lengths vary ~2.3x, depths vary further, and
 *   the walk starts at a random offset, so no two lobes repeat and the four
 *   corners are four different bends.
 *
 * Everything here is pure: same inputs, same drawing. The caller owns
 * picking the variant and seed and keeping them stable for the life of one
 * bubble.
 */

export type TailPuff = {
  /** Sideways drift from tailX, px. Hand-drawn trails are never plumb. */
  dx: number;
  /** Centre distance from where the trail starts, px, growing away. */
  dy: number;
  rx: number;
  ry: number;
  /** Degrees. A squashed circle reads drawn only if it is also tilted. */
  rot: number;
};

export type BubbleShape = {
  /** One closed SVG path: the entire outline, filled and stroked once. */
  path: string;
  strokeWidth: number;
  tail: TailPuff[];
  /** Distance from the bubble box to where the trail may begin, clear of
      whatever lobes bulge past the edge near tailX. */
  tailStart: number;
  /** Content inset from the measured box, px. */
  padX: number;
  padY: number;
};

export const VARIANT_COUNT = 4;

/**
 * The four drawings. Each is a recipe, not a seed nudge: lobe count, depth
 * profile, corner character, lean and tail all differ, so each reads as a
 * bubble drawn on a different day.
 */
type Recipe = {
  /** Roughly how many lobes fit round the whole perimeter. */
  lobes: number;
  /** Chord-length multiplier range: how uneven the walk is. */
  chordVar: [number, number];
  /** Lobe depth as a fraction of its chord. */
  depth: [number, number];
  /** Depth multipliers for lobes on the top and bottom runs. */
  topBias: number;
  bottomBias: number;
  /** Corner radius multipliers, TL TR BR BL. Four different bends. */
  corners: [number, number, number, number];
  /** One deliberately oversized lobe up top. */
  hero: boolean;
  /** Apex skew: positive leans lobes forward along the walk. */
  lean: number;
  stroke: number;
  puffs: number;
  /** Radial jitter scale on the valley points. */
  wobble: number;
  /** Step multiplier along the bottom run: >1 gives fewer, wider bottom
      lobes, the calm underside of a cumulus. */
  bottomChord: number;
};

const RECIPES: Recipe[] = [
  /* 0 "cumulus": puffy on top, calm underneath, the classic cloud. */
  {
    lobes: 13, chordVar: [0.7, 1.5], depth: [0.28, 0.46],
    topBias: 1.35, bottomBias: 0.5, corners: [1.25, 0.8, 0.95, 1.1],
    hero: false, lean: 0.3, stroke: 2.1, puffs: 3, wobble: 1, bottomChord: 1.7,
  },
  /* 1 "popcorn": many small tight lobes, busier line. */
  {
    lobes: 18, chordVar: [0.6, 1.6], depth: [0.32, 0.5],
    topBias: 1, bottomBias: 0.85, corners: [0.85, 1.2, 0.8, 1.1],
    hero: false, lean: -0.25, stroke: 1.85, puffs: 4, wobble: 1.2, bottomChord: 1,
  },
  /* 2 "hero": modest even lobes with one much bigger puff up top. */
  {
    lobes: 15, chordVar: [0.7, 1.3], depth: [0.17, 0.26],
    topBias: 1, bottomBias: 0.85, corners: [0.9, 1.35, 1.0, 0.7],
    hero: true, lean: 0.45, stroke: 2.2, puffs: 3, wobble: 0.9, bottomChord: 1,
  },
  /* 3 "billow": few fat lazy lobes, heavier line. */
  {
    lobes: 7, chordVar: [0.8, 1.4], depth: [0.4, 0.58],
    topBias: 1.05, bottomBias: 0.85, corners: [1.15, 1.0, 1.3, 0.75],
    hero: false, lean: -0.35, stroke: 2.4, puffs: 2, wobble: 0.8, bottomChord: 1.15,
  },
];

/** mulberry32: small, fast, good enough for wobble. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number };

/**
 * The spine: a rounded rectangle on the measured box, walked clockwise from
 * the start of the top edge, addressable by arc length.
 */
function makeSpine(w: number, h: number, rc: [number, number, number, number]) {
  const [tl, tr, br, bl] = rc;

  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => ({
    len: r * (a1 - a0),
    at: (t: number): Pt => ({
      x: cx + r * Math.cos(a0 + t * (a1 - a0)),
      y: cy + r * Math.sin(a0 + t * (a1 - a0)),
    }),
  });
  const line = (x0: number, y0: number, x1: number, y1: number) => ({
    len: Math.hypot(x1 - x0, y1 - y0),
    at: (t: number): Pt => ({ x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) }),
  });

  const HALF = Math.PI / 2;
  const pieces = [
    line(tl, 0, w - tr, 0),
    arc(w - tr, tr, tr, -HALF, 0),
    line(w, tr, w, h - br),
    arc(w - br, h - br, br, 0, HALF),
    line(w - br, h, bl, h),
    arc(bl, h - bl, bl, HALF, Math.PI),
    line(0, h - bl, 0, tl),
    arc(tl, tl, tl, Math.PI, Math.PI * 1.5),
  ];

  const total = pieces.reduce((a, p) => a + p.len, 0);

  const pointAt = (s: number): Pt => {
    s = ((s % total) + total) % total;
    for (const p of pieces) {
      if (s <= p.len) return p.at(p.len ? s / p.len : 0);
      s -= p.len;
    }
    return pieces[0].at(0);
  };

  /** Outward normal by finite difference. Clockwise walk, y down. */
  const normalAt = (s: number): Pt => {
    const a = pointAt(s - 0.5);
    const b = pointAt(s + 0.5);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: dy / L, y: -dx / L };
  };

  return { total, pointAt, normalAt };
}

export function buildBubbleShape(
  w: number,
  h: number,
  variant: number,
  seed: number,
  /** Where the trail leaves, measured ALONG the exit edge (x for up/down,
      y for left/right), for clearing the lobes it must not overlap. */
  tailX: number,
  tailSide: "up" | "down" | "left" | "right",
): BubbleShape {
  const rec = RECIPES[((variant % VARIANT_COUNT) + VARIANT_COUNT) % VARIANT_COUNT];
  const rnd = mulberry32((seed * 374761393 + variant * 668265263) | 0);
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);

  const minDim = Math.min(w, h);

  /* Four different corner radii, clamped so opposite pairs still fit. */
  const rcBase = Math.min(minDim * 0.3, 44);
  let rc = rec.corners.map((m) => Math.max(6, rcBase * m)) as [
    number, number, number, number,
  ];
  const fit = Math.min(
    1,
    (w - 4) / (rc[0] + rc[1]),
    (w - 4) / (rc[3] + rc[2]),
    (h - 4) / (rc[0] + rc[3]),
    (h - 4) / (rc[1] + rc[2]),
  );
  if (fit < 1) rc = rc.map((r) => r * fit) as typeof rc;

  const spine = makeSpine(w, h, rc);
  const per = spine.total;

  /* Walk the perimeter at uneven steps. Normalised afterwards so the last
     lobe is never a sliver. */
  /* A lobe is a short pen stroke. Uncapped, a low lobe count on a big box
     asks for chords that span whole sides and two corners at once; the
     corner-clearance clamp below then blows the depth up to cover the cut,
     the giant lobes cross their neighbours, and the crossings render as
     winding holes. Seen live before the cap existed. */
  const base = Math.max(
    18,
    Math.min(per / rec.lobes, minDim * 0.62, 130),
  );
  const s0 = rnd() * per;
  const raw: number[] = [];
  let sum = 0;
  while (sum < per) {
    /* Wider steps along the bottom, where the recipe asks for calm. The
       position check is approximate (steps are rescaled below) and that is
       fine: it only needs to know roughly which run it is on. */
    const onBottom = spine.normalAt(s0 + sum).y > 0.5;
    const st =
      base *
      between(rec.chordVar[0], rec.chordVar[1]) *
      (onBottom ? rec.bottomChord : 1);
    raw.push(st);
    sum += st;
  }
  const norm = per / sum;

  /* Valley points, each pushed off the spine by its own small amount.
     Outward more than inward, so the writing keeps its clearance. */
  const jig = rec.wobble * Math.min(1, minDim / 140);
  let acc = 0;
  const pts: { p: Pt; s: number }[] = [];
  for (const st of raw) {
    const s = (s0 + acc) % per;
    const p = spine.pointAt(s);
    const n = spine.normalAt(s);
    const off = between(-2.5, 6) * jig;
    pts.push({ p: { x: p.x + n.x * off, y: p.y + n.y * off }, s });
    acc += st * norm;
  }
  const count = pts.length;

  /* The hero lobe, if this recipe has one: the longest chord in the upper
     half of the drawing gets nearly double depth. */
  let heroIdx = -1;
  if (rec.hero) {
    let best = 0;
    for (let i = 0; i < count; i++) {
      const a = pts[i].p;
      const b = pts[(i + 1) % count].p;
      const c = Math.hypot(b.x - a.x, b.y - a.y);
      if ((a.y + b.y) / 2 < h * 0.45 && c > best) {
        best = c;
        heroIdx = i;
      }
    }
  }

  const f = (v: number) => Math.round(v * 10) / 10;
  let path = `M ${f(pts[0].p.x)} ${f(pts[0].p.y)}`;
  let tailClear = 2;

  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const dx = b.p.x - a.p.x;
    const dy = b.p.y - a.p.y;
    const c = Math.hypot(dx, dy) || 1;
    const T = { x: dx / c, y: dy / c };
    const N = { x: T.y, y: -T.x }; // outward, clockwise walk, y down

    let df = between(rec.depth[0], rec.depth[1]);
    if (N.y < -0.45) df *= rec.topBias;
    else if (N.y > 0.45) df *= rec.bottomBias;
    let d = Math.min(c * df, 34);
    if (i === heroIdx) d = Math.min(Math.max(d * 2.6, c * 0.62), 52);

    /* A chord across a corner cuts inside the spine. Make sure the lobe at
       least clears the spine it is standing on, or the outline would dent
       into the writing at the corners. */
    let dev = 0;
    const ds = ((b.s - a.s) % per + per) % per;
    for (let k = 1; k <= 6; k++) {
      const q = spine.pointAt(a.s + (ds * k) / 7);
      const beyond = (q.x - a.p.x) * N.x + (q.y - a.p.y) * N.y;
      if (beyond > dev) dev = beyond;
    }
    d = Math.max(d, Math.min(dev + 3, minDim * 0.3), 4);

    /* Lean: the apex slides along the chord, so lobes are lopsided the way
       a single relaxed pass of the pen leaves them. The offsets are kept
       small on purpose: push a takeoff much past a fifth of the chord and
       it sets off low and flat, crosses the neighbouring lobe's tail, and
       the crossed pocket renders as a hole in the fill (winding zero).
       Seen live as slivers of the page showing through at the cusps. */
    const lean = rec.lean * between(0.3, 1);
    const u1 = c * (0.05 + Math.max(0, lean) * 0.12 + rnd() * 0.06);
    const u2 = c * (0.05 + Math.max(0, -lean) * 0.12 + rnd() * 0.06);
    const k1 = Math.min(d * between(1.25, 1.65), 46);
    const k2 = Math.min(d * between(1.25, 1.65), 46);

    const c1 = { x: a.p.x + T.x * u1 + N.x * k1, y: a.p.y + T.y * u1 + N.y * k1 };
    const c2 = { x: b.p.x - T.x * u2 + N.x * k2, y: b.p.y - T.y * u2 + N.y * k2 };
    path += ` C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(b.p.x)} ${f(b.p.y)}`;

    /* How far past the box does this lobe reach where the trail will hang?
       Sampled off the actual curve, because an estimate from the depth alone
       once left the first two puffs buried inside a deep bottom lobe. The
       trail can leave any of the four edges; the along-edge coordinate is x
       for a top/bottom exit and y for a side exit. */
    const sideways = tailSide === "left" || tailSide === "right";
    for (let q = 1; q < 8; q++) {
      const t = q / 8;
      const mt = 1 - t;
      const x =
        mt * mt * mt * a.p.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.p.x;
      const y =
        mt * mt * mt * a.p.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.p.y;
      if (Math.abs((sideways ? y : x) - tailX) > 30) continue;
      const beyond =
        tailSide === "down" ? y - h
        : tailSide === "up" ? -y
        : tailSide === "right" ? x - w
        : -x;
      if (beyond > tailClear) tailClear = beyond;
    }
  }
  path += " Z";

  /* The trail: shrinking puffs, squashed and tilted a little, drifting
     sideways as they go, because a drawn trail is never a plumb line. */
  const u = Math.max(11, Math.min(minDim * 0.2, 26));
  const drift = (rnd() < 0.5 ? -1 : 1) * between(0.08, 0.2) * u;
  const tail: TailPuff[] = [];
  let dy = 0;
  let prevR = 0;
  let dx = between(-0.1, 0.1) * u;
  for (let i = 0; i < rec.puffs; i++) {
    const r = Math.max(2.2, u * (0.42 - i * 0.1) * between(0.85, 1.15));
    dy += (i === 0 ? r + 2 : prevR + between(4, 8) + r);
    dx += drift * (i === 0 ? 0.4 : 1);
    const e = between(0, 0.22);
    tail.push({
      dx: f(dx),
      dy: f(dy),
      rx: f(r * (1 + e)),
      ry: f(r * (1 - e)),
      rot: f(between(-24, 24)),
    });
    prevR = r;
  }

  return {
    path,
    strokeWidth: rec.stroke,
    tail,
    tailStart: f(tailClear + 3),
    padX: 18,
    padY: 15,
  };
}

/**
 * How far past the box edge THIS drawing's trail actually paints, in px:
 * the start clearance plus the far edge of the furthest puff plus half its
 * stroke (ThoughtBubble draws puffs at max(1.6, strokeWidth - 0.2)).
 * max(rx, ry) bounds a rotated ellipse's extent along the trail axis, so
 * this can overstate by a pixel at most and never understates.
 *
 * This is what lets a caller place the bubble by the trail it will really
 * draw instead of by a worst-case constant: a short-trailed recipe sits
 * close to Gary, a long-trailed one sits further out, and neither touches
 * him. buildBubbleShape is pure, so the caller can compute the shape ahead
 * of the bubble mounting, measure it here, and hand the same variant and
 * seed down so the drawing matches the measurement.
 */
export function tailReach(shape: BubbleShape): number {
  let far = 0;
  for (const p of shape.tail) far = Math.max(far, p.dy + Math.max(p.rx, p.ry));
  return shape.tailStart + far + Math.max(1.6, shape.strokeWidth - 0.2) / 2;
}
