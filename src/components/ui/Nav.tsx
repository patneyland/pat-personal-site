"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS } from "@/lib/sections";

/**
 * The nav is the one landmark that never changes, so it stays a dark bar in
 * the same place on every page it appears, including over the story's cream
 * paper. Street signs look the same in every neighbourhood; that is what makes
 * them useful.
 *
 * What it does carry is each district's colour, always, not only the one you
 * are standing in. That makes the bar a legend as well as a path: green means
 * garden whether or not you have been there yet. The current district is the
 * same hue at full strength, so "you are here" and "here is what that is" are
 * the same signal at two volumes.
 *
 * It used to mark the current section in the base gold on every page, which
 * told a visitor in the garden that they were somewhere gold. See
 * docs/refinement.md section 0.
 */

/** Resting links are their own hue, held back so the current one stands out. */
const REST_ALPHA = 0.42;
const HOVER_ALPHA = 0.75;

function tint(hue: string, alpha: number) {
  return `color-mix(in srgb, ${hue} ${Math.round(alpha * 100)}%, transparent)`;
}

export default function Nav() {
  const pathname = usePathname();

  /* "/" is boring mode, which has to look like a plain academic page, and site
     chrome ruins that. The designed home carries its own links. */
  if (pathname === "/" || pathname === "/fun") return null;

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        gap: "1.75rem",
        padding: "1.1rem 1.5rem",
        backgroundColor: "rgba(14,14,14,0.82)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {SECTIONS.map((link) => {
        const active = pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textDecoration: "none",
              color: active ? link.hue : tint(link.hue, REST_ALPHA),
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = tint(
                  link.hue,
                  HOVER_ALPHA,
                );
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = tint(
                  link.hue,
                  REST_ALPHA,
                );
              }
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
