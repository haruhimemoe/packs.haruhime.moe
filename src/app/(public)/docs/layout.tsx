/**
 * @file src/app/(public)/docs/layout.tsx
 * @desc The docs section's frame: its nav (the index, then every registered page) beside
 *       the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { ContentLayout, ContentNav } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { CONTENT } from "@/constants/content";
import { toNavItem } from "@/utils/content-nav";

const GROUPS = [{ items: CONTENT.entries.docs.map(toNavItem("docs")) }];

/**
 * @function DocsLayout
 * @param props {{ children: ReactNode }} the page
 * @returns {JSX.Element} the section nav beside the page
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <ContentLayout nav={<ContentNav label="Docs" indexHref="/docs" groups={GROUPS} />}>
      {children}
    </ContentLayout>
  );
}
