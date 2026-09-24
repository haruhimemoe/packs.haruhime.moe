/**
 * @file tests/integration/app/api/me-export.test.ts
 * @desc GET /api/me/export ("Download my data"): signed-in only, a no-store JSON attachment with
 *       the caller's profile, sessions, and packs; no secrets and nothing of anyone else's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/me/export/route";
import { DELETE } from "@/app/api/me/route";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
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

  it("returns the caller's profile, sessions, and packs as a JSON attachment", async () => {
    const me = await createTestUser({
      username: "peppy",
      osuId: 2,
      session: { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 (packs test)" },
    });
    await getDb()
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
    expect(Object.keys(body)).toEqual([
      "exportedAt",
      "user",
      "accounts",
      "sessions",
      "packs",
      "apiKey",
    ]);
    expect(Date.now() - Date.parse(body.exportedAt)).toBeLessThan(60_000);
    expect(body.user).toEqual({
      id: me.id,
      osuId: 2,
      username: "peppy",
      avatarUrl: "https://a.ppy.sh/2?1.jpeg",
      country: "AU",
      createdAt: expect.any(String),
    });
    expect(body.accounts).toEqual([
      {
        provider: "osu",
        accountId: "2",
        scope: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ]);
    expect(body.sessions).toEqual([
      {
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0 (packs test)",
      },
    ]);
    expect(body.packs).toEqual([pack]);
  });

  it("never includes tokens, the placeholder email, or other secrets", async () => {
    const me = await createTestUser();
    const userId = new ObjectId(me.id);
    // A row from before src/lib/auth.ts dropped osu! tokens must not leak either.
    await getDb()
      .collection("account")
      .updateOne(
        { userId },
        { $set: { accessToken: "osu-access-secret", refreshToken: "osu-refresh-secret" } },
      );
    const session = await getDb().collection("session").findOne({ userId });
    expect(session?.token).toEqual(expect.any(String));

    const text = await (await exportFor(me.cookie)).text();
    for (const secret of [
      String(session?.token),
      "osu-access-secret",
      "osu-refresh-secret",
      "@osu.local",
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/"(token|accessToken|refreshToken|idToken|password|hash|email)"\s*:/);
  });

  it("lists the linked osu! account record with its scope, never its tokens", async () => {
    const me = await createTestUser({ osuId: 7 });
    await getDb()
      .collection("account")
      .updateOne(
        { userId: new ObjectId(me.id) },
        {
          $set: {
            scope: "identify public",
            accessToken: "osu-access-secret",
            idToken: "osu-id-secret",
          },
        },
      );
    const { accounts } = await bodyFor(me.cookie);
    expect(accounts).toEqual([
      expect.objectContaining({ accountId: "7", scope: "identify public" }),
    ]);
    expect(JSON.stringify(accounts)).not.toMatch(/secret|Token/);
  });

  it("never includes another user's data", async () => {
    const me = await createTestUser({ username: "mine" });
    const other = await createTestUser({
      username: "someone-else",
      session: { ipAddress: "198.51.100.9", userAgent: "OtherBrowser/2.0" },
    });
    await createPack(other.id, pool("Their Pool", "public"));
    await createPack(me.id, pool("My Pool", "public"));

    const text = await (await exportFor(me.cookie)).text();
    for (const theirs of [
      other.id,
      "someone-else",
      "198.51.100.9",
      "OtherBrowser/2.0",
      "Their Pool",
    ]) {
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

  it("lists every stored session, expired ones too, with null for details not recorded", async () => {
    // createTestUser's own session is made outside a request, so better-auth stored "" for both.
    const me = await createTestUser();
    const ctx = await getAuth().$context;
    const old = await ctx.internalAdapter.createSession(me.id, false, {
      ipAddress: "192.0.2.1",
      userAgent: "OldBrowser/1.0",
    });
    await getDb()
      .collection("session")
      .updateOne({ token: old.token }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const { sessions } = await bodyFor(me.cookie);
    expect(sessions).toHaveLength(2);
    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ipAddress: null, userAgent: null }),
        expect.objectContaining({ ipAddress: "192.0.2.1", userAgent: "OldBrowser/1.0" }),
      ]),
    );
  });

  it("answers 401 to a cookie whose account is already gone", async () => {
    const me = await createTestUser();
    await DELETE(apiRequest("/api/me", { method: "DELETE", cookie: me.cookie }));
    const response = await exportFor(me.cookie);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
