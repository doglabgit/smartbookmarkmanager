/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Note: CORS is handled by the backend API. The Next.js rewrites proxy the /api/* routes
  // to the backend, which sets appropriate CORS headers based on ALLOWED_ORIGINS.
  // No additional CORS headers needed here.
}

export default nextConfig
