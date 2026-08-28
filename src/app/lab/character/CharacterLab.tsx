"use client";

import { useEffect, useRef, useState } from "react";
import { Character, type Manifest } from "@/lib/character/player";

const MANIFEST = "/assets/character/character.json";

/** One character standing on a ruled line, so the soles can be checked. */
function Stage({
  clip,
  scale,
  dark,
  frame,
  label,
}: {
  clip: string;
  scale: number;
  dark?: boolean;
  /** undefined plays the clip; a number holds that drawing. */
  frame?: number;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let char: Character | null = null;

    Character.load(MANIFEST)
      .then((c) => {
        if (!alive || !host.current) return;
        char = c;
        c.mount(host.current);
        c.play(clip);
        c.setScale(scale);

        const el = host.current;
        const groundY = el.clientHeight - 28;
        c.place(el.clientWidth / 2 - (c.displayHeight * 0.25), groundY);

        if (frame !== undefined) {
          c.showFrame(frame);
          return;
        }
        let last = performance.now();
        const loop = (t: number) => {
          if (!alive) return;
          c.tick(t - last);
          last = t;
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch((e) => alive && setErr(String(e.message ?? e)));

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      void char;
    };
  }, [clip, scale, frame]);

  return (
    <figure style={{ margin: 0 }}>
      <div
        ref={host}
        style={{
          position: "relative",
          height: 260,
          background: dark ? "#16171A" : "#ffffff",
          color: dark ? "#EDEDE8" : "#111111",
          border: "1px solid #cfcfc8",
          overflow: "hidden",
        }}
      >
        {/* The surface his soles must land on. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 28,
            height: 1,
            background: dark ? "#4a4d55" : "#c9302c",
          }}
        />
        {err && (
          <p style={{ padding: 12, font: "12px monospace", color: "#c9302c" }}>
            {err}
          </p>
        )}
      </div>
      <figcaption
        style={{
          font: "11px ui-monospace, monospace",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#7a7d84",
          padding: "6px 0",
        }}
      >
        {label}
      </figcaption>
    </figure>
  );
}

/** Both drawings on top of each other. Any registration error shows as a shift. */
function OnionCheck({ clip }: { clip: string }) {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([Character.load(MANIFEST), Character.load(MANIFEST)]).then(
      ([c1, c2]) => {
        if (!alive || !a.current || !b.current) return;
        for (const [c, el, i] of [
          [c1, a.current, 0],
          [c2, b.current, 1],
        ] as const) {
          c.mount(el);
          c.play(clip);
          c.setScale(0.55);
          c.place(20, 232);
          c.showFrame(i);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [clip]);

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          position: "relative",
          height: 260,
          background: "#fff",
          border: "1px solid #cfcfc8",
          overflow: "hidden",
        }}
      >
        <div
          ref={a}
          style={{ position: "absolute", inset: 0, color: "#111", opacity: 0.75 }}
        />
        <div
          ref={b}
          style={{
            position: "absolute",
            inset: 0,
            color: "#c9302c",
            opacity: 0.6,
            mixBlendMode: "multiply",
          }}
        />
      </div>
      <figcaption
        style={{
          font: "11px ui-monospace, monospace",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#7a7d84",
          padding: "6px 0",
        }}
      >
        onion · frame 0 black, frame 1 red · only the arm may differ
      </figcaption>
    </figure>
  );
}

export default function CharacterLab() {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    fetch(MANIFEST)
      .then((r) => r.json())
      .then(setM)
      .catch(() => {});
  }, []);

  const clips = m ? Object.keys(m.clips) : [];
  const clip = clips[0];

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "48px 20px 90px",
        font: "15px/1.6 ui-sans-serif, system-ui, sans-serif",
        color: "#1b1c20",
        background: "#fff",
        minHeight: "100vh",
      }}
    >
      <p
        style={{
          font: "11px ui-monospace, monospace",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: "#c9302c",
          margin: "0 0 8px",
        }}
      >
        Dev only · not built in production
      </p>
      <h1 style={{ fontSize: 30, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
        Character lab
      </h1>
      <p style={{ margin: "0 0 30px", color: "#4b4e57", maxWidth: "62ch" }}>
        Block 1 of the working session. Four things have to be true before any
        real drawing is worth doing: the frames do not jitter, the trim offsets
        put the art back where it was drawn, the mask takes its color from the
        page, and the soles land on the line rather than near it.
      </p>

      {!clip && (
        <p style={{ font: "13px ui-monospace, monospace", color: "#c9302c" }}>
          No clips in the manifest. Run <code>npm run sprites</code>.
        </p>
      )}

      {clip && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            <Stage clip={clip} scale={0.55} label={`${clip} · light · 0.55x`} />
            <Stage clip={clip} scale={0.55} dark label={`${clip} · dark · 0.55x`} />
            <Stage clip={clip} scale={0.28} label={`${clip} · light · 0.28x`} />
            <OnionCheck clip={clip} />
          </div>

          <h2 style={{ fontSize: 15, margin: "36px 0 8px" }}>Manifest</h2>
          <pre
            style={{
              font: "12px/1.6 ui-monospace, monospace",
              background: "#f2f2ee",
              border: "1px solid #e2e2da",
              padding: "12px 14px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(m, null, 2)}
          </pre>
        </>
      )}
    </main>
  );
}
