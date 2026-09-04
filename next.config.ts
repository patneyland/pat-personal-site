import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /* /arcade is a whole static document in public/arcade/, not an app route,
     so that its CSS reset cannot leak into the rest of the site. Next serves
     public files at their literal path, which would leave the page reachable
     only as /arcade/index.html. This rewrite gives it the clean URL. */
  async rewrites() {
    return [{ source: "/arcade", destination: "/arcade/index.html" }];
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
