"use client";

import Link from "next/link";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowLeft } from "lucide-react";

export default function Woodworking() {
  return (
    <section style={{ padding: "4rem 0 6rem" }}>
      <div
        className="mx-auto"
        style={{ maxWidth: "1100px", padding: "0 1.5rem" }}
      >
        {/* Back link */}
        <BlurFade delay={0.05}>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                "var(--text-muted)";
            }}
          >
            <ArrowLeft size={14} strokeWidth={2} />
            Back to cool stuff
          </Link>
        </BlurFade>

        {/* Heading */}
        <BlurFade delay={0.15}>
          <h1
            className="text-h1 mt-10"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-display)",
            }}
          >
            Woodworking
          </h1>
        </BlurFade>

        {/* Placeholder until Patrick adds photos and shop drawings to
            public/assets/woodworking/. See phase 3 of the plan. */}
        <BlurFade delay={0.25}>
          <p className="text-body mt-6" style={{ maxWidth: "34rem" }}>
            Slower feedback loop than code, and the mistakes cost more, which is
            probably why I like it. Photos of what I have made, and the drawings
            I made them from, are going here.
          </p>
        </BlurFade>
      </div>
    </section>
  );
}
