/**
 * @file src/constants/docs.ts
 * @desc Developer docs registry (content/docs/<slug>.mdx), served at /docs/<slug>.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

export const DOC_SLUGS = ["api"] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

export const DOC_DOCS: Record<
  DocSlug,
  { title: string; description: string; lastUpdated: string }
> = {
  api: {
    title: "packs API",
    description:
      "Read public packs and manage your own from scripts and bots with a personal API key: endpoints, limits, errors and an OpenAPI document.",
    lastUpdated: "2026-09-26",
  },
};

/**
 * @function isDocSlug
 * @param value {string} untrusted route segment
 * @returns {boolean} true only for a registered slug
 */
export const isDocSlug = (value: string): value is DocSlug =>
  (DOC_SLUGS as readonly string[]).includes(value);
