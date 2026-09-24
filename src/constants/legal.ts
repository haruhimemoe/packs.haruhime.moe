/**
 * @file src/constants/legal.ts
 * @desc Legal document registry: slugs, titles, last-updated dates. The MDX bodies live in
 *       content/legal/<slug>.mdx. Bump lastUpdated in the same commit as any wording change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "your-privacy-rights",
  "copyright",
  "disclaimers",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_DOCS: Record<
  LegalSlug,
  { title: string; description: string; lastUpdated: string }
> = {
  terms: {
    title: "Terms of Service",
    description: "The rules for using packs.haruhime.moe.",
    lastUpdated: "2026-09-23",
  },
  privacy: {
    title: "Privacy Policy",
    description: "What packs.haruhime.moe stores, why, and what stays in your browser.",
    lastUpdated: "2026-09-24",
  },
  "your-privacy-rights": {
    title: "GDPR & CCPA",
    description:
      "Your rights over your data under the GDPR and the CCPA, what we hold and why, and how to use them.",
    lastUpdated: "2026-09-23",
  },
  copyright: {
    title: "Copyright & Takedown",
    description: "How to report a saved pack, and where to send notices about beatmap files.",
    lastUpdated: "2026-09-23",
  },
  disclaimers: {
    title: "Disclaimers",
    description:
      "Who packs isn't affiliated with, how our requests identify themselves, and what our numbers mean.",
    lastUpdated: "2026-09-23",
  },
};

/**
 * @function isLegalSlug
 * @param value {string} untrusted route segment
 * @returns {boolean} true only for an exact registered slug (never prototype keys)
 */
export const isLegalSlug = (value: string): value is LegalSlug =>
  (LEGAL_SLUGS as readonly string[]).includes(value);
