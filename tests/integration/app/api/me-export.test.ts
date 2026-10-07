/**
 * @file tests/integration/app/api/me-export.test.ts
 * @desc GET /api/me/export ("Download my data"): signed-in only, a no-store JSON attachment with
 *       the caller's profile (read from identity), packs and API key info; no sessions or osu!
 *       link (those are the haruhime.moe account's), no secrets and nothing of anyone else's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/me/export/route";
import { getIdentityDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { AccountExport } from "@/schemas/account-export";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";

setupTestDb();

const exportFor = (cookie?: string) => GET(apiRequest("/api/me/export", { cookie }));
const bodyFor = async (cookie: string) => (await (await exportFor(cookie)).json()) as AccountExport;
const pool = (name: string, visibility: "private" | "unlisted" | "public") => ({
  name,
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  visibility,
});

describe("GET /api/me/export", () => {
  it("asks anonymous callers to sign in, and is never cached", async () => {
    const response = await exportFor();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the caller's profile and packs as a JSON attachment", async () => {
    const me = await createTestUser({ username: "peppy", osuId: 2 });
    await getIdentityDb()
      .collection("user")
      .updateOne(
        { _id: new ObjectId(me.id) },
        { $set: { avatarUrl: "https://a.ppy.sh/2?1.jpeg", countryCode: "AU" } },
      );
    const pack = await createPack(me.id, pool("SPC Finals", "unlisted"));

    const response = await exportFor(me.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="packs-data-peppy-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const body = (await response.json()) as AccountExport;
    expect(Object.keys(body)).toEqual(["exportedAt", "user", "packs", "apiKey"]);
    expect(Date.now() - Date.parse(body.exportedAt)).toBeLessThan(60_000);
    expect(body.user).toEqual({
      id: me.id,
      osuId: 2,
      username: "peppy",
      avatarUrl: "https://a.ppy.sh/2?1.jpeg",
      country: "AU",
      createdAt: expect.any(String),
    });
    expect(body.packs).toEqual([pack]);
  });

  it("never includes session tokens, the placeholder email, or other secrets", async () => {
    const me = await createTestUser();
    const session = await getIdentityDb()
      .collection("session")
      .findOne({ userId: new ObjectId(me.id) });
    expect(session?.token).toEqual(expect.any(String));

    const text = await (await exportFor(me.cookie)).text();
    for (const secret of [String(session?.token), "@osu.local"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/"(token|accessToken|refreshToken|idToken|password|hash|email)"\s*:/);
  });

  it("never includes another user's data", async () => {
    const me = await createTestUser({ username: "mine" });
    const other = await createTestUser({ username: "someone-else" });
    await createPack(other.id, pool("Their Pool", "public"));
    await createPack(me.id, pool("My Pool", "public"));

    const text = await (await exportFor(me.cookie)).text();
    for (const theirs of [other.id, "someone-else", "Their Pool"]) {
      expect(text).not.toContain(theirs);
    }
    expect(text).toContain("My Pool");
  });

  it("includes the caller's private and moderator-hidden packs", async () => {
    const me = await createTestUser();
    const secret = await createPack(me.id, pool("Secret Pool", "private"));
    const hidden = await createPack(me.id, pool("Hidden Pool", "public"));
    await getPackModel().updateOne(
      { slug: hidden.slug },
      { $set: { hiddenAt: new Date("2026-09-22T12:00:00Z") } },
    );

    const { packs } = await bodyFor(me.cookie);
    expect(packs).toHaveLength(2);
    expect(packs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: secret.slug, visibility: "private" }),
        expect.objectContaining({ slug: hidden.slug, hiddenAt: "2026-09-22T12:00:00.000Z" }),
      ]),
    );
  });

  it("answers 401 to a cookie whose haruhime account is gone", async () => {
    const me = await createTestUser();
    await getIdentityDb()
      .collection("user")
      .deleteOne({ _id: new ObjectId(me.id) });
    const response = await exportFor(me.cookie);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
