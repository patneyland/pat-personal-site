import Hero from "@/components/sections/Hero";
import Story from "@/components/sections/Story";
import Projects from "@/components/sections/Projects";
import NeylandCTA from "@/components/sections/NeylandCTA";
import Contact from "@/components/sections/Contact";

export default function Home() {
  return (
    <main>
      <Hero />
      <Story />
      <Projects />
      <NeylandCTA />
      <Contact />
    </main>
  );
}
