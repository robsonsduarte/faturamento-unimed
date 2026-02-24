import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  typedRoutes: true,
  serverExternalPackages: ['puppeteer-core'],
}

export default nextConfig
