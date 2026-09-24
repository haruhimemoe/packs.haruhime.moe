/**
 * @file tests/integration/app/packs-index.test.ts
 * @desc GET /packs/index.json serves the public search index.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/packs/index.json/route";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("GET /packs/index.json", () => {
  it("returns public packs in the index shape", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    const pack = await createPack(host.id, {
      name: "Cup",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      visibility: "public",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      v: 1,
      packs: [{ s: pack.slug, n: "Cup", o: "Chiyo", c: 1, d: "", u: pack.updatedAt }],
    });
  });
});
