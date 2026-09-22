import type { NextConfig } from "next";

/**
 * One address, no server.
 *
 * The site is exported as static files and served by the same deployment that
 * answers its HTTP routes, so the product is a single origin and nothing needs
 * a second host or a domain wired up. Images are served as they are: the export
 * has no optimiser behind it, and pretending otherwise would only produce
 * broken URLs.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
