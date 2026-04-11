"use client";

import Link from "next/link";
import BlurFade from "@/components/ui/BlurFade";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";

const projects = [
  {
    name: "Tank Wars",
    url: "https://tankwars.neylandsolutions.com/",
  },
  {
    name: "Your Family Stories",
    url: "https://your-family-stories.com/",
  },
  {
    name: "Trivia",
    url: "https://trivia.neylandsolutions.com/",
  },
];

function thumbnail(url: string) {
  return `https://image.thum.io/get/width/600/${url}`;
}

function SiteCard({
  name,
  url,
  delay,
}: {
  name: string;
  url: string;
  delay: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <BlurFade delay={delay}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "block",
          borderRadius: "8px",
          overflow: "hidden",
          border: `1px solid ${hovered ? "var(--accent-dim)" : "var(--border)"}`,
          background: "var(--bg-card)",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "border-color 0.2s ease, transform 0.2s ease",
          textDecoration: "none",
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            overflow: "hidden",
            background: "var(--bg-alt)",
          }}
        >
          <img
            src={thumbnail(url)}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        {/* Label */}
        <div
          style={{
            padding: "0.875rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "0.9375rem",
              fontWeight: 500,
              color: "var(--text)",
            }}
          >
            {name}
          </span>
          <ArrowUpRight
            size={14}
            strokeWidth={1.5}
            style={{
              color: hovered ? "var(--accent)" : "var(--text-muted)",
              transition: "color 0.2s ease",
              flexShrink: 0,
            }}
          />
        </div>
      </a>
    </BlurFade>
  );
}

export default function CoolStuff() {
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
            className="text-h1 mt-10 mb-10"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-display)",
            }}
          >
            Other Cool Stuff
          </h1>
        </BlurFade>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {projects.map((project, i) => (
            <SiteCard
              key={project.url}
              name={project.name}
              url={project.url}
              delay={0.25 + i * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
