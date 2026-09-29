/**
 * @file tests/integration/app/p/og-png.test.ts
 * @desc GET /p/[slug]/og.png: a public pack gets its card as a 1200×630 PNG with a long CDN
 *       cache; unlisted, private, hidden and missing packs get a 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/p/[slug]/og.png/route";
import { getPackModel } from "@/models/Pack";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
setupStatsLookups();

const get = (slug: string) =>
  GET(new Request(`http://localhost/p/${slug}/og.png`), { params: Promise.resolve({ slug }) });

const save = async (visibility: "public" | "unlisted" | "private") => {
  const host = await createTestUser({ username: "Chiyo" });
  return createPack(host.id, {
    name: "SPC Finals",
    slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
    visibility,
  });
};

describe("GET /p/[slug]/og.png", () => {
  it("draws a public pack's card as a 1200×630 PNG", async () => {
    const pack = await save("public");
    const response = await get(pack.slug);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=604800");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(1, 4))).toBe("PNG");
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  });

  it.each(["unlisted", "private"] as const)("answers 404 for a %s pack", async (visibility) => {
    const pack = await save(visibility);
    expect((await get(pack.slug)).status).toBe(404);
  });

  it("answers 404 for a hidden pack and a missing one", async () => {
    const pack = await save("public");
    const Pack = getPackModel();
    await Pack.updateOne({ slug: pack.slug }, { $set: { hiddenAt: new Date() } });
    expect((await get(pack.slug)).status).toBe(404);
    expect((await get("nothing-here")).status).toBe(404);
  });
});
