/**
 * @file src/app/(public)/legal/layout.tsx
 * @desc The legal section's frame: its nav (the index, then every registered page) beside
 *       the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 11, 2026
 */

import { ContentLayout, ContentNav } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CONTENT } from "@/constants/content";
import { toNavItem } from "@/utils/content-nav";

const GROUPS = [{ items: CONTENT.entries.legal.map(toNavItem("legal")) }];

/**
 * @function LegalLayout
 * @param props {{ children: ReactNode }} the page
 * @returns {JSX.Element} the section nav beside the page
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("packs.pages.publicLegalLayout");
  return (
    <ContentLayout nav={<ContentNav label={t("legal")} indexHref="/legal" groups={GROUPS} />}>
      {children}
    </ContentLayout>
  );
}
