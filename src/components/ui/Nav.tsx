"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import AtariJoystick from "@/components/ui/AtariJoystick";
import { usePathname } from "next/navigation";
import { SECTIONS } from "@/lib/sections";

/**
 * The nav is the one landmark that never changes, so it sits in the same place
 * on every page it appears, including over the story's cream paper. Street
 * signs look the same in every neighbourhood; that is what makes them useful.
 *
 * It used to be a hardcoded near-black bar. That was fine while the site was
 * committed dark and became a black band across a #F7F7F7 page the moment
 * light mode existed, with the light palette's dark district hues sitting on
 * it unreadable. It follows --bg now, so "the same bar everywhere" means the
 * same bar within a mode.
 *
 * It used to wear each district's colour, so the bar doubled as a legend:
 * green meant garden whether or not you had been there. Patrick cut that on
 * 2026-09-05. Four hues at 0.7rem was four small coloured words rather than a
 * key, and it fought the page it sat on. The bar is one colour now and the
 * only thing it encodes is where you are: the current section at full ink,
 * the rest held back. Each page still accents with its own hue; the nav just
 * stopped announcing them. See docs/refinement.md section 0 for the argument
 * this overrides.
 */

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
        alignItems: "center",
        padding: "1.1rem 1.5rem",
        backgroundColor: "color-mix(in srgb, var(--bg) 82%, transparent)",
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
              color: active ? "var(--text)" : "var(--text-muted)",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-muted)";
              }
            }}
          >
            {link.label}
          </Link>
        );
      })}

      {/* The arcade sits apart from the four sections, as an icon rather than
          a word. It is not a district: it is a whole separate document in
          public/ with its own reset and its own look, so listing it in
          SECTIONS would promise a fifth page in the same site and deliver
          somewhere else. The icon says "door to somewhere" instead.

          A plain anchor, because /arcade is reached through a rewrite and has
          no route payload for next/link to prefetch. */}
      <a
        href="/arcade"
        aria-label="Arcade"
        title="Arcade"
        style={{
          display: "flex",
          alignItems: "center",
          color: "var(--text-muted)",
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }}
      >
        <AtariJoystick size={15} />
      </a>

      <ThemeToggle />
    </nav>
  );
}
