/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token"
  ],
} 