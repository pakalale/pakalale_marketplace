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
};

export default nextConfig;
