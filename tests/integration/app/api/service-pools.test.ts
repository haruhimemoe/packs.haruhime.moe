/**
 * @file tests/integration/app/api/service-pools.test.ts
 * @desc PUT /api/service/pools/{ref}: the token (not set up, wrong; no cross-site guard, since it
 *       reads no cookies), the ref and the strict body (unknown keys and content-filter failures
 *       400, wrong type 415, oversized 413, private 422), created / updated / unchanged answers
 *       (an unchanged pool sent in another form writes nothing), a moderator's hide surviving a
 *       sync with listed false, a deleted pool's tombstone (410), two syncs racing, revalidation,
 *       the pools-sync share for after-save stats, and the pool id never leaving the server (API,
 *       page data, index, the owner's packs, sitemap). The mirror and osu! are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/service/pools/[ref]/route";
import { GET as API_ONE } from "@/app/api/v1/packs/[slug]/route";
import { GET as API_LIST } from "@/app/api/v1/packs/route";
import sitemap from "@/app/sitemap";
import { DELETED_ORIGINS_COLLECTION, POOLS_ACCOUNT } from "@/constants/pools";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import { adminDeletePack, setPackHidden } from "@/services/moderation";
import { getPackForViewer, listSavedPacks } from "@/services/packs";
import { buildSearchIndex } from "@/services/public-packs";
import { flushAfter } from "../../../helpers/after";
import { bearer, createTestApiKey } from "../../../helpers/api-key";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, noContext, slugContext } from "../../../helpers/requests";
import { beatmapRow, onMirror, setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
const lookups = setupStatsLookups();

const TOKEN = "pools-service-token-for-tests-0123456789";
const REF = "otdb-58";
const BODY = {
  name: "Ricma 2 Quarterfinals",
  description:
    "Ricma 2 Quarterfinals. Pool details and sources: https://pools.haruhime.moe/pools/otdb-58",
  visibility: "public",
  slots: [
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "DT", index: 1, beatmapId: 102 },
  ],
};

type Answer = { slug: string; state: string; listed: boolean };
type PutOptions = {
  ref?: string;
  token?: string | null;
  contentType?: string;
  headers?: Record<string, string>;
};

const put = (
  body: unknown,
  { ref = REF, token = TOKEN, contentType, headers = {} }: PutOptions = {},
) =>
  PUT(
    apiRequest(`/api/service/pools/${ref}`, {
      method: "PUT",
      body,
      ...(contentType ? { contentType } : {}),
      headers: {
        "x-real-ip": "203.0.113.7",
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        ...headers,
      },
    }),
    { params: Promise.resolve({ ref }) },
  );

const answer = async (response: Response): Promise<Answer> => (await response.json()) as Answer;
const errorOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string; message: string } }).error;
const packCount = () => getPackModel().countDocuments({});

beforeEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
  vi.mocked(revalidatePath).mockClear();
});
afterEach(() => vi.stubEnv("POOLS_SERVICE_TOKEN", ""));

describe("PUT /api/service/pools/{ref}: the token", () => {
  it("refuses everything while POOLS_SERVICE_TOKEN isn't set, and writes nothing", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    const response = await put(BODY);
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe("not_configured");
    expect(await packCount()).toBe(0);
    expect(await getDb().collection("user").countDocuments({})).toBe(0);
  });

  it("answers 401 to a wrong token, and writes nothing", async () => {
    expect((await put(BODY, { token: "not-the-pools-token-at-all-000000000" })).status).toBe(401);
    expect((await put(BODY, { token: null })).status).toBe(401);
    expect(await packCount()).toBe(0);
  });

  it("reads no cookies, so a cross-site request with the token still works", async () => {
    const response = await put(BODY, {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(201);
  });
});

describe("PUT /api/service/pools/{ref}: the ref and the body", () => {
  it.each(["OTDB-58", "otdb_58", "a".repeat(65)])("answers 400 to the ref %j", async (ref) => {
    expect((await put(BODY, { ref })).status).toBe(400);
    expect(await packCount()).toBe(0);
  });

  it.each([
    ["an unknown key", { ...BODY, year: 2023 }, "year"],
    ["no visibility", { name: BODY.name, slots: BODY.slots }, "visibility"],
    ["a slur in the name", { ...BODY, name: "f4gg0t pool" }, "free of slurs"],
    ["no maps", { ...BODY, slots: [] }, "at least one map"],
  ])("answers 400 to a body with %s, naming the problem", async (_label, body, message) => {
    const response = await put(body);
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("bad_request");
    expect(error.message).toContain(message);
    expect(await packCount()).toBe(0);
  });

  it("answers 415 to a body that isn't JSON and 413 to one over 16 KB", async () => {
    expect((await put(JSON.stringify(BODY), { contentType: "text/plain" })).status).toBe(415);
    expect((await put({ ...BODY, description: "x".repeat(20_000) })).status).toBe(413);
    expect(await packCount()).toBe(0);
  });

  it("answers 422 to a private pack, and writes nothing", async () => {
    const response = await put({ ...BODY, visibility: "private" });
    expect(response.status).toBe(422);
    expect((await errorOf(response)).code).toBe("unprocessable");
    expect(await packCount()).toBe(0);
  });
});

describe("PUT /api/service/pools/{ref}: answers", () => {
  it("creates the pack, owned by the pools account (created on first use), listed", async () => {
    const response = await put(BODY);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const created = await answer(response);
    expect(created).toEqual({
      slug: expect.stringMatching(/^[A-Za-z0-9_-]{10}$/),
      state: "created",
      listed: true,
    });
    const doc = await getPackModel().findOne({ slug: created.slug }).lean();
    expect(doc?.ownerId.toString()).toBe(POOLS_ACCOUNT.id);
    expect(doc).toMatchObject({
      name: BODY.name,
      description: BODY.description,
      visibility: "public",
      origin: { kind: "pools", id: REF },
    });
    expect(await getDb().collection("user").countDocuments({ email: POOLS_ACCOUNT.email })).toBe(1);
  });

  it("says an unlisted pack isn't listed", async () => {
    expect(await answer(await put({ ...BODY, visibility: "unlisted" }))).toMatchObject({
      state: "created",
      listed: false,
    });
  });

  it("answers unchanged for the same input, and writes nothing", async () => {
    const { slug } = await answer(await put(BODY));
    const before = await getPackModel().findOne({ slug }).lean();
    vi.mocked(revalidatePath).mockClear();
    const response = await put(BODY);
    expect(response.status).toBe(200);
    expect(await answer(response)).toEqual({ slug, state: "unchanged", listed: true });
    expect((await getPackModel().findOne({ slug }).lean())?.updatedAt).toEqual(before?.updatedAt);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers unchanged for the same pool sent in another form, and writes nothing", async () => {
    const first = {
      ...BODY,
      description: "Ricma 2 Quarterfinals\nPool details: https://pools.haruhime.moe/pools/otdb-58",
    };
    const { slug } = await answer(await put(first));
    const before = await getPackModel().findOne({ slug }).lean();
    vi.mocked(revalidatePath).mockClear();
    const response = await put({
      ...first,
      description: `${first.description.replace("\n", "\r\n")}  \n`,
      slots: [...first.slots].reverse(),
      buckets: ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({ code })),
    });
    expect(await answer(response)).toEqual({ slug, state: "unchanged", listed: true });
    expect((await getPackModel().findOne({ slug }).lean())?.updatedAt).toEqual(before?.updatedAt);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updates the same pack when the name, description, visibility or maps change", async () => {
    const { slug } = await answer(await put(BODY));
    for (const change of [
      { name: "Ricma 2 Semifinals" },
      { description: "Other text" },
      { visibility: "unlisted" },
      { slots: [{ mod: "NM", index: 1, beatmapId: 101 }] },
    ]) {
      const response = await put({ ...BODY, ...change });
      expect(response.status).toBe(200);
      expect(await answer(response)).toMatchObject({ slug, state: "updated" });
    }
    expect(await packCount()).toBe(1);
    expect((await getPackModel().findOne({ slug }).lean())?.slots).toHaveLength(1);
  });

  it("keeps a moderator's hide whatever pools sends, and says the pack isn't listed", async () => {
    const { slug } = await answer(await put(BODY));
    await setPackHidden(slug, new ObjectId().toHexString(), true);
    expect(await answer(await put(BODY))).toEqual({ slug, state: "unchanged", listed: false });
    expect(await answer(await put({ ...BODY, name: "Renamed" }))).toEqual({
      slug,
      state: "updated",
      listed: false,
    });
    expect((await getPackModel().findOne({ slug }).lean())?.hiddenAt).toBeInstanceOf(Date);
    expect((await buildSearchIndex()).packs.map((entry) => entry.s)).not.toContain(slug);
  });

  it("answers 410 for a pool whose pack a moderator deleted, and never creates it again", async () => {
    const { slug } = await answer(await put(BODY));
    expect(await adminDeletePack(slug)).toBe(true);
    const response = await put(BODY);
    expect(response.status).toBe(410);
    expect((await errorOf(response)).code).toBe("gone");
    expect(await packCount()).toBe(0);
    // Typed: an untyped collection's _id filter only takes an ObjectId.
    const tombstones = getDb().collection<{ _id: string }>(DELETED_ORIGINS_COLLECTION);
    expect(await tombstones.countDocuments({ _id: REF })).toBe(1);
  });

  it("makes one pack when two syncs of a new pool race", async () => {
    const [first, second] = await Promise.all([put(BODY), put(BODY)]);
    const states = [(await answer(first)).state, (await answer(second)).state].sort();
    expect(states).toEqual(["created", "unchanged"]);
    expect(await getPackModel().countDocuments({ "origin.id": REF })).toBe(1);
  });

  it("marks /packs, the index, the homepage, the sitemap and the pack page stale on a write", async () => {
    const { slug } = await answer(await put(BODY));
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
    for (const path of ["/packs/index.json", "/", "/sitemap.xml", `/p/${slug}`]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("works out stats after the save on the pools-sync share, never the caller's IP", async () => {
    onMirror(lookups, beatmapRow(101), beatmapRow(102));
    lookups.ratings.set("102:DT", 7.25);
    const { slug } = await answer(await put(BODY));
    await flushAfter();
    expect((await getPackModel().findOne({ slug }).lean())?.stats?.complete).toBe(true);
    const counters = (await getDb().collection(RATE_LIMITS_COLLECTION).find({}).toArray()).map(
      (doc) => String(doc._id),
    );
    expect(counters.some((id) => id.startsWith("osu-api-ip:pools-sync:"))).toBe(true);
    expect(counters.some((id) => id.includes("203.0.113.7"))).toBe(false);
  });

  it("never lets the pool id out: API, page data, index, the owner's packs, sitemap", async () => {
    const ref = "leak-check-1";
    const { slug } = await answer(await put(BODY, { ref }));
    const reader = await createTestUser();
    const key = await createTestApiKey(reader.id);
    const one = await API_ONE(
      apiRequest(`/api/v1/packs/${slug}`, { headers: bearer(key) }),
      slugContext(slug),
    );
    const list = await API_LIST(apiRequest("/api/v1/packs", { headers: bearer(key) }), noContext);
    const surfaces = [
      await one.text(),
      await list.text(),
      JSON.stringify(await getPackForViewer(slug, null)),
      JSON.stringify(await buildSearchIndex()),
      JSON.stringify(await listSavedPacks(POOLS_ACCOUNT.id)),
      JSON.stringify(await sitemap()),
    ];
    for (const surface of surfaces) {
      expect(surface).toContain(slug);
      expect(surface).not.toContain(ref);
      expect(surface).not.toContain('"origin"');
    }
  });
});
