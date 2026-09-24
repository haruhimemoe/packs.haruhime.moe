/**
 * @file tests/integration/app/api/cron-pack-stats.test.ts
 * @desc GET /api/cron/pack-stats: fails closed without CRON_SECRET or with a short one (503,
 *       and the rest of the server env still parses), refuses a missing or
 *       wrong Bearer secret (401) without doing any work, and with the right one runs one capped
 *       batch of the stats job and says what's left. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/pack-stats/route";
import { PACK_STATS_JOB_LIMIT } from "@/constants/pack-stats";
import { parseServerEnv } from "@/env";
import { getPackModel } from "@/models/Pack";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";
import { beatmapRow, onMirror, setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const SECRET = "cron-secret-for-tests-0123456789";

const cron = (authorization?: string) =>
  GET(
    apiRequest("/api/cron/pack-stats", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

const makePacks = async (count: number) => {
  const owner = await createTestUser();
  for (let i = 0; i < count; i++) {
    await createPack(owner.id, {
      name: `Pack ${i}`,
      slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
      visibility: "public",
    });
  }
};

describe("GET /api/cron/pack-stats", () => {
  beforeEach(() => {
    onMirror(lookups, beatmapRow(101));
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => vi.stubEnv("CRON_SECRET", ""));

  it("refuses everything while CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await makePacks(1);
    const response = await cron("Bearer ");
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "not_configured",
    );
    expect(lookups.calls.mirror).toEqual([]);
  });

  it("refuses everything, and leaves the rest of the server env alone, when CRON_SECRET is too short", async () => {
    vi.stubEnv("CRON_SECRET", "short-secret");
    await makePacks(1);
    const response = await cron("Bearer short-secret");
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "not_configured",
    );
    expect(lookups.calls.mirror).toEqual([]);
    expect(() => parseServerEnv(process.env)).not.toThrow();
  });

  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer not-the-cron-secret-at-all"],
    ["the secret without Bearer", SECRET],
    ["a longer secret", `Bearer ${SECRET}x`],
    ["an empty secret", "Bearer "],
  ])("answers 401 to %s and does nothing", async (_label, authorization) => {
    await makePacks(1);
    const response = await cron(authorization);
    expect(response.status).toBe(401);
    expect(await getPackModel().countDocuments({ stats: { $ne: null } })).toBe(0);
    expect(lookups.calls.mirror).toEqual([]);
  });

  it(`runs one batch of ${PACK_STATS_JOB_LIMIT} packs and says how many are left`, async () => {
    await makePacks(PACK_STATS_JOB_LIMIT + 2);

    const response = await cron(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ updated: PACK_STATS_JOB_LIMIT, remaining: 2 });
    expect(await getPackModel().countDocuments({ "stats.complete": true })).toBe(
      PACK_STATS_JOB_LIMIT,
    );
  });
});
