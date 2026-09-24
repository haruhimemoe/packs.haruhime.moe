/**
 * @file tests/integration/app/api/pack-exports.test.ts
 * @desc POST/DELETE /api/packs/{slug}/exports: owner-only magnet links (others 404, signed-out
 *       401), body and query validation, the 10-link cap, GET including the list, and links
 *       stored and shown only in canonical form.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { DELETE, POST } from "@/app/api/packs/[slug]/exports/route";
import { GET } from "@/app/api/packs/[slug]/route";
import { POST as CREATE } from "@/app/api/packs/route";
import { MAX_PACK_EXPORTS } from "@/constants/pack";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

setupTestDb();

const PACK = { name: "SPC Finals", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] };
const magnet = (n: number) => `magnet:?xt=urn:btih:${n.toString(16).padStart(40, "0")}&dn=SPC`;

const save = async (cookie: string, body: object = PACK): Promise<string> => {
  const response = await CREATE(apiRequest("/api/packs", { method: "POST", body, cookie }));
  return ((await response.json()) as { pack: { slug: string } }).pack.slug;
};

const KEY = encodePackKey(PACK);

/** Posts `body`, with the current pack key unless the body brings its own. */
const add = (slug: string, cookie: string | undefined, body: object) =>
  POST(
    apiRequest(`/api/packs/${slug}/exports`, {
      method: "POST",
      body: { packKey: KEY, ...body },
      cookie,
    }),
    slugContext(slug),
  );

const remove = (slug: string, cookie: string | undefined, url: string) =>
  DELETE(
    apiRequest(`/api/packs/${slug}/exports?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      cookie,
    }),
    slugContext(slug),
  );

describe("POST /api/packs/{slug}/exports", () => {
  it("adds a magnet link for the owner, and GET shows it to anyone", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const response = await add(slug, owner.cookie, { kind: "magnet", url: magnet(1) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ exports: [{ kind: "magnet", url: magnet(1) }] });
    const view = await GET(apiRequest(`/api/packs/${slug}`), slugContext(slug));
    expect(await view.json()).toMatchObject({ pack: { exports: [{ url: magnet(1) }] } });
  });

  it("stores the canonical link: a web seed, a peer, and a foreign tracker are dropped", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const url = `${magnet(1)}&tr=${encodeURIComponent("http://tracker.attacker.example/announce")}&ws=${encodeURIComponent("http://192.168.0.1/x")}&x.pe=${encodeURIComponent("10.0.0.5:22")}`;
    const response = await add(slug, owner.cookie, { kind: "magnet", url });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ exports: [{ url: magnet(1) }] });
    const view = await GET(apiRequest(`/api/packs/${slug}`), slugContext(slug));
    expect(await view.json()).toMatchObject({ pack: { exports: [{ url: magnet(1) }] } });
  });

  it("answers 401 signed out, 404 to someone else and for a private pack of someone else", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slug = await save(owner.cookie);
    const hidden = await save(owner.cookie, { ...PACK, visibility: "private" });
    const body = { kind: "magnet", url: magnet(1) };
    expect((await add(slug, undefined, body)).status).toBe(401);
    expect((await add(slug, other.cookie, body)).status).toBe(404);
    expect((await add(hidden, other.cookie, body)).status).toBe(404);
    expect((await add("nope", owner.cookie, body)).status).toBe(404);
  });

  it.each([
    { kind: "magnet", url: "javascript:alert(1)" },
    { kind: "gdrive", url: magnet(1) },
    { kind: "magnet", url: `${magnet(1)}&xt=urn:btih:${"b".repeat(40)}` },
    { kind: "magnet" },
  ])("answers 400 to %j", async (body) => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    expect((await add(slug, owner.cookie, body)).status).toBe(400);
  });

  it(`answers 409 past ${MAX_PACK_EXPORTS} links`, async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    // 11+ writes in a minute would hit the write limit first; this test is about the link cap.
    const resetWriteLimit = () => getDb().collection(RATE_LIMITS_COLLECTION).deleteMany({});
    for (let n = 1; n <= MAX_PACK_EXPORTS; n++) {
      await resetWriteLimit();
      await add(slug, owner.cookie, { kind: "magnet", url: magnet(n) });
    }
    await resetWriteLimit();
    const response = await add(slug, owner.cookie, { kind: "magnet", url: magnet(99) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "conflict", message: "A pack can list 10 magnet links. Remove one first." },
    });
  });
  it("answers 409 when the torrent was made from an older version of the pack", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const response = await add(slug, owner.cookie, {
      kind: "magnet",
      url: magnet(1),
      packKey: encodePackKey({ ...PACK, name: "Old name" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "conflict",
        message: "This pack changed after the torrent was made. Reload the page and make it again.",
      },
    });
  });

  it("answers 400 without a pack key", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    expect(
      (await add(slug, owner.cookie, { kind: "magnet", url: magnet(1), packKey: "" })).status,
    ).toBe(400);
  });
});

describe("DELETE /api/packs/{slug}/exports", () => {
  it("removes the owner's link", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    await add(slug, owner.cookie, { kind: "magnet", url: magnet(1) });
    const response = await remove(slug, owner.cookie, magnet(1));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exports: [] });
  });

  it("answers 401, 404, and 400 for a bad url", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slug = await save(owner.cookie);
    expect((await remove(slug, undefined, magnet(1))).status).toBe(401);
    expect((await remove(slug, other.cookie, magnet(1))).status).toBe(404);
    expect((await remove(slug, owner.cookie, "https://example.com")).status).toBe(400);
  });
});
