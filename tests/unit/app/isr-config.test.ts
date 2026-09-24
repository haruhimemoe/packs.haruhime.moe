/**
 * @file tests/unit/app/isr-config.test.ts
 * @desc Cached pages regenerate once a day as a safety net; pack writes revalidate them on demand.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/public-packs", () => ({
  listPublicPacks: vi.fn(),
  buildSearchIndex: vi.fn(),
}));

const DAY = 86_400;

describe("ISR safety net", () => {
  it.each([
    ["/", () => import("@/app/(public)/page")],
    ["/packs", () => import("@/app/(public)/packs/page")],
    ["/packs/page/[n]", () => import("@/app/(public)/packs/page/[n]/page")],
    ["/packs/index.json", () => import("@/app/(public)/packs/index.json/route")],
    ["/sitemap.xml", () => import("@/app/sitemap")],
  ])("%s regenerates at most once a day", async (_route, load) => {
    expect((await load()).revalidate).toBe(DAY);
  });
});
