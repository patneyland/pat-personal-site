"use client";

import Image from "next/image";
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import BlurFade from "@/components/ui/BlurFade";

const PAPER = "#f4efe4";
const INK = "#3a342a";
const INK_SOFT = "#5b5342";

/* ─── Small building blocks ─────────────────────────────── */

const Polaroid = forwardRef<
  HTMLDivElement,
  {
    src?: string;
    alt?: string;
    icon?: string;
    label?: string;
    hand: string;
    rotate?: number;
    width?: number;
    tape?: boolean;
    square?: boolean;
    onImgLoad?: () => void;
  }
>(function Polaroid(
  {
    src,
    alt,
    icon,
    label,
    hand,
    rotate = 0,
    width = 300,
    tape = false,
    square = false,
    onImgLoad,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative shrink-0"
      style={{
        width,
        backgroundColor: PAPER,
        padding: "0.7rem 0.7rem 0",
        borderRadius: 3,
        boxShadow: "0 14px 30px rgba(0,0,0,0.5)",
        transform: `rotate(${rotate}deg)`,
        position: "relative",
        zIndex: 2,
      }}
    >
      {tape && (
        <span
          className="absolute"
          style={{
            top: -14,
            left: "50%",
            transform: "translateX(-50%) rotate(-4deg)",
            width: 90,
            height: 26,
            backgroundColor: "rgba(201,168,76,0.35)",
            border: "1px solid rgba(201,168,76,0.25)",
          }}
        />
      )}
      <div
        className="overflow-hidden"
        style={{ backgroundColor: "#cfc7b5", borderRadius: 2 }}
      >
        {src ? (
          <Image
            src={src}
            alt={alt ?? hand}
            width={600}
            height={square ? 600 : 750}
            className="block h-auto w-full"
            onLoad={onImgLoad}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
              aspectRatio: square ? "1 / 1" : "3 / 4",
              color: "#8a8375",
              backgroundImage:
                "repeating-linear-gradient(45deg,#0000 0 12px,#00000008 12px 13px)",
            }}
          >
            <span style={{ fontSize: "2rem" }}>{icon}</span>
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
          </div>
        )}
      </div>
      <div
        className="text-center"
        style={{
          fontFamily: "var(--font-hand)",
          fontSize: "1.55rem",
          lineHeight: 1.1,
          padding: "0.6rem 0.3rem 0.8rem",
          color: INK,
        }}
      >
        {hand}
      </div>
    </div>
  );
});

/* Mini polaroids for the "real stuff" note. */
const REAL_STUFF = [
  {
    src: "/assets/story/wedding.jpg",
    alt: "Our wedding day",
    rotate: -2.6,
  },
  {
    src: "/assets/slideshow/photo-two.png",
    alt: "My family",
    rotate: 1.8,
  },
  {
    src: "/assets/story/rim-to-rim.jpg",
    alt: "Rim to rim across the Grand Canyon",
    rotate: -1.4,
  },
];

