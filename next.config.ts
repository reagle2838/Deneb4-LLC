import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // No remote image hosts needed yet. Add remotePatterns here if/when
    // articles or work case studies pull images from an external bucket.
    remotePatterns: [],
  },
  eslint: {
    // The production build is gated on TypeScript + compilation. Lint is run
    // separately via `npm run lint` to avoid ESLint config/version friction
    // failing an otherwise-valid build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
