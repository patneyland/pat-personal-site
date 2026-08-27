"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowRight } from "lucide-react";

/* The home world. One white card on the site's dark ground, read dark on
   light. The shadow is deep because it falls on near-black, not on paper. */
const F = {
  card: "#ffffff",
  edge: "#e2e2e2",
  edgeSoft: "#ececec",
  ink: "#1a1a1a",
  inkSoft: "#555555",
  inkFaint: "#888888",
  accent: "#b8922a",
  shadow: "0 4px 32px rgba(0,0,0,0.45)",
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
        {/* Card: photo on the left, name and everything to read on the right */}
        <BlurFade delay={0.2} immediate className="w-full">
          <div
            className="grid gap-6 rounded-2xl p-5 sm:p-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-center md:gap-7"
            style={{
              backgroundColor: F.card,
              border: `1px solid ${F.edge}`,
              boxShadow: F.shadow,
            }}
          >
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
        </BlurFade>
      </div>
    </section>
  );
}
