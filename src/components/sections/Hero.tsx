"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import BlurFade from "@/components/ui/BlurFade";
import GaryPacing from "@/components/ui/GaryPacing";
import House, { HOUSE_HEADROOM } from "@/components/ui/House";
import ScriptureMarquee from "@/components/ui/ScriptureMarquee";
import { ArrowRight } from "lucide-react";
import AtariJoystick from "@/components/ui/AtariJoystick";
import ThemeToggle from "@/components/ui/ThemeToggle";

/* The home world. One white card on the site's ground, read dark on light.
   The card is an object, not a background: it stays white in light mode too,
   so everything in this constant except the shadow and the edge is fixed
   across modes. The accent is the brick from the light palette rather than
   --hue-fun, because --hue-fun is a pastel coral in dark mode and a pastel on
   white is about 1.8:1. See the --hue-fun-paper note in globals.css.

   The shadow and the edge are the two values that do move: a shadow tuned for
   near-black is a smudge on #F7F7F7, and a #e2e2e2 edge disappears on it. */
const F = {
  card: "#ffffff",
  edge: "var(--fun-card-edge)",
  edgeSoft: "#ececec",
  ink: "#1a1a1a",
  inkSoft: "#555555",
  inkFaint: "#888888",
  accent: "var(--hue-fun-paper)",
  shadow: "var(--fun-card-shadow)",
};

const PHOTOS = [
  {
    src: "/assets/slideshow/photo-two.png",
    caption:
      "I have a beautiful wife and four wonderful kids. This is us after church on Palm Sunday.",
  },
  {
    src: "/assets/slideshow/photo-three.png",
    caption:
      "I earned my master's degree from Utah State in Financial Economics.",
  },
  {
    src: "/assets/slideshow/photo-four.png",
    caption: "Daddy-daughter dance.",
  },
];

const CAPTION_STYLE: React.CSSProperties = {
  fontSize: "0.72rem",
  fontStyle: "italic",
  color: F.inkFaint,
  textAlign: "center",
  lineHeight: 1.45,
};

/* The captions differ by two lines, which made the whole card grow and shrink
   as the slideshow advanced. Rendering the longest one invisibly reserves the
   space, so the frame holds still and stays correct if a photo is added. */
const LONGEST_CAPTION = PHOTOS.reduce(
  (longest, photo) =>
    photo.caption.length > longest.length ? photo.caption : longest,
  "",
);

