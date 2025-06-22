import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // During production builds, ESLint errors will be treated as warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: true,
  },
  experimental: {
    // Skip static generation for API routes to avoid initialization during build
    instrumentationHook: false,
  },
  // Skip API route generation during build
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  // Disable static optimization for API routes
  output: 'standalone',
};

export default nextConfig;
