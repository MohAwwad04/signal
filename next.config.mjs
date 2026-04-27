/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
