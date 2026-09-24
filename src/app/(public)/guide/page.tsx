/**
 * @file src/app/(public)/guide/page.tsx
 * @desc /guide: every guide, with its description and last update. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { formatIsoDate } from "@/utils/date";

export const metadata: Metadata = {
  title: "Guides",
  description: "How to make an osu! mappool pack, share it, and what a pack key contains.",
  alternates: { canonical: "/guide" },
};

export default function GuideIndexPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Guides" lead="Short how-tos for building and sharing packs." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {GUIDE_SLUGS.map((slug) => {
          const doc = GUIDE_DOCS[slug];
          return (
            <li key={slug}>
              <Card className="h-full">
                <h2 className="font-bold text-c1 text-lg">
                  <Link href={`/guide/${slug}`} className="transition-colors hover:text-h1">
                    {doc.title}
                  </Link>
                </h2>
                <p className="mt-2 text-c3 text-sm">{doc.description}</p>
                <p className="mt-3 text-c4 text-xs">Updated {formatIsoDate(doc.lastUpdated)}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
