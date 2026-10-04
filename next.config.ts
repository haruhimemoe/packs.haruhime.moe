/**
 * @file next.config.ts
 * @desc Next.js config: MDX page extensions, strict mode, unoptimized images (every raster is an
 *       external osu! CDN asset we never transform), security headers on every route (no framing,
 *       no MIME sniffing, a trimmed Referer; a full CSP needs nonces and comes later), no
 *       X-Powered-By, redirects for the retired tournament check and archived pools guide pages,
 *       and a rewrite that serves each doc's Markdown copy at /docs/<slug>.md. @haruhimemoe/brand
 *       and resvg stay out of the server bundle (resvg is a native binary, and brand reads its
 *       fonts by a computed path, traced for the pack card route), so ogCard runs per request.
 *       MDX content runs through @haruhimemoe/ui/remark (code fence meta, callouts, heading ids);
 *       passed by module name since Turbopack only takes MDX plugins that way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Fri Oct 3, 2026
 */

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { remarkPlugins: ["@haruhimemoe/ui/remark"] },
});

/**
 * Sent on every route. frame-ancestors (and X-Frame-Options for older browsers) stop clickjacking.
 * The rest of the CSP needs no nonces: no plugins (object-src), no <base> that could send relative
 * URLs elsewhere (base-uri), and no form posting off-site (form-action). script-src waits for the
 * nonce work.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ["@haruhimemoe/brand", "@resvg/resvg-js"],
  outputFileTracingIncludes: {
    // A picomatch glob over the route: "[slug]" would be a character class.
    "/p/*/og.png": ["./node_modules/@haruhimemoe/brand/fonts/*.ttf"],
  },
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
