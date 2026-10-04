/**
 * @file src/app/(public)/docs/page.tsx
 * @desc /docs: every docs page with its description, from the registry. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentSearch, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { toNavItem } from "@/utils/content-nav";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/docs",
  title: "packs docs",
  description:
    "Developer docs for packs.haruhime.moe: the public API for reading packs and managing your own from scripts and bots.",
});

const ITEMS = CONTENT.entries.docs.map(toNavItem("docs"));

/**
 * @function DocsIndexPage
 * @returns {JSX.Element} the section's header and its pages
 */
export default function DocsIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Docs" lead="For developers: the packs API and how to use it." />
      <ContentSearch items={ITEMS} label="Search the docs" countNoun={["doc", "docs"]} />
    </div>
  );
}
