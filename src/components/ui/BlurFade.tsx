"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  blur?: string;
  className?: string;
  once?: boolean;
  /**
   * Animate on mount instead of on scroll.
   *
   * Use for anything that is part of a page-load sequence rather than a
   * scroll reveal. Without it, content sitting just past the fold stays at
   * opacity 0 until the reader scrolls, which hides it with no hint that it
   * is there.
   */
  immediate?: boolean;
}

export default function BlurFade({
  children,
  delay = 0,
  duration = 0.6,
  blur = "4px",
  className,
  once = true,
  immediate = false,
}: BlurFadeProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-60px" });
  const show = immediate || inView;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: `blur(${blur})`, y: 12 }}
      animate={
        show
          ? { opacity: 1, filter: "blur(0px)", y: 0 }
          : { opacity: 0, filter: `blur(${blur})`, y: 12 }
      }
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
