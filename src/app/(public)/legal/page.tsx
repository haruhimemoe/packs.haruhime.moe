/**
 * @file src/app/(public)/legal/page.tsx
 * @desc /legal: every legal page with its description, from the registry. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentIndex, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { toNavItem } from "@/utils/content-nav";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/legal",
  title: "packs legal pages",
  description:
    "The packs.haruhime.moe terms, privacy policy, your GDPR and CCPA rights, copyright and takedown, and disclaimers.",
});

const ITEMS = CONTENT.entries.legal.map(toNavItem("legal"));

/**
 * @function LegalIndexPage
 * @returns {JSX.Element} the section's header and its pages
 */
export default function LegalIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Legal"
        lead="The terms, how we handle your data, and how to reach us about a pack."
      />
      <ContentIndex items={ITEMS} />
    </div>
  );
}
