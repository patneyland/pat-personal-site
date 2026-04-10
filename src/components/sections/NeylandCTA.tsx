"use client";

import Image from "next/image";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowRight } from "lucide-react";

export default function NeylandCTA() {
  return (
    <section
      id="neyland-solutions"
      className="section-padding"
      style={{ backgroundColor: "var(--bg-alt)" }}
    >
      <div className="container-narrow text-center">
        <BlurFade delay={0.05}>
          <div className="mb-8 flex justify-center">
            <Image
              src="/assets/logo_white-small.png"
              alt="Neyland Solutions"
              width={160}
              height={48}
              className="h-10 w-auto opacity-80"
            />
          </div>
        </BlurFade>

        <BlurFade delay={0.1}>
          <h2
            className="text-h1 mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            This is the company I built to do this work.
          </h2>
        </BlurFade>

        <BlurFade delay={0.18}>
          <p className="text-body mb-4 mx-auto max-w-lg" style={{ fontSize: "1.0625rem" }}>
            Neyland Solutions helps small businesses (the ones running $1M–$3M
            operations with no time to become AI researchers) implement AI the
            right way.
          </p>
        </BlurFade>

        <BlurFade delay={0.24}>
          <p className="text-body mb-10 mx-auto max-w-lg">
            We start with a free AI Opportunity Starter Kit: a short form, your
            company&apos;s context, and a polished AI-generated report showing
            exactly where the opportunity is. Then we help you act on it.
          </p>
        </BlurFade>

        <BlurFade delay={0.3}>
          <a
            href="https://neylandsolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm px-6 py-3 text-sm font-semibold transition-opacity duration-200 hover:opacity-80"
            style={{
              backgroundColor: "var(--accent)",
              color: "#0e0e0e",
            }}
          >
            Visit Neyland Solutions
            <ArrowRight size={15} strokeWidth={2} />
          </a>
        </BlurFade>
      </div>
    </section>
  );
}
