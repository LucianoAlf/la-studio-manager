/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'ALLOWALL' },
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