function MiniPolaroid({
  src,
  alt,
  rotate,
}: {
  src: string;
  alt: string;
  rotate: number;
}) {
  return (
    <div
      className="shrink-0"
      style={{
        width: 160,
        backgroundColor: "#fffdf6",
        padding: "0.45rem",
        borderRadius: 2,
        boxShadow: "0 8px 18px rgba(0,0,0,0.28)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "1 / 1", backgroundColor: "#cfc7b5" }}
      >
        <Image src={src} alt={alt} fill sizes="200px" className="object-cover" />
      </div>
    </div>
  );
}

function Note({
  children,
  align = "left",
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="self-center"
      style={{ maxWidth: 360, textAlign: align, ...style }}
    >
      <p className="text-body" style={{ fontSize: "1.02rem" }}>
        {children}
      </p>
    </div>
  );
}

/* ─── Connector overlay ─────────────────────────────────── */

type Side = "top" | "bottom" | "left" | "right";
type Edge = {
  from: string;
  to: string;
  fromSide?: Side;
  toSide?: Side;
  /** 0–1 position along the fixed side (left → right / top → bottom) */
  fromAt?: number;
  toAt?: number;
};

const EDGES: Edge[] = [
  { from: "graduation", to: "masters" },
  { from: "masters", to: "fiscalsim" },
  { from: "masters", to: "asc" },
  { from: "fiscalsim", to: "asu" },
  { from: "asc", to: "asu" },
  // the pair out of ASU: one drops from the bottom edge into the Neyland
  // photo, the other leaves the right edge low and arcs over the Neyland
  // card into the presenting photo
  { from: "asu", to: "neyland", fromSide: "bottom", fromAt: 0.3, toSide: "top" },
  {
    from: "asu",
    to: "presenting",
    fromSide: "right",
    fromAt: 0.9,
    toSide: "top",
    // left of the tape graphic at the card's top center
    toAt: 0.25,
  },
];

// narrow layouts stack the polaroids in one column; branching edges would cut
// across the cards between them, so connect neighbors top to bottom instead
const STACKED_EDGES: Edge[] = [
  { from: "graduation", to: "masters" },
  { from: "masters", to: "fiscalsim" },
  { from: "fiscalsim", to: "asc" },
  { from: "asc", to: "asu" },
  { from: "asu", to: "neyland" },
  { from: "neyland", to: "presenting" },
];

type PathData = { d: string; head: string };

/** Gap between the polaroid frame and where a connector starts / ends. */
const START_GAP = 18;
const END_GAP = 12;

type Anchor = { x: number; y: number; nx: number; ny: number };

/**
 * Point on the boundary of rect `r` where the ray from its center toward
 * (tx, ty) exits, in board coordinates. Also returns the outward normal of
 * the edge that was hit, so connectors leave a frame perpendicular to
 * whichever side faces their destination (bottom, left, right, or top).
 */
function edgeAnchor(
  r: DOMRect,
  board: DOMRect,
  tx: number,
  ty: number,
  side?: Side,
  at?: number,
): Anchor {
  const cx = r.left + r.width / 2 - board.left;
  const cy = r.top + r.height / 2 - board.top;
  const dx = tx - cx;
  const dy = ty - cy;

  if (side) {
    // fixed edge; position along it is either explicit or biased toward
    // the target
    const alongX =
      at != null
        ? r.left - board.left + r.width * at
        : Math.min(
            Math.max(cx + dx * 0.35, r.left - board.left + 24),
            r.right - board.left - 24,
          );
    const alongY =
      at != null
        ? r.top - board.top + r.height * at
        : Math.min(
            Math.max(cy + dy * 0.35, r.top - board.top + 24),
            r.bottom - board.top - 24,
          );
    if (side === "left") return { x: r.left - board.left, y: alongY, nx: -1, ny: 0 };
    if (side === "right") return { x: r.right - board.left, y: alongY, nx: 1, ny: 0 };
    if (side === "top") return { x: alongX, y: r.top - board.top, nx: 0, ny: -1 };
    return { x: alongX, y: r.bottom - board.top, nx: 0, ny: 1 };
  }

  const tX = dx !== 0 ? r.width / 2 / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? r.height / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  const x = cx + dx * t;
  const y = cy + dy * t;
  if (tX < tY) return { x, y, nx: Math.sign(dx), ny: 0 };
  return { x, y, nx: 0, ny: Math.sign(dy) };
}

/**
 * Absolutely-positioned SVG that draws dashed gold bezier connectors between
 * polaroids. Each connector exits the source frame on the edge facing its
 * destination (with a small air gap off the frame), curves toward the
 * destination, and ends in an arrowhead rotated to match the path's final
 * direction. Anchors are measured from live DOM rects, so lines stay correct
 * on resize / reflow.
 */
function Connectors({
  boardRef,
  frames,
  version,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>;
  frames: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  version: number;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [paths, setPaths] = useState<PathData[]>([]);

  const measure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    setSize({ w: b.width, h: b.height });

    const edges = b.width < 640 ? STACKED_EDGES : EDGES;
    const next: PathData[] = [];
    for (const { from, to, fromSide, toSide, fromAt, toAt } of edges) {
      const a = frames.current[from];
      const c = frames.current[to];
      if (!a || !c) continue;
      const ra = a.getBoundingClientRect();
      const rc = c.getBoundingClientRect();

      const acx = ra.left + ra.width / 2 - b.left;
      const acy = ra.top + ra.height / 2 - b.top;
      const ccx = rc.left + rc.width / 2 - b.left;
      const ccy = rc.top + rc.height / 2 - b.top;

      if (ccy <= acy) continue; // destination sits above source; skip (odd reflow)

      // exit / entry points on whichever frame edges face each other
      const out = edgeAnchor(ra, b, ccx, ccy, fromSide, fromAt);
      const inn = edgeAnchor(rc, b, acx, acy, toSide, toAt);

      // shrink the air gaps when the two frames sit close together
      const rawDist = Math.hypot(inn.x - out.x, inn.y - out.y);
      const startGap = Math.min(START_GAP, rawDist * 0.28);
      const endGap = Math.min(END_GAP, rawDist * 0.2);

      const sx = out.x + out.nx * startGap;
      const sy = out.y + out.ny * startGap;
      const ex = inn.x + inn.nx * endGap;
      const ey = inn.y + inn.ny * endGap;

      // control points push out along each edge normal for an organic curve
      const dist = Math.hypot(ex - sx, ey - sy);
      const k = Math.min(dist * 0.45, 140);
      const c1x = sx + out.nx * k;
      const c1y = sy + out.ny * k;
      const c2x = ex + inn.nx * k;
      const c2y = ey + inn.ny * k;
      const d = `M${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;

      // arrowhead aligned with the path's direction of travel at its end
      const ux = -inn.nx;
      const uy = -inn.ny;
      const bx = ex - ux * 11;
      const by = ey - uy * 11;
      const px = -uy;
      const py = ux;
      const head = `M${bx + px * 6.5} ${by + py * 6.5} L${ex} ${ey} L${bx - px * 6.5} ${by - py * 6.5}`;
      next.push({ d, head });
    }
    setPaths(next);
  }, [boardRef, frames]);

  useLayoutEffect(() => {
    measure();
    const board = boardRef.current;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && board) {
      ro = new ResizeObserver(() => measure());
      ro.observe(board);
    }
    window.addEventListener("resize", measure);
    // reflow after fonts / reveals settle
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 900);
    const t3 = setTimeout(measure, 1800);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // re-run when an image loads (version bumps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, version]);

  if (size.w === 0 || size.h === 0) return null;

  return (
    <svg
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      fill="none"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size.w,
        height: size.h,
        pointerEvents: "none",
        // board is isolated; keep connectors beneath every card and note
        zIndex: -1,
      }}
    >
      {paths.map((p, i) => (
        <g key={i}>
          <path
            d={p.d}
            stroke="var(--accent-dim)"
            strokeWidth="2"
            strokeDasharray="2 8"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d={p.d}
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeDasharray="9 9"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d={p.head}
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/* ─── Section ───────────────────────────────────────────── */

export default function Story() {
  const boardRef = useRef<HTMLDivElement>(null);
  const frames = useRef<Record<string, HTMLDivElement | null>>({});
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const setFrame = (key: string) => (el: HTMLDivElement | null) => {
    frames.current[key] = el;
  };

  return (
    <section
      id="story"
      style={{
        backgroundColor: "var(--bg)",
        backgroundImage:
          "radial-gradient(circle at 15% 10%, rgba(201,168,76,0.05), transparent 40%), radial-gradient(circle at 85% 60%, rgba(201,168,76,0.04), transparent 45%)",
        paddingTop: "5rem",
        paddingBottom: "6rem",
      }}
    >
      <div className="container" style={{ maxWidth: 940 }}>
        {/* Heading */}
        <BlurFade delay={0.05}>
          <p
            style={{
              fontFamily: "var(--font-hand)",
              fontSize: "2.4rem",
              color: "var(--accent)",
              transform: "rotate(-2deg)",
            }}
          >
            my story
          </p>
        </BlurFade>

        {/* Board */}
        <div ref={boardRef} className="isolate relative mt-16 flex flex-col gap-16">
          <Connectors boardRef={boardRef} frames={frames} version={version} />

          {/* 1 — graduation */}
          <BlurFade delay={0.1}>
            <div className="flex flex-wrap items-start gap-10">
              <Polaroid
                ref={setFrame("graduation")}
                onImgLoad={bump}
                src="/assets/story/graduation.jpg"
                alt="Patrick Neyland graduating from Utah Valley University"
                hand="accounting, UVU"
                rotate={-2.4}
              />
              <Note>
                I majored in accounting because I had a knack for it. A professor
                encouraged me to consider academia, and a PhD in accounting was
                decided.
              </Note>
            </div>
          </BlurFade>

          {/* 2 — master's */}
          <BlurFade delay={0.1}>
            <div className="flex flex-wrap items-start justify-end gap-10">
              <Note align="right">
                To prepare for the PhD, I did a master&apos;s in Financial
                Economics at Utah State University. In my first semester, ChatGPT
                came out, and I swapped all my theoretical econ and finance
                electives for AI classes: machine learning, deep learning, data
                analytics, textual analysis, and mining.
              </Note>
              <Polaroid
                ref={setFrame("masters")}
                onImgLoad={bump}
                src="/assets/slideshow/photo-three.png"
                alt="Master's at Utah State"
                hand="master's, then ChatGPT"
                rotate={-1.6}
                tape
              />
            </div>
          </BlurFade>

          {/* branch — the two roles during the master's; kept in the left
              column so the connectors from the master's photo have a clear
              corridor down to the two cards below */}
          <BlurFade delay={0.1}>
            <p className="text-body" style={{ maxWidth: "340px" }}>
              While I was getting my master&apos;s, I worked on a research team
              building FiscalSim, a Python-based policy microsimulation model, and
              as a team lead at the Analytics Solutions Center.
            </p>
          </BlurFade>

          <BlurFade delay={0.1}>
            <div className="flex flex-wrap items-start justify-center gap-14">
              <Polaroid
                ref={setFrame("fiscalsim")}
                onImgLoad={bump}
                src="/assets/story/fiscalsim.jpg"
                alt="FiscalSim, a Python-based policy microsimulation model"
                hand="FiscalSim, tax policy in Python"
                rotate={2.2}
                width={260}
              />
              <Polaroid
                ref={setFrame("asc")}
                onImgLoad={bump}
                src="/assets/story/analytics-solutions-center.jpg"
                alt="Analytics Solutions Center"
                hand="Analytics Solutions Center"
                rotate={1.4}
                width={260}
              />
            </div>
          </BlurFade>

          {/* 4 — extra top space so the merge arrows from FiscalSim and the
              ASC have room to curve in without crowding */}
          <BlurFade delay={0.1} className="sm:mt-24">
            <div className="flex flex-wrap items-start gap-10">
              <Polaroid
                ref={setFrame("asu")}
                onImgLoad={bump}
                src="/assets/story/asu.jpg"
                alt="Patrick Neyland, Graduate Research Associate at Arizona State University"
                hand="PhD, AI in Accounting"
                rotate={2.2}
              />
              <Note>
                At ASU my research interest was AI in accounting. I wanted to
                answer one question: how does the adoption of generative AI among
                tax enforcement agencies affect the accounting profession and
                corporate tax behavior? There were no results, so I went to the
                Arizona Department of Revenue and asked how they were using AI.
                They said, &quot;We&apos;re not.&quot;
              </Note>
            </div>
          </BlurFade>

          {/* 5 — the note shrinks to fit beside the photos so the row stays
              on one line, keeping the air above both photos clear for the
              pair of arrows from ASU */}
          <BlurFade delay={0.1} className="sm:mt-20">
            <div className="flex flex-wrap items-start justify-end gap-10">
              <Note align="right" style={{ flex: "1 1 240px" }}>
                I took a leave of absence to start AI consulting, to better
                understand it and help businesses implement it, so I&apos;d be a
                much better informed researcher. I started Neyland Solutions to
                formalize this consulting practice. Right now, I am helping
                businesses use AI to generate revenue and improve their
                operations.
              </Note>
              <div className="flex flex-wrap items-start justify-center gap-6">
                <Polaroid
                  ref={setFrame("neyland")}
                  onImgLoad={bump}
                  src="/assets/story/neyland-solutions-profile.jpg"
                  alt="Neyland Solutions"
                  hand="AI consulting"
                  rotate={2.5}
                  width={230}
                />
                <Polaroid
                  ref={setFrame("presenting")}
                  onImgLoad={bump}
                  src="/assets/story/neyland-solutions-presenting.jpg"
                  alt="Patrick Neyland presenting as founder of Neyland Solutions"
                  hand="teaching AI"
                  rotate={-2.4}
                  width={260}
                  tape
                />
              </div>
            </div>
          </BlurFade>
        </div>

        {/* torn side note */}
        <BlurFade delay={0.1}>
          <div
            className="mx-auto mt-20"
            style={{
              maxWidth: 640,
              backgroundColor: PAPER,
              color: INK,
              padding: "1.8rem 2rem",
              transform: "rotate(-1.2deg)",
              boxShadow: "0 18px 36px rgba(0,0,0,0.5)",
              clipPath:
                "polygon(0 4%,4% 0,20% 5%,38% 0,60% 6%,80% 0,96% 5%,100% 2%,100% 96%,96% 100%,78% 96%,55% 100%,32% 96%,12% 100%,3% 97%,0 100%)",
            }}
          >
            <h4
              style={{
                fontFamily: "var(--font-hand)",
                fontSize: "2rem",
                color: INK,
              }}
            >
              p.s. the real stuff
            </h4>
            <p style={{ color: INK_SOFT, fontSize: "1rem" }}>
              Along the way I got married and had four kids. I enjoy
              woodworking, birding, and cooking. I have won a chili cook-off,
              and I have hiked rim-to-rim in the Grand Canyon.
            </p>
            <div className="mt-6 flex flex-wrap items-start justify-center gap-4 pb-2">
              {REAL_STUFF.map((shot) => (
                <MiniPolaroid key={shot.src} {...shot} />
              ))}
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
