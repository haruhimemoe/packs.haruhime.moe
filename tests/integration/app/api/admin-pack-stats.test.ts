/**
 * @file tests/integration/app/api/admin-pack-stats.test.ts
 * @desc POST /api/admin/pack-stats: the same 404 for everyone but admins (and no work done),
 *       refused from another site, and for an admin one batch of the stats job with what it
 *       updated and what's left. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/pack-stats/route";
import { CROSS_SITE_REFUSED } from "@/lib/api";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";
import { beatmapRow, onMirror, setupStatsLookups } from "../../../helpers/stats-lookups";

const ADMIN_OSU_ID = 12231334;
vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
setupTestDb();
const lookups = setupStatsLookups();

const run = (cookie?: string, headers: Record<string, string> = {}) =>
  POST(apiRequest("/api/admin/pack-stats", { method: "POST", cookie, headers }));

const setup = async () => {
  const admin = await createTestUser({ osuId: ADMIN_OSU_ID });
  const host = await createTestUser();
  onMirror(lookups, beatmapRow(101));
  for (const visibility of ["public", "private"] as const) {
    await createPack(host.id, {
      name: `Pack ${visibility}`,
      slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
      visibility,
    });
  }
  return { admin, host };
};

describe("POST /api/admin/pack-stats", () => {
  it("is a 404 for anonymous callers and non-admins, and does nothing", async () => {
    const { host } = await setup();
    for (const cookie of [undefined, host.cookie]) {
      const response = await run(cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "Not found." },
      });
    }
    expect(lookups.calls.mirror).toEqual([]);
  });

  it("refuses a request from another site", async () => {
    const { admin } = await setup();
    const response = await run(admin.cookie, { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { message: string } }).error.message).toBe(
      CROSS_SITE_REFUSED,
    );
    expect(lookups.calls.mirror).toEqual([]);
  });

  it("runs one batch for an admin and says what's left", async () => {
    const { admin } = await setup();
    const response = await run(admin.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ updated: 2, remaining: 0, waiting: 0 });
  });
});
