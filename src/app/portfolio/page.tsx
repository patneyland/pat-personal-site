import Portfolio from "@/components/sections/Portfolio";
import NeylandCTA from "@/components/sections/NeylandCTA";

export const metadata = {
  title: "Cool Stuff | Patrick Neyland",
  description:
    "Things Patrick Neyland has built, from client AI systems to side projects, plus the boring but important record for anyone who needs it.",
};

export default function PortfolioPage() {
  return (
    <main>
      <Portfolio />
      <NeylandCTA />
    </main>
  );
}
