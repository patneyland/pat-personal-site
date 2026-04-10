"use client";

import BlurFade from "@/components/ui/BlurFade";
import { ArrowUpRight } from "lucide-react";

const projects = [
  {
    tag: "AI Ecosystem",
    title: "Full AI Ecosystems for Marketing Agencies",
    description:
      "End-to-end AI infrastructure for marketing agencies: content generation pipelines, client reporting automation, and internal knowledge bases. Built to replace hours of manual work with AI-native workflows that agencies actually use.",
    link: "https://neylandsolutions.com",
    linkLabel: "Learn more",
  },
  {
    tag: "Web Application",
    title: "Your Family Stories",
    description:
      "An AI-powered app that helps families preserve their history. Users share memories and experiences through natural conversation, and the app generates beautifully written stories they can keep forever. The voices and moments that matter, saved before they're lost.",
    link: null,
    linkLabel: null,
  },
  {
    tag: "AI Lead Magnet",
    title: "AI Opportunity Starter Kit",
    description:
      "Our flagship lead magnet at Neyland Solutions. A business fills out a short form about their company. AI analyzes it and generates a polished, personalized report showing exactly where AI fits in their operations. Real insight, delivered instantly.",
    link: "https://neylandsolutions.com",
    linkLabel: "Try it",
  },
  {
    tag: "AI Lead Magnet",
    title: "Exterior Home Renderer",
    description:
      "Built for exterior renovation contractors. Visitors upload a photo of their home, choose finishes and styles, and AI renders what their house would look like after the renovation. Contractors get a powerful lead capture tool that turns browsers into booked consultations.",
    link: "https://neylandsolutions.com",
    linkLabel: "See the service",
  },
];

export default function Projects() {
  return (
    <section id="work" className="section-padding">
      <div className="container">
        <BlurFade delay={0.05}>
          <p className="text-caption text-gold mb-4">What I&apos;ve built</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <h2
            className="text-h1 mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            AI in practice.
          </h2>
        </BlurFade>
        <BlurFade delay={0.15}>
          <p className="text-body mb-16 max-w-xl">
            These aren&apos;t demos or proofs of concept. They&apos;re tools
            real businesses use to close more clients, save time, and do better
            work.
          </p>
        </BlurFade>

        <div className="grid gap-5 sm:grid-cols-2">
          {projects.map((project, i) => (
            <BlurFade key={project.title} delay={0.1 + i * 0.07}>
              <div
                className="group flex h-full flex-col gap-4 rounded-sm p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--accent-dim)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                }}
              >
                <p className="text-caption" style={{ color: "var(--accent)" }}>
                  {project.tag}
                </p>
                <h3
                  className="text-h2"
                  style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}
                >
                  {project.title}
                </h3>
                <p className="text-body flex-1">{project.description}</p>
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 mt-2"
                    style={{ color: "var(--accent)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--text)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--accent)";
                    }}
                  >
                    {project.linkLabel}
                    <ArrowUpRight size={14} strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
