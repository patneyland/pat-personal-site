"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowRight } from "lucide-react";

const PHOTOS = [
  {
    src: "/assets/slideshow/photo-one.png",
    caption: "AI-edited. I promise I'm not this pretentious.",
  },
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
      className="relative overflow-hidden"
      style={{ padding: "3rem 0 3rem" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "900px",
          height: "600px",
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(201,168,76,0.06) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative z-10 mx-auto flex flex-col items-center gap-6 text-center"
        style={{ maxWidth: "620px", padding: "0 1.5rem" }}
      >
{/* Name */}
        <BlurFade delay={0.2}>
          <h1
            className="text-display whitespace-nowrap"
            style={{ fontSize: "clamp(2rem, 6vw, 3rem)" }}
          >
            Patrick Neyland
          </h1>
        </BlurFade>

        {/* Intro Card */}
        <BlurFade delay={0.35} className="w-full">
          <div
            className="rounded-2xl text-left"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e2e2",
              boxShadow: "0 4px 32px rgba(0,0,0,0.45)",
            }}
          >
            <div className="p-6">
              <p className="text-body" style={{ color: "#1a1a1a" }}>
                I am a child of God, dad, and husband. For work, I am an AI
                expert and act as a fractional Chief AI Officer through the
                company{" "}
                <a
                  href="https://neylandsolutions.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#b8922a" }}
                >
                  Neyland Solutions
                </a>
                , which I co-founded with my brother, Blake.
              </p>
              <p className="mt-3 text-body" style={{ color: "#1a1a1a" }}>
                I love building cool stuff, watching people get excited about AI
                and automation, and just making people&apos;s work more enjoyable,
                through AI.
              </p>
              <p className="mt-3 text-body" style={{ color: "#555555" }}>
                I also love cooking, woodworking, and birding (bird watching).
              </p>
            </div>

            {/* Slideshow */}
            <div className="px-4 pb-4">
              <div
                className="relative w-full overflow-hidden rounded-xl"
                style={{ aspectRatio: "3/4", maxHeight: "384px" }}
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
                      className="object-contain"
                      priority={current === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Caption */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={current}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.75rem",
                    fontStyle: "italic",
                    color: "#888888",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  {caption}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </BlurFade>

        {/* CTAs */}
        <BlurFade delay={0.5}>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/story"
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              }}
            >
              Read my story
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
            <Link
              href="/cool-stuff"
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
              style={{ color: "var(--text-faint)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-faint)";
              }}
            >
              Other cool stuff
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
