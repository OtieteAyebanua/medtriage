import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a second dev/build instance run alongside the main one (e.g. NEXT_DIST_DIR=.next-verify next dev -p 3001)
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
