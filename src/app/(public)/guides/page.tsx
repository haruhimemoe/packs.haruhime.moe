/**
 * @file src/app/(public)/guides/page.tsx
 * @desc /guides: every guides page with its description, from the registry. Static.
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
  path: "/guides",
  title: "osu! mappool pack guides",
  description:
    "How to make an osu! mappool pack, add it to your osu! collections, download or seed it as a torrent, and what a pack key holds. Short guides, one task each.",
});

const ITEMS = CONTENT.entries.guides.map(toNavItem("guides"));

/**
 * @function GuidesIndexPage
 * @returns {JSX.Element} the section's header and its pages
 */
export default function GuidesIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Guides" lead="Short how-tos for building and sharing packs." />
      <ContentIndex items={ITEMS} />
    </div>
  );
}
