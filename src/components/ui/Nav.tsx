"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/fun", label: "Home" },
  { href: "/story", label: "Story" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/garden", label: "Garden" },
];

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
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

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
              color: active ? "var(--accent)" : "var(--text-muted)",
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
    </nav>
  );
}
