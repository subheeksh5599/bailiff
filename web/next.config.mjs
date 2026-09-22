/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The Convex backend and its tests share the repository root, so the tracing
  // root is pinned here instead of letting Next guess between two lockfiles.
  outputFileTracingRoot: new URL("../", import.meta.url).pathname,
  // Static export: the app is client-rendered and talks to Convex from the browser,
  // so it needs no server. That is what lets the whole product be served from the
  // same deployment URL as the backend, with no second hosting provider to wire up.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
