/**
 * @file tests/unit/utils/pack-metadata.test.ts
 * @desc /p/[slug] metadata: public visible packs are indexed with a "map pack download" title,
 *       canonical, og:url and the preview image; others are noindex. The description drops
 *       linked sentences, ends with the saved stats, and stays within 160 characters. JSON-LD is
 *       a CreativeWork (isBasedOn the linked pools page) with breadcrumbs, for public packs only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import type { SavedPack } from "@/schemas/saved-pack";
import { packDescription, packFacts, packLd, packMetadata } from "@/utils/pack-metadata";

const PACK: SavedPack = {
  name: "SPC Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "HD", index: 1, beatmapId: 2 },
  ],
  slug: "abcdefghij",
  visibility: "public",
  description: "Grand finals pool.",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-23T00:00:00.000Z",
};

const STATS = {
  srMin: 5.2,
  srMax: 6.41,
  srAvg: 5.8,
  lenMin: 90,
  lenMax: 200,
  bpmMin: 150,
  bpmMax: 220,
  mods: ["NM", "HD"],
  modes: ["osu"],
  count: 2,
  complete: true,
  computedAt: "2026-09-23T00:00:00.000Z",
} as const satisfies SavedPack["stats"];

describe("packMetadata", () => {
  it("indexes a public pack with a download title, canonical, og:url and preview image", () => {
    const meta = packMetadata(PACK);
    expect(meta.title).toEqual({ absolute: "SPC Finals map pack download · packs.haruhime.moe" });
    expect(meta.alternates).toEqual({ canonical: "https://packs.haruhime.moe/p/abcdefghij" });
    expect(meta.openGraph).toMatchObject({
      url: "https://packs.haruhime.moe/p/abcdefghij",
      images: [expect.objectContaining({ url: "/opengraph-image.png", width: 1200 })],
    });
    expect(meta.robots).toBeUndefined();
  });

  it.each([
    ["unlisted", { visibility: "unlisted" }],
    ["private", { visibility: "private" }],
    ["hidden", { hiddenAt: "2026-09-22T12:00:00.000Z" }],
  ] as const)("keeps a %s pack out of search", (_label, change) => {
    const meta = packMetadata({ ...PACK, ...change });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.title).toEqual({ absolute: "SPC Finals · packs.haruhime.moe" });
  });
});

describe("packDescription", () => {
  it("adds the map count, star range and mods to the host's text", () => {
    expect(packDescription({ ...PACK, stats: STATS })).toBe(
      "Grand finals pool. 2 maps, 5.20–6.41★, NM HD. Download as one zip or a torrent, or add it to an osu! collection.",
    );
  });

  it("drops sentences with links, like the pools account's source line", () => {
    const description =
      "Enigmatic Summer Solstice Group Stage (Tier 2). Pool details and sources: https://pools.haruhime.moe/pools/otdb-99";
    const text = packDescription({ ...PACK, description });
    expect(text).toMatch(/^Enigmatic Summer Solstice Group Stage \(Tier 2\)\. 2 maps\./);
    expect(text).not.toMatch(/https?:|sources/);
  });

  it("says only the count without stats or a description", () => {
    expect(packFacts({ ...PACK, description: "" })).toBe(
      "2 maps. Download as one zip or a torrent, or add it to an osu! collection.",
    );
    expect(packDescription({ ...PACK, description: undefined })).toBe(packFacts(PACK));
  });

  it("cuts a long description and keeps the facts, within 160 characters", () => {
    const text = packDescription({ ...PACK, description: "word ".repeat(100), stats: STATS });
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith("osu! collection.")).toBe(true);
  });
});

describe("packLd", () => {
  it("describes a public pack as a CreativeWork based on its pools page, with breadcrumbs", () => {
    const description = "Quals. Sources: https://pools.haruhime.moe/pools/otdb-99";
    const data = packLd({ ...PACK, description }) as { "@graph": Record<string, unknown>[] };
    const [work, crumbs] = data["@graph"];
    expect(work).toMatchObject({
      "@type": "CreativeWork",
      name: "SPC Finals",
      url: "https://packs.haruhime.moe/p/abcdefghij",
      numberOfItems: 2,
      dateModified: "2026-09-23T00:00:00.000Z",
      isBasedOn: "https://pools.haruhime.moe/pools/otdb-99",
    });
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" });
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("has no isBasedOn without a pools link, and nothing for a pack kept out of search", () => {
    const data = packLd(PACK) as { "@graph": Record<string, unknown>[] };
    expect(data["@graph"][0]).not.toHaveProperty("isBasedOn");
    expect(packLd({ ...PACK, visibility: "unlisted" })).toBeNull();
  });
});
