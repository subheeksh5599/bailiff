/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The Convex backend and its tests share the repository root, so the tracing
  // root is pinned here instead of letting Next guess between two lockfiles.
  outputFileTracingRoot: new URL("../", import.meta.url).pathname,
};

export default nextConfig;
