/**
 * @file tests/integration/lib/auth.test.ts
 * @desc better-auth against in-memory Mongo: session cookies resolve to our user shape, forged
 *       cookies don't, the /api/auth handler starts osu! sign-in with PKCE and our callback, and
 *       the full OAuth callback (osu! stubbed) creates and refreshes the user without keeping tokens,
 *       storing the osu! profile as our user fields (synthetic email, image only with an avatar).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SIGNED_IN_COOKIE } from "@/lib/signed-in-marker";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

vi.stubEnv("ADMIN_OSU_IDS", "12231334");

setupTestDb();

describe("getUserFromHeaders", () => {
  it("returns the signed-in user for a valid session cookie", async () => {
    const user = await createTestUser({ username: "peppy" });
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toEqual({
      id: user.id,
      osuId: user.osuId,
      username: "peppy",
      avatarUrl: null,
      isAdmin: false,
    });
  });

  it("returns null without a cookie", async () => {
    expect(await getUserFromHeaders(new Headers())).toBeNull();
  });

  it("returns null for a forged cookie", async () => {
    const user = await createTestUser();
    const forged = user.cookie.replace(/\.[^.]+$/, ".forged");
    expect(forged).toMatch(/^better-auth\.session_token=[^.]+\.forged$/);
    expect(await getUserFromHeaders(new Headers({ cookie: forged }))).toBeNull();
  });

  it("flags users whose osu! id is in ADMIN_OSU_IDS", async () => {
    const admin = await createTestUser({ osuId: 12231334 });
    expect(await getUserFromHeaders(new Headers({ cookie: admin.cookie }))).toMatchObject({
      osuId: 12231334,
      isAdmin: true,
    });
  });
});

describe("expired sessions", () => {
  it("returns null for an expired session", async () => {
    const user = await createTestUser();
    await getDb()
      .collection("session")
      .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toBeNull();
  });
});

describe("/api/auth handler", () => {
  it("reports the session", async () => {
    const user = await createTestUser();
    const response = await GET(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: user.cookie },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { osuId: number; username: string } };
    expect(body.user).toMatchObject({ osuId: user.osuId, username: user.username });
  });

  it("starts osu! sign-in with PKCE and our callback", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ provider: "osu", callbackURL: "/me" }),
      }),
    );
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    const target = new URL(url);
    expect(`${target.origin}${target.pathname}`).toBe("https://osu.ppy.sh/oauth/authorize");
    expect(target.searchParams.get("client_id")).toBe("1");
    expect(target.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/osu",
    );
    expect(target.searchParams.get("scope")).toBe("identify public");
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

/** "name=value; name2=value2" from a response's Set-Cookie headers. */
const cookiesFrom = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

/** The marker's Set-Cookie line from a response, or undefined. */
const markerFrom = (response: Response): string | undefined =>
  response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${SIGNED_IN_COOKIE}=`));

const realFetch = globalThis.fetch;

/** Answers osu!'s token and /me endpoints; everything else goes to the real fetch (none here). */
const stubOsu = (profile: Record<string, unknown>) =>
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://osu.ppy.sh/oauth/token")) {
      return Response.json({
        access_token: "osu-access-token",
        refresh_token: "osu-refresh-token",
        token_type: "Bearer",
        expires_in: 86400,
      });
    }
    if (url.startsWith("https://osu.ppy.sh/api/v2/me")) return Response.json(profile);
    return realFetch(input, init);
  });

/** Runs sign-in/social then the callback, as the browser would, with osu! stubbed. */
const signInWithOsu = async (
  profile: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<Response> => {
  const start = await POST(
    new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ provider: "osu", callbackURL: "/me" }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state") ?? "";
  stubOsu(profile);
  return GET(
    new Request(`http://localhost:3000/api/auth/callback/osu?code=abc&state=${state}`, {
      headers: { ...headers, cookie: cookiesFrom(start) },
    }),
  );
};

const PEPPY = {
  id: 2,
  username: "peppy",
  avatar_url: "https://a.ppy.sh/2?1.jpeg",
  country_code: "AU",
  country: { code: "AU" },
};

