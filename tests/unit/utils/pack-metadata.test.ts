/**
 * @file tests/unit/utils/pack-metadata.test.ts
 * @desc /p/[slug] metadata: only public, visible packs are indexed, canonical, and previewed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import type { SavedPack } from "@/schemas/saved-pack";
import { packMetadata } from "@/utils/pack-metadata";

const PACK: SavedPack = {
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
  slug: "abcdefghij",
  visibility: "public",
  description: "Grand finals pool",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

describe("packMetadata", () => {
  it("never sets openGraph, so the site preview image and per-page title/description flow through", () => {
    expect(packMetadata(PACK)).not.toHaveProperty("openGraph");
  });

  it("indexes and previews a public pack with a canonical URL", () => {
    expect(packMetadata(PACK)).toEqual({
      title: "SPC Finals",
      description: "Grand finals pool",
      alternates: { canonical: "/p/abcdefghij" },
      robots: { index: true },
    });
  });

  it.each([
    ["unlisted", { visibility: "unlisted" }],
    ["private", { visibility: "private" }],
    ["hidden", { hiddenAt: "2026-09-22T12:00:00.000Z" }],
  ] as const)("keeps a %s pack out of search", (_label, change) => {
    expect(packMetadata({ ...PACK, ...change })).toEqual({
      title: "SPC Finals",
      robots: { index: false },
    });
  });
});
