"use client";

import BlurFade from "@/components/ui/BlurFade";
import { Mail, Linkedin, ExternalLink } from "lucide-react";

const links = [
  {
    icon: Mail,
    label: "Email",
    href: "mailto:patrick@neylandsolutions.com",
    display: "patrick@neylandsolutions.com",
  },
  {
    icon: Linkedin,
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/patrick-neyland",
    display: "linkedin.com/in/patrick-neyland",
  },
  {
    icon: ExternalLink,
    label: "Neyland Solutions",
    href: "https://neylandsolutions.com",
    display: "neylandsolutions.com",
  },
];

export default function Contact() {
  return (
    <footer id="contact" className="section-padding">
      <div className="container-narrow">
        {/* Divider */}
        <div
          className="mb-16 h-px w-full"
          style={{ backgroundColor: "var(--border)" }}
        />

        <BlurFade delay={0.05}>
          <p className="text-caption text-gold mb-4">Get in touch</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <h2
            className="text-h1 mb-10"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Let&apos;s talk.
          </h2>
        </BlurFade>

        <div className="flex flex-col gap-5">
          {links.map((link, i) => (
            <BlurFade key={link.label} delay={0.12 + i * 0.07}>
              <a
                href={link.href}
                target={link.href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 transition-colors duration-200"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)";
                }}
              >
                <link.icon size={16} strokeWidth={1.5} />
                <span className="text-sm">{link.display}</span>
              </a>
            </BlurFade>
          ))}
        </div>

        {/* Footer note */}
        <BlurFade delay={0.35}>
          <p
            className="mt-20 text-xs"
            style={{ color: "var(--text-faint)", letterSpacing: "0.04em" }}
          >
            © {new Date().getFullYear()} Patrick Neyland
          </p>
        </BlurFade>
      </div>
    </footer>
  );
}