describe("osu! OAuth callback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates the user on first sign-in and lands on next", async () => {
    const callback = await signInWithOsu(PEPPY);
    expect(callback.headers.get("location")).toBe("/me");
    expect(await getUserFromHeaders(new Headers({ cookie: cookiesFrom(callback) }))).toMatchObject({
      osuId: 2,
      username: "peppy",
      avatarUrl: "https://a.ppy.sh/2?1.jpeg",
    });
    expect(await getDb().collection("user").findOne({ osuId: 2 })).toMatchObject({
      countryCode: "AU",
      email: "2@osu.local",
    });
  });

  it("stores the profile as our user fields", async () => {
    await signInWithOsu({ ...PEPPY, country: null });
    expect(await getDb().collection("user").findOne({ osuId: 2 })).toMatchObject({
      email: "2@osu.local",
      emailVerified: false,
      name: "peppy",
      image: "https://a.ppy.sh/2?1.jpeg",
      osuId: 2,
      username: "peppy",
      avatarUrl: "https://a.ppy.sh/2?1.jpeg",
      countryCode: "AU",
    });
  });

  it("stores no image when osu! sends no avatar", async () => {
    await signInWithOsu({ ...PEPPY, avatar_url: null, country_code: null, country: null });
    const user = await getDb().collection("user").findOne({ osuId: 2 });
    // better-auth wants image left out, not null.
    expect(user).not.toHaveProperty("image");
    expect(user?.avatarUrl ?? null).toBeNull();
    expect(user?.countryCode ?? null).toBeNull();
  });

  it("refreshes the username on a later sign-in", async () => {
    await signInWithOsu(PEPPY);
    vi.unstubAllGlobals();
    await signInWithOsu({ ...PEPPY, username: "peppy2" });
    const users = await getDb().collection("user").find({ osuId: 2 }).toArray();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ username: "peppy2" });
  });

  it("keeps no osu! tokens", async () => {
    await signInWithOsu(PEPPY);
    vi.unstubAllGlobals();
    await signInWithOsu(PEPPY);
    const account = await getDb().collection("account").findOne({ providerId: "osu" });
    expect(account).not.toBeNull();
    expect(account?.accessToken ?? null).toBeNull();
    expect(account?.refreshToken ?? null).toBeNull();
    expect(account?.idToken ?? null).toBeNull();
  });

  it("doesn't let a signed-in user rewrite their osu! identity", async () => {
    const user = await createTestUser({ username: "honest" });
    const response = await POST(
      new Request("http://localhost:3000/api/auth/update-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          cookie: user.cookie,
        },
        body: JSON.stringify({ username: "impostor", osuId: 2 }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toMatchObject({
      username: "honest",
      osuId: user.osuId,
    });
  });

  it("records the IP address and User-Agent on the session (the privacy policy says so)", async () => {
    await signInWithOsu(PEPPY, {
      "x-forwarded-for": "203.0.113.7",
      "user-agent": "Mozilla/5.0 (packs test)",
    });
    expect(await getDb().collection("session").findOne({})).toMatchObject({
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 (packs test)",
    });
  });

  it("sets only the cookies the privacy policy lists (the privacy policy says so)", async () => {
    const start = await POST(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ provider: "osu", callbackURL: "/me" }),
      }),
    );
    // The sign-in cookie: HttpOnly, at most 5 minutes.
    const [state, ...others] = start.headers.getSetCookie();
    expect(others).toEqual([]);
    expect(state).toMatch(/^better-auth\.state=/);
    expect(state).toMatch(/Max-Age=300/);
    expect(state).toMatch(/HttpOnly/i);

    const set = (await signInWithOsu(PEPPY)).headers.getSetCookie();
    const named = (name: string) => set.find((cookie) => cookie.startsWith(`${name}=`));
    for (const cookie of set) {
      expect(["better-auth.state", "better-auth.session_token", SIGNED_IN_COOKIE]).toContain(
        cookie.split("=")[0],
      );
    }
    // Deleted once you're signed in; the session cookie is HttpOnly.
    expect(named("better-auth.state")).toMatch(/Max-Age=0/);
    expect(named("better-auth.session_token")).toMatch(/HttpOnly/i);
  });
});

describe("signed-in marker cookie", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is set, readable by the page, when osu! sign-in completes", async () => {
    const marker = markerFrom(await signInWithOsu(PEPPY));
    expect(marker).toMatch(/^packs-signed-in=1;/);
    expect(marker).toMatch(/Max-Age=\d{5,}/);
    expect(marker).toMatch(/Path=\//);
    expect(marker).not.toMatch(/HttpOnly/i);
  });

  it("is refreshed by a get-session that finds a session", async () => {
    const user = await createTestUser();
    const response = await GET(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: user.cookie },
      }),
    );
    expect(markerFrom(response)).toMatch(/^packs-signed-in=1;/);
  });

  it("is cleared by a get-session without a session", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: "packs-signed-in=1" },
      }),
    );
    expect(markerFrom(response)).toMatch(/^packs-signed-in=;.*Max-Age=0/);
  });

  it("is cleared on sign-out", async () => {
    const user = await createTestUser();
    const response = await POST(
      new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: { cookie: user.cookie, origin: "http://localhost:3000" },
      }),
    );
    expect(markerFrom(response)).toMatch(/^packs-signed-in=;.*Max-Age=0/);
  });
});
