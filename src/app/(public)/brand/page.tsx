/**
 * @file src/app/(public)/brand/page.tsx
 * @desc /brand: the packs name, how to write it, logo files, colors, type, do's and don'ts and
 *       the contact, from @haruhimemoe/brand's brandPageData rendered by @haruhimemoe/ui's
 *       BrandPage (files in public/brand come from `haruhime-brand packs`). Static. Also the
 *       site's Organization structured data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { brandPageData } from "@haruhimemoe/brand/products";
import { HARUHIME_ORG, ld, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { BrandPage, JsonLd, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/brand",
  title: "packs brand assets",
  description:
    "The packs name, logos, icon, colors and type, with the files to download, for tournament staff, wikis and press writing about packs.haruhime.moe.",
});

/**
 * @function BrandRoute
 * @returns {JSX.Element} the page header, the brand sections and the Organization JSON-LD
 */
export default function BrandRoute() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Brand" lead="The packs name, logos, colors and type." />
      <BrandPage {...brandPageData("packs")} />
      <JsonLd
        data={ld.graph(
          ld.organization(HARUHIME_ORG),
          ld.breadcrumbs(SEO_SITE, [
            { name: "packs", path: "/" },
            { name: "Brand", path: "/brand" },
          ]),
        )}
      />
    </div>
  );
}
