/**
 * @file src/app/(public)/new/page.tsx
 * @desc /new: the anonymous pack builder.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { PackBuilder } from "@/components/pack/PackBuilder";
import { SEO_SITE } from "@/constants/seo";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/new",
  title: "Make an osu! mappool pack",
  description:
    "Paste beatmap IDs, links or a whole mappool, sort the maps into NM, HD, HR, DT, FM and TB slots, and download the pool as one zip or a torrent. No account needed.",
});

/**
 * @function NewPackPage
 * @returns {JSX.Element} the page
 */
export default function NewPackPage() {
  const t = useTranslations("packs.pages.publicNew");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newPack")} lead={t("yourDraftSavesIn")} />
      <PackBuilder />
    </div>
  );
}
