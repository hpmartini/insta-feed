import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@instafeed/shared', '@instafeed/api-client'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:4000'}/api/:path*` }];
  },
};
export default config;
