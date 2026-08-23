import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      // /cool-stuff was the old side-projects page. Everything on it now lives
      // on /portfolio, so keep any shared link working.
      { source: "/cool-stuff", destination: "/portfolio", permanent: true },
      // Boring mode became the front door.
      { source: "/boring", destination: "/", permanent: true },
      { source: "/woodworking", destination: "/portfolio/woodworking", permanent: true },
    ];
  },
};

export default nextConfig;
