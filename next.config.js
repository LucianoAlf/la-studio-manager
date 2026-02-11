/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [{
    source: '/(.*)',
    headers: [
      // X-Frame-Options removed in dev for Simple Browser compatibility
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'X-Frame-Options', value: 'DENY' }] : []),
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
