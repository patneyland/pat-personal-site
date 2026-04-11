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
            href="/"
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
            Back
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
      </div>
    </section>
  );
}
