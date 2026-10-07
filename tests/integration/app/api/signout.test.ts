/**
 * @file tests/integration/app/api/signout.test.ts
 * @desc POST /api/signout: refuses other sites; forwards only the session cookie to the hub's
 *       sign-out (Origin packs.haruhime.moe, redirect "manual"); clears the session cookies and the
 *       shared marker even when the hub can't be reached; 204, never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/signout/route";
import { SIGNED_IN_COOKIE } from "@/constants/site";
import { apiRequest } from "../../../helpers/requests";

const SESSION = "better-auth.session_token=abc.def";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const stubHub = (impl: () => Promise<Response>) => {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("POST /api/signout", () => {
  it("refuses a request from another site and calls nobody", async () => {
    const fetchMock = stubHub(async () => new Response(null));
    const response = await POST(
      apiRequest("/api/signout", {
        method: "POST",
        cookie: SESSION,
        headers: { origin: "https://pools.haruhime.moe" },
      }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only the session cookie to the hub, then clears the cookies", async () => {
    vi.stubEnv("HUB_URL", "https://hub.example.com");
    const fetchMock = stubHub(async () => new Response(null, { status: 200 }));
    const response = await POST(
      apiRequest("/api/signout", {
        method: "POST",
        cookie: `other=1; ${SESSION}; ${SIGNED_IN_COOKIE}=1`,
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://hub.example.com/api/auth/sign-out");
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    const headers = new Headers(init.headers);
    expect(headers.get("cookie")).toBe(SESSION);
    expect(headers.get("origin")).toBe("https://packs.haruhime.moe");
    const cleared = response.headers.getSetCookie();
    for (const name of [
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
      "better-auth.session_data",
      "__Secure-better-auth.session_data",
      SIGNED_IN_COOKIE,
    ]) {
      expect(cleared.find((line) => line.startsWith(`${name}=;`))).toMatch(/Max-Age=0/);
    }
    // localhost: host-only cookies, no Domain.
    expect(cleared.join("\n")).not.toContain("Domain=");
  });

  it("still clears the cookies when the hub can't be reached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stubHub(async () => {
      throw new Error("offline");
    });
    const response = await POST(apiRequest("/api/signout", { method: "POST", cookie: SESSION }));
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it("calls nobody without a session cookie", async () => {
    const fetchMock = stubHub(async () => new Response(null));
    const response = await POST(apiRequest("/api/signout", { method: "POST" }));
    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
