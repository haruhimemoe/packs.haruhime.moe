/**
 * @file src/app/(public)/brand/page.tsx
 * @desc /brand: what packs is, how to write the name, logos to download, colors, type, usage.
 *       Static. Also the site's Organization structured data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { JsonLd } from "@/components/ui/JsonLd";
import { PageHeader } from "@/components/ui/PageHeader";
import { BRAND_ASSETS, BRAND_COLORS } from "@/constants/brand";
import { SITE } from "@/constants/site";
import { cn } from "@/utils/cn";

export const metadata: Metadata = {
  title: "Brand",
  description: "The packs name, logos, colors, and type, for tournament staff, wikis, and press.",
  alternates: { canonical: "/brand" },
};

export default function BrandPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Brand"
        lead="packs builds one download from an osu! tournament mappool. It's run by haruhime.moe. For anything not covered here, write to us."
        meta={
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="underline underline-offset-2 hover:text-c1"
          >
            {SITE.contactEmail}
          </a>
        }
      />
      <Card title="Name">
        <p className="text-sm">
          The name is written “packs” in lower case. Use “packs.haruhime.moe” when the address
          matters. Please don't write “Packs” or “osu! packs” as the name.
        </p>
      </Card>
      <Card title="Logo">
        <ul className="grid gap-4 sm:grid-cols-3">
          {BRAND_ASSETS.map((asset) => (
            <li key={asset.href} className="flex flex-col gap-2">
              <div
                className={cn(
                  "flex h-28 items-center justify-center rounded-[10px] p-4",
                  asset.background === "dark" ? "bg-b6" : "bg-white",
                )}
              >
                {/* biome-ignore lint/performance/noImgElement: static SVG preview, no optimization needed */}
                <img src={`/${asset.href}`} alt="" className="max-h-16 w-auto" />
              </div>
              <a
                href={`/${asset.href}`}
                download
                className="font-bold text-h1 text-sm hover:text-c1"
              >
                Download {asset.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-c3 text-sm">
          Use the logos as they are: don't recolor or stretch them, and don't pair them with the
          osu! logo in a way that suggests ppy is involved.
        </p>
      </Card>
      <Card title="Colors">
        <ul className="grid gap-3 sm:grid-cols-3">
          {BRAND_COLORS.map((color) => (
            <li key={color.token} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-10 shrink-0 rounded-md border border-b3"
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-sm">
                <span className="block font-bold text-c1">{color.name}</span>
                <span className="text-c4">{color.hex}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Type">
        <p className="text-sm">
          Nunito (Google Fonts, SIL Open Font License) in regular, bold, and extra bold.
        </p>
      </Card>
      <Card title="osu!">
        <p className="text-sm">{SITE.trademarkNotice}</p>
      </Card>
      <JsonLd
        data={{
          "@type": "Organization",
          name: SITE.name,
          url: SITE.url,
          logo: `${SITE.url}/brand/packs-icon.svg`,
          email: SITE.contactEmail,
        }}
      />
    </div>
  );
}
