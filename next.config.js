const path = require("path");

const isPages = process.env.GITHUB_PAGES === "true";
const basePath = isPages ? "/wenji" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pages：静态导出；云端接口（CloudBase 云托管）：standalone
  output: isPages ? "export" : "standalone",
  trailingSlash: isPages,
  images: { unoptimized: true },
  basePath,
  assetPrefix: isPages ? "/wenji/" : undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
