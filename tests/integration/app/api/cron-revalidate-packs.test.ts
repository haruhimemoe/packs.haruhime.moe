/**
 * @file tests/integration/app/api/cron-revalidate-packs.test.ts
 * @desc POST /api/cron/revalidate-packs (the archive importer's refresh): fails closed without
 *       CRON_SECRET (503), refuses a missing or wrong Bearer secret (401) without revalidating,
 *       and with the right one marks every public-pack page stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cron/revalidate-packs/route";
import { apiRequest } from "../../../helpers/requests";

const SECRET = "cron-secret-for-tests-0123456789";

const refresh = (authorization?: string) =>
  POST(
    apiRequest("/api/cron/revalidate-packs", {
      method: "POST",
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

describe("POST /api/cron/revalidate-packs", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear();
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => vi.stubEnv("CRON_SECRET", ""));

  it("refuses everything while CRON_SECRET isn't set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await refresh(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "not_configured",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer not-the-secret-at-all-00000"],
    ["the secret without Bearer", SECRET],
  ])("refuses %s with 401", async (_label, authorization) => {
    const response = await refresh(authorization);
    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marks /packs, its pages, the index, the homepage and the sitemap stale", async () => {
    const response = await refresh(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ revalidated: true });
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([
      ["/(public)/packs", "layout"],
      ["/packs/index.json"],
      ["/"],
      ["/sitemap.xml"],
    ]);
  });
});
