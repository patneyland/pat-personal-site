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
}

export default function BlurFade({
  children,
  delay = 0,
  duration = 0.6,
  blur = "4px",
  className,
  once = true,
}: BlurFadeProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: `blur(${blur})`, y: 12 }}
      animate={
        inView
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
