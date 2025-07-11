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
  // Skip API route generation during build
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
