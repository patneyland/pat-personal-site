"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Switches the whole site into boring mode.
 *
 * Sits in the corner rather than in the page flow, so the home page keeps
 * fitting on one screen. It is a link dressed as a switch: the "on" state is
 * a different page, not a piece of state.
 */
export default function BoringModeToggle() {
  const [hot, setHot] = useState(false);

  return (
    <Link
      href="/"
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      style={{
        position: "absolute",
        top: "1.25rem",
        right: "1.5rem",
        zIndex: 20,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.45rem 0.75rem",
        border: `1px solid ${hot ? "var(--accent-dim)" : "var(--border)"}`,
        borderRadius: 3,
        textDecoration: "none",
        transition: "border-color 0.2s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 30,
          height: 16,
          borderRadius: 999,
          border: `1px solid ${hot ? "var(--accent-dim)" : "var(--border)"}`,
          flexShrink: 0,
          transition: "border-color 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: hot ? "var(--accent)" : "var(--text-muted)",
            transition: "background 0.2s ease",
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hot ? "var(--text)" : "var(--text-muted)",
          transition: "color 0.2s ease",
        }}
      >
        Boring mode
      </span>
    </Link>
  );
}
