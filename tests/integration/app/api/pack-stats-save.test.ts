/**
 * @file tests/integration/app/api/pack-stats-save.test.ts
 * @desc Saving a pack schedules its stats after the response, on the site and the API: the save
 *       answers first (without stats), the stats land once the after() work runs, and a save
 *       still succeeds when every lookup fails. A slot change clears old stats; a rename keeps
 *       complete ones and schedules nothing. osu! calls count against the saver's IP share.
 *       The mirror and osu! are MSW; after() work is queued (tests/helpers/after.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { PUT } from "@/app/api/packs/[slug]/route";
import { POST } from "@/app/api/packs/route";
import { GET as V1_GET, PUT as V1_PUT } from "@/app/api/v1/packs/[slug]/route";
import { POST as V1_POST } from "@/app/api/v1/packs/route";
import { OSU_API_BUDGET_PER_IP, RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { SavedPack } from "@/schemas/saved-pack";
import { flushAfter, pendingAfter } from "../../../helpers/after";
import { bearer, createTestApiKey } from "../../../helpers/api-key";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";
import { beatmapRow, onMirror, setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const PACK = {
  name: "SPC Finals",
  visibility: "public",
  slots: [
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "HR", index: 1, beatmapId: 102 },
  ],
};

const known = () => {
  onMirror(
    lookups,
    beatmapRow(101, { difficulty_rating: 4 }),
    beatmapRow(102, { difficulty_rating: 5 }),
    beatmapRow(103, { difficulty_rating: 6, mode: "mania" }),
  );
  lookups.ratings.set("102:HR", 5.5);
};

const save = async (cookie: string, body: unknown = PACK, ip = "203.0.113.7") => {
  const response = await POST(
    apiRequest("/api/packs", { method: "POST", body, cookie, headers: { "x-real-ip": ip } }),
  );
  return { response, pack: ((await response.json()) as { pack: SavedPack }).pack };
};

const edit = async (slug: string, cookie: string, body: unknown) => {
  const response = await PUT(
    apiRequest(`/api/packs/${slug}`, { method: "PUT", body, cookie }),
    slugContext(slug),
  );
  return { response, pack: ((await response.json()) as { pack: SavedPack }).pack };
};

const statsOf = async (slug: string) =>
  (await getPackModel().findOne({ slug }).lean())?.stats ?? null;

describe("saving on the site", () => {
  it("answers first, then stores the stats once the after() work runs", async () => {
    known();
    const user = await createTestUser();
    const { response, pack } = await save(user.cookie);

    expect(response.status).toBe(201);
    expect(pack.stats).toBeUndefined();
    expect(pendingAfter()).toBe(1);
    expect(lookups.calls.mirror).toEqual([]);

    await flushAfter();
    expect(await statsOf(pack.slug)).toMatchObject({
      srMin: 4,
      srMax: 5.5,
      mods: ["NM", "HR"],
      count: 2,
      complete: true,
    });
  });

  it("still saves when the mirror and osu! are down, with incomplete stats", async () => {
    lookups.mirrorDown = true;
    lookups.osuDown = true;
    const user = await createTestUser();
    const { response, pack } = await save(user.cookie);
    expect(response.status).toBe(201);

    await flushAfter();
    expect(await statsOf(pack.slug)).toMatchObject({
      srMin: null,
      mods: ["NM", "HR"],
      complete: false,
    });
  });

  it("spends the saver's share of the osu! budget", async () => {
    // Only osu! knows these maps, so the lookup has to ask it.
    lookups.osu.set(101, beatmapRow(101));
    lookups.osu.set(102, beatmapRow(102));
    lookups.ratings.set("102:HR", 5.5);
    const user = await createTestUser();
    await save(user.cookie, PACK, "198.51.100.4");
    await flushAfter();

    const shares = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .find({ _id: { $regex: `^${OSU_API_BUDGET_PER_IP.scope}:198\\.51\\.100\\.4:` } })
      .toArray();
    // One metadata call and one rating.
    expect(shares.map((doc) => doc.count)).toEqual([2]);
  });

  it("clears old stats when the slots change, then computes new ones", async () => {
    known();
    const user = await createTestUser();
    const { pack } = await save(user.cookie);
    await flushAfter();

    const changed = { ...PACK, slots: [{ mod: "NM", index: 1, beatmapId: 103 }] };
    const { response, pack: edited } = await edit(pack.slug, user.cookie, changed);
    expect(response.status).toBe(200);
    expect(edited.stats).toBeUndefined();
    expect(await statsOf(pack.slug)).toBeNull();

    await flushAfter();
    expect(await statsOf(pack.slug)).toMatchObject({ srMin: 6, modes: ["mania"], mods: ["NM"] });
  });

  it("keeps complete stats through a rename and schedules nothing", async () => {
    known();
    const user = await createTestUser();
    const { pack } = await save(user.cookie);
    await flushAfter();

    const { pack: renamed } = await edit(pack.slug, user.cookie, { ...PACK, name: "Renamed" });
    expect(renamed.stats).toMatchObject({ srMin: 4, complete: true });
    expect(pendingAfter()).toBe(0);
  });

  it("retries incomplete stats on the next save, even without a slot change", async () => {
    // Both down: no map could be checked (a map osu! says is gone wouldn't count as missing).
    lookups.mirrorDown = true;
    lookups.osuDown = true;
    const user = await createTestUser();
    const { pack } = await save(user.cookie);
    await flushAfter();
    expect((await statsOf(pack.slug))?.complete).toBe(false);

    lookups.mirrorDown = false;
    lookups.osuDown = false;
    known();
    const { pack: renamed } = await edit(pack.slug, user.cookie, { ...PACK, name: "Renamed" });
    expect(renamed.stats?.complete).toBe(false);
    await flushAfter();
    expect((await statsOf(pack.slug))?.complete).toBe(true);
  });
});

describe("saving through the API", () => {
  it("computes stats after POST and PUT, and GET returns them", async () => {
    known();
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const created = await V1_POST(
      apiRequest("/api/v1/packs", { method: "POST", body: PACK, headers: bearer(key) }),
      { params: Promise.resolve({}) },
    );
    expect(created.status).toBe(201);
    const { pack } = (await created.json()) as { pack: SavedPack };
    await flushAfter();

    const read = await V1_GET(
      apiRequest(`/api/v1/packs/${pack.slug}`, { headers: bearer(key) }),
      slugContext(pack.slug),
    );
    expect(((await read.json()) as { pack: SavedPack }).pack.stats).toMatchObject({
      srMin: 4,
      srMax: 5.5,
      srAvg: 4.75,
      complete: true,
    });

    const changed = { ...PACK, slots: [{ mod: "NM", index: 1, beatmapId: 103 }] };
    const updated = await V1_PUT(
      apiRequest(`/api/v1/packs/${pack.slug}`, {
        method: "PUT",
        body: changed,
        headers: bearer(key),
      }),
      slugContext(pack.slug),
    );
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as { pack: SavedPack }).pack.stats).toBeUndefined();
    await flushAfter();
    expect(await statsOf(pack.slug)).toMatchObject({ srMin: 6, modes: ["mania"] });
  });
});
