/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote watch images from any host (you paste image URLs from retailers).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
