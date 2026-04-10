"use client";

import Image from "next/image";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="section-padding-hero relative overflow-hidden">
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

      <div className="container relative z-10">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Photo */}
          <BlurFade delay={0.1} className="shrink-0">
            <div
              className="relative h-36 w-36 overflow-hidden rounded-full lg:h-44 lg:w-44"
              style={{ border: "2px solid var(--border)" }}
            >
              <Image
                src="/assets/professional-photo.png"
                alt="Patrick Neyland"
                fill
                className="object-cover object-top"
                priority
              />
            </div>
          </BlurFade>

          {/* Text */}
          <div className="flex flex-col gap-5">
            <BlurFade delay={0.15}>
              <p className="text-caption text-gold tracking-widest">
                AI Leader · Founder · Builder
              </p>
            </BlurFade>

            <BlurFade delay={0.2}>
              <h1 className="text-display">
                Patrick
                <br />
                <span className="text-gold">Neyland</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.3}>
              <p
                className="text-body max-w-lg"
                style={{ fontSize: "1.125rem", lineHeight: "1.7" }}
              >
                I help companies and institutions implement AI so they can do
                better work. They don&apos;t need to become AI researchers to
                get there.
              </p>
            </BlurFade>

            <BlurFade delay={0.4}>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="https://neylandsolutions.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#0e0e0e",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = "0.85";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = "1";
                  }}
                >
                  Neyland Solutions
                  <ArrowRight size={14} strokeWidth={2} />
                </a>
                <a
                  href="#story"
                  className="text-sm font-medium transition-colors duration-200"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--text-muted)";
                  }}
                >
                  Read my story ↓
                </a>
              </div>
            </BlurFade>
          </div>
        </div>
      </div>
    </section>
  );
}
