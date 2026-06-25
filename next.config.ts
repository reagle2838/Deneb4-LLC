import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray package-lock.json in the
  // user's home folder otherwise makes Next infer the wrong root.
  outputFileTracingRoot: projectRoot,
  images: {
    // The host's Next image optimizer (/_next/image) can't run on this shared
    // plan (no sharp / limited memory), so it 503s. Serve the original files
    // directly instead — proven to work and fine for a marketing site.
    unoptimized: true,
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
