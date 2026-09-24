/**
 * @file tests/integration/app/api/service-pools-stats.test.ts
 * @desc POST /api/service/pools/stats: the pools token (not set up, wrong), one backfill batch
 *       answering { updated, remaining } and never cached, and nothing done or created before
 *       pools has published a pack. The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/service/pools/stats/route";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import { createPack } from "@/services/packs";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";
import { beatmapRow, onMirror, setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const TOKEN = "pools-service-token-for-tests-0123456789";

const post = (authorization?: string) =>
  POST(
    apiRequest("/api/service/pools/stats", {
      method: "POST",
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

const poolPack = (name: string) => {
  const input: PackInput = {
    name,
    slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
    visibility: "public",
  };
  return createPack(POOLS_ACCOUNT.id, input, { unlimited: true });
};

beforeEach(() => vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN));
afterEach(() => vi.stubEnv("POOLS_SERVICE_TOKEN", ""));

describe("POST /api/service/pools/stats", () => {
  it("refuses a wrong token (401) or a server without one (503), and does nothing", async () => {
    await poolPack("Pool");
    expect((await post("Bearer wrong")).status).toBe(401);
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    expect((await post(`Bearer ${TOKEN}`)).status).toBe(503);
    expect(lookups.calls.mirror).toEqual([]);
  });

  it("runs one backfill batch and says what's left, never cached", async () => {
    onMirror(lookups, beatmapRow(101));
    await poolPack("Pool A");
    await poolPack("Pool B");

    const response = await post(`Bearer ${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ updated: 2, remaining: 0 });
    expect(await getPackModel().countDocuments({ "stats.complete": true })).toBe(2);
  });

  it("does nothing, and creates no account, before pools has published anything", async () => {
    const response = await post(`Bearer ${TOKEN}`);
    expect(await response.json()).toEqual({ updated: 0, remaining: 0 });
    expect(await getDb().collection("user").countDocuments({})).toBe(0);
    expect(lookups.calls.mirror).toEqual([]);
  });
});
