"use client";

import { useCallback, useMemo, useState } from "react";
import Story from "@/components/sections/Story";

/** A labelled slider. The lab is all sliders. */
function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 2 }}>
      <span
        style={{
          font: "10px ui-monospace, monospace",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "#9aa0ab",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <b style={{ color: "#e6e6e0" }}>{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ width: 168, accentColor: "#c9a84c" }}
      />
    </label>
  );
}

export default function StoryGaryLab() {
  const [height, setHeight] = useState(66);
  const [walk, setWalk] = useState(75);
  const [run, setRun] = useState(141);
  const [debug, setDebug] = useState(true);
  const [hud, setHud] = useState({ clip: "-", dir: 1, scroll: 0 });

  const strides = useMemo(() => ({ walk, run }), [walk, run]);
  const onSample = useCallback(
    (info: { clip: string; dir: number; scroll: number }) =>
      setHud((h) =>
        h.clip === info.clip && h.dir === info.dir
          ? h
          : { ...info, scroll: Math.round(info.scroll) },
      ),
    [],
  );

  return (
    <>
      <Story gary={{ height, debug, strides, onSample, minWidth: 0 }} />

      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 50,
          display: "grid",
          gap: 10,
          padding: "13px 15px",
          background: "rgba(12,13,16,0.92)",
          border: "1px solid #2c2f36",
          borderRadius: 8,
          backdropFilter: "blur(6px)",
          font: "12px ui-sans-serif, system-ui, sans-serif",
          color: "#e6e6e0",
        }}
      >
        <div
          style={{
            font: "10px ui-monospace, monospace",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "#c9302c",
          }}
        >
          Dev only · story gary
        </div>
        <Knob label="height" value={height} min={34} max={110} onChange={setHeight} />
        <Knob label="walk stride" value={walk} min={40} max={140} onChange={setWalk} />
        <Knob label="run stride" value={run} min={60} max={220} onChange={setRun} />
        <label style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          <span style={{ color: "#9aa0ab" }}>
            show surfaces <span style={{ color: "#4ade80" }}>—</span> and arcs{" "}
            <span style={{ color: "#f472b6" }}>—</span>
          </span>
        </label>
        <div
          style={{
            font: "11px ui-monospace, monospace",
            color: "#9aa0ab",
            borderTop: "1px solid #2c2f36",
            paddingTop: 8,
          }}
        >
          {hud.clip} · facing {hud.dir > 0 ? "right" : "left"} · y {hud.scroll}
        </div>
        <p style={{ margin: 0, color: "#6f757f", maxWidth: 190, lineHeight: 1.45 }}>
          Scroll down, then back up. He should retrace the same path facing the
          other way, not backpedal.
        </p>
      </div>
    </>
  );
}