const LINKS = [
  { href: "/story", label: "Read my story" },
  { href: "/portfolio", label: "See what I have built" },
  { href: "/garden", label: "Poke around the garden" },
];

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % PHOTOS.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const { src, caption } = PHOTOS[current];

  return (
    <section
      className="relative flex flex-col justify-center overflow-hidden"
      style={{
        /* The home page is meant to sit on one screen. Everything inside is
           sized off the viewport so it holds on a laptop as well as a large
           monitor. */
        minHeight: "100svh",
        padding: "2rem 0",
      }}
    >
      <div
        className="relative z-10 mx-auto flex w-full flex-col items-center gap-5"
        style={{ maxWidth: "940px", padding: "0 1.5rem" }}
      >
        {/* Card: photo on the left, name and everything to read on the right.
            Gary walks the outside of its top edge, so the wrapper is the
            positioning context he measures himself against. */}
        <BlurFade delay={0.2} immediate className="w-full">
          {/* The margin holds the house's height open above the card, so the
              section's overflow: hidden can never cut the roof off however
              little sky the centring leaves. Margin, not padding: the house
              hangs from this wrapper's top edge, which must stay the card's
              top edge or the house lifts off its ground line. */}
          <div className="relative" style={{ marginTop: HOUSE_HEADROOM }}>
            <House />
            <GaryPacing />
            <div
              className="relative grid gap-6 rounded-2xl p-5 sm:p-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-center md:gap-7"
              style={{
                backgroundColor: F.card,
                border: `1px solid ${F.edge}`,
                boxShadow: F.shadow,
              }}
            >
              {/* The way into the arcade. Small and in the corner on purpose:
                  it is an easter egg, not a fifth section, and the three links
                  above it are the things Patrick actually wants read first.

                  A plain anchor rather than next/link. /arcade is a static
                  document in public/ reached through a rewrite, so there is no
                  route payload for Link to prefetch. */}
              {/* The two doors out of this card, in its bottom corner. The
                  theme toggle has to be here as well as in the nav, because
                  Nav renders nothing on /fun: this page carries its own links
                  and a visitor who never leaves it would otherwise have no way
                  to get out of whatever mode their OS put them in. */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2.5 sm:bottom-4 sm:right-4">
                <a
                  href="/arcade"
                  aria-label="Arcade"
                  title="Arcade"
                  style={{ color: F.inkFaint, lineHeight: 0 }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = F.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = F.inkFaint;
                  }}
                >
                  <AtariJoystick size={18} />
                </a>
                <ThemeToggle
                  size={16}
                  color={F.inkFaint}
                  hoverColor={F.accent}
                />
              </div>
              {/* Left: slideshow */}
              <div>
                <div
                  className="relative mx-auto w-full overflow-hidden rounded-xl"
                  style={{
                    aspectRatio: "3/4",
                    maxHeight: "min(340px, 42svh)",
                    /* The photos are not all exactly 3:4 and object-contain
                       avoids cropping faces, so let the letterboxing fall away
                       into the card rather than showing as grey bars. */
                    backgroundColor: "transparent",
                  }}
                >
                  <AnimatePresence mode="sync">
                    <motion.div
                      key={current}
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                    >
                      <Image
                        src={src}
                        alt="Patrick Neyland"
                        fill
                        sizes="(max-width: 768px) 90vw, 300px"
                        className="object-contain"
                        priority={current === 0}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div style={{ position: "relative", marginTop: "0.5rem" }}>
                  {/* Height reservation only. Never shown, never read aloud. */}
                  <p aria-hidden style={{ ...CAPTION_STYLE, visibility: "hidden" }}>
                    {LONGEST_CAPTION}
                  </p>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={current}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      style={{
                        ...CAPTION_STYLE,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                      }}
                    >
                      {caption}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* Right: the name, then the intro and where to go next */}
              <div className="text-left">
                <h1
                  className="text-display whitespace-nowrap"
                  style={{
                    fontSize: "clamp(1.75rem, 4.5vw, 2.5rem)",
                    color: F.ink,
                    marginBottom: "1rem",
                  }}
                >
                  Patrick Neyland
                </h1>

                <p className="text-body" style={{ color: F.ink }}>
                  I am a child of God, dad, and husband. For work, I am an AI
                  expert and act as a fractional Chief AI Officer through the
                  company{" "}
                  <a
                    href="https://neylandsolutions.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: F.accent }}
                  >
                    Neyland Solutions
                  </a>
                  , which I co-founded with my brother, Blake.
                </p>
                <p className="mt-3 text-body" style={{ color: F.ink }}>
                  I love building cool stuff, watching people get excited about AI
                  and automation, and just making people&apos;s work more
                  enjoyable, through AI.
                </p>
                <p className="mt-3 text-body" style={{ color: F.inkSoft }}>
                  I also love cooking, woodworking, and birding (bird watching).
                </p>

                <div
                  className="mt-5 flex flex-col items-start gap-2 pt-4"
                  style={{ borderTop: `1px solid ${F.edgeSoft}` }}
                >
                  {LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
                      style={{ color: F.inkSoft }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = F.ink;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = F.inkSoft;
                      }}
                    >
                      {link.label}
                      <ArrowRight size={14} strokeWidth={2} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Inside the column, so the verse is exactly as wide as the card it
            sits under and lines up with its edges at every width. The column's
            gap-5 sets the space above it. */}
        <BlurFade delay={0.6} immediate className="w-full">
          <ScriptureMarquee />
        </BlurFade>
      </div>
    </section>
  );
}
