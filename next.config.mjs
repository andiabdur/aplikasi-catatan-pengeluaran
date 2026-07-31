/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Abaikan eslint selama proses build kompilasi lokal
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Abaikan type checking selama build lokal (kita tetap typecheck via script tsc)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
