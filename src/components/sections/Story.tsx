"use client";

import BlurFade from "@/components/ui/BlurFade";

const chapters = [
  {
    index: "01",
    heading: "Started where numbers made sense.",
    body: "I majored in accounting because I understood the world through spreadsheets and ledgers. Numbers told stories. I liked that. Then I kept going: a master's in financial economics, digging deeper into how markets really work.",
  },
  {
    index: "02",
    heading: "Then ChatGPT launched. Everything changed.",
    body: "Halfway through my master's program, ChatGPT dropped. I became obsessed. Not in a novelty way. In a \"this fundamentally changes everything I thought I knew about knowledge work\" way. I couldn't stop thinking about what it meant for professions built on analysis, judgment, and expertise.",
  },
  {
    index: "03",
    heading: "I started a PhD to research it. Then hit a wall.",
    body: "I enrolled in a PhD program in accounting specifically to study how AI was reshaping the profession. But the data wasn't there yet. AI is moving faster than academic research cycles. The journals were two years behind the real world. I was trying to measure an ocean with a ruler.",
  },
  {
    index: "04",
    heading: "A conversation at the Arizona Department of Revenue.",
    body: "While working with the Arizona Department of Revenue, I asked a simple question: \"How are you using AI?\" The answer was honest and stuck with me: \"We just don't have the bandwidth to figure it out right now.\" That was the moment. The gap wasn't knowledge. It was capacity and guidance.",
  },
  {
    index: "05",
    heading: "So I decided to fill the gap.",
    body: "If institutions that want AI can't navigate it alone, and researchers can't study it fast enough, someone needs to bridge that. I left the theoretical for the practical. I founded Neyland Solutions to help companies and institutions actually implement AI, so they can do better work without waiting for the world to catch up.",
  },
];

export default function Story() {
  return (
    <section id="story" className="section-padding" style={{ backgroundColor: "var(--bg-alt)" }}>
      <div className="container-narrow">
        <BlurFade delay={0.05}>
          <p className="text-caption text-gold mb-4">The story</p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <h2 className="text-h1 font-display mb-16" style={{ fontFamily: "var(--font-display)" }}>
            How an accountant became an AI leader.
          </h2>
        </BlurFade>

        <div className="flex flex-col gap-12">
          {chapters.map((chapter, i) => (
            <BlurFade key={chapter.index} delay={0.1 + i * 0.08}>
              <div className="chapter-mark">
                <p className="text-caption mb-3" style={{ color: "var(--accent-dim)" }}>
                  {chapter.index}
                </p>
                <h3
                  className="text-h2 mb-3"
                  style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}
                >
                  {chapter.heading}
                </h3>
                <p className="text-body">{chapter.body}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
