import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['paging-undermost-ultra.ngrok-free.dev'],
  // Cart and checkout used to have separate account copies; one of each now serves everyone.
  async redirects() {
    return [
      { source: "/customer/cart", destination: "/cart", permanent: false },
      { source: "/customer/checkout", destination: "/checkout", permanent: false },
    ];
  },
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
