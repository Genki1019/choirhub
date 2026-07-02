import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async rewrites() {
    const rules: { source: string; destination: string }[] = [
      { source: "/api/v1/:path*", destination: `${API_INTERNAL_URL}/api/v1/:path*` },
    ];
    if (!process.env.R2_BUCKET_NAME) {
      rules.push({ source: "/uploads/:path*", destination: `${API_INTERNAL_URL}/uploads/:path*` });
    }
    return rules;
  },
};

export default nextConfig;
