/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb"
    }
  }
};
module.exports = nextConfig;
