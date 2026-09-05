"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Two states: light and dark. It shows the one you will get by clicking, so
 * the sun means "go light" and the moon means "go dark".
 *
 * There used to be a third, "follow the OS", with a monitor icon. Patrick cut
 * it on 2026-09-05, along with saving the choice and, shortly after, reading
 * the OS at all. Every load now starts dark and this is the only way to
 * light.
 *
 * So this stores nothing. A click holds while you move around the site, since
 * App Router navigation leaves the document and its stamp alone, and a hard
 * reload puts you back on dark.
 *
 * Why the toggle exists at all. Dark is the stronger of the two palettes and
 * the one the site was designed in: the black ground is what makes the /fun
 * card and a white Gary work. Light is the compromise version, worth having
 * for anyone who wants to read a long garden entry on paper rather than on
 * black, and worth having to ask for.
 *
 * The stamp on <html> is written by the inline script in layout.tsx before
 * first paint. This only changes it afterwards, so there is no flash.
 */

type Theme = "light" | "dark";

const LABEL: Record<Theme, string> = {
  dark: "Switch to light mode",
  light: "Switch to dark mode",
};

type Props = {
  size?: number;
  /** Resting colour. Defaults to the nav's. /fun sits on a white card in both
      modes, so it passes its own. */
  color?: string;
  hoverColor?: string;
};

export default function ThemeToggle({
  size = 15,
  color = "var(--text-muted)",
  hoverColor = "var(--text)",
}: Props) {
  /* Dark on the server and on first client render, then corrected below.
     Reading storage during render would be a hydration mismatch: the server
     cannot know it. The page itself is already stamped correctly either way,
     so the only thing that settles here is which of the two icons shows. */
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-theme");
    setTheme(stamped === "light" ? "light" : "dark");
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  /* The icon is the destination, not the current state. */
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
      style={{
        display: "flex",
        alignItems: "center",
        padding: 0,
        border: "none",
        background: "none",
        cursor: "pointer",
        color,
        transition: "color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = hoverColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = color;
      }}
    >
      <Icon size={size} strokeWidth={1.5} />
    </button>
  );
}
