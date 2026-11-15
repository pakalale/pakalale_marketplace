import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['paging-undermost-ultra.ngrok-free.dev'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async redirects() {
    return [{ source: "/checkout", destination: "/customer/checkout", permanent: false }];
  },
};

export default nextConfig;
