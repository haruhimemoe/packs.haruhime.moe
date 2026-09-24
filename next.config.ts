/**
 * @file next.config.ts
 * @desc Next.js config: MDX page extensions, strict mode, unoptimized images (every raster is an
 *       external osu! CDN asset we never transform), security headers on every route (no framing,
 *       no MIME sniffing, a trimmed Referer; a full CSP needs nonces and comes later), no
 *       X-Powered-By, redirects for the retired tournament check and archived pools guide pages,
 *       and a rewrite that serves each doc's Markdown copy at /docs/<slug>.md.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({ extension: /\.mdx?$/ });

/** Sent on every route. frame-ancestors (and X-Frame-Options for older browsers) stop clickjacking. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    // A dynamic segment can't end in ".md", so the Markdown route lives one level down.
    return [{ source: "/docs/:slug([a-z0-9-]+).md", destination: "/docs/:slug/md" }];
  },
  async redirects() {
    return [
      // The tournament check moved out of packs (2026-09-23); old guide links land on the index.
      { source: "/guide/official-tournament-pools", destination: "/guide", permanent: true },
      // Tournament pools moved to pools.haruhime.moe (2026-09-24); same for their guide.
      { source: "/guide/archived-pools", destination: "/guide", permanent: true },
    ];
  },
};

export default withMDX(nextConfig);
