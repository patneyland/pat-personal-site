import Hero from "@/components/sections/Hero";

/**
 * No metadata export on purpose. The title and description in layout.tsx are
 * Patrick's own words and already describe this page, so it inherits them
 * rather than carrying a second, drifting copy.
 */
export default function FunPage() {
  return (
    <main>
      <Hero />
    </main>
  );
}
