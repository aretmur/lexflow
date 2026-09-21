import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "resend"],
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
      allowedOrigins: ["lexflow.com.au", "www.lexflow.com.au", "localhost:3000"],
    },
  },
};

export default nextConfig;
