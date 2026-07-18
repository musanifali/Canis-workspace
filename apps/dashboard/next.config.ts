import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ESLint runs as its own turbo task (`npm run lint`), not inside next build.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
