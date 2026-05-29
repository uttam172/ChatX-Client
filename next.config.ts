import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN IP to access Next.js dev resources (HMR, webpack etc.)
  // Required when opening the app from another PC on the same network
  allowedDevOrigins: [
    '192.168.1.155',
    '192.168.1.*',   // covers any device on your local network
  ],
};

export default nextConfig;
