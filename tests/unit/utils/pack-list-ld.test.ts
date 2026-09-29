/**
 * @file tests/unit/utils/pack-list-ld.test.ts
 * @desc packListLd: a CollectionPage with the page's packs as an ItemList, and breadcrumbs that
 *       add the page number past page 1.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { packListLd } from "@/utils/pack-list-ld";

const PACKS = [
  { slug: "aaaaaaaaaa", name: "SPC Finals" },
  { slug: "bbbbbbbbbb", name: "OWC Quals" },
];

describe("packListLd", () => {
  it("lists the page's packs in order under a CollectionPage", () => {
    const [page, crumbs] = packListLd(PACKS, "/packs", 1)["@graph"] as Record<string, unknown>[];
    expect(page).toMatchObject({
      "@type": "CollectionPage",
      url: "https://packs.haruhime.moe/packs",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: 2,
        itemListElement: [
          { position: 1, name: "SPC Finals", url: "https://packs.haruhime.moe/p/aaaaaaaaaa" },
          { position: 2, name: "OWC Quals", url: "https://packs.haruhime.moe/p/bbbbbbbbbb" },
        ],
      },
    });
    expect((crumbs as { itemListElement: unknown[] }).itemListElement).toHaveLength(2);
  });

  it("names later pages and adds them to the breadcrumbs", () => {
    const [page, crumbs] = packListLd(PACKS, "/packs/page/3", 3)["@graph"] as {
      name?: string;
      itemListElement?: { name: string; item: string }[];
    }[];
    expect(page?.name).toBe("Public osu! mappool packs, page 3");
    expect(crumbs?.itemListElement?.at(-1)).toMatchObject({
      name: "Page 3",
      item: "https://packs.haruhime.moe/packs/page/3",
    });
  });
});
