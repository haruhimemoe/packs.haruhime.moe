/**
 * @file tests/unit/app/security-txt.test.ts
 * @desc GET /.well-known/security.txt: static, plain text, the builder's output for build time;
 *       robots.txt leaves /.well-known/ crawlable.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { dynamic, GET } from "@/app/.well-known/security.txt/route";
import robots from "@/app/robots";
import { buildSecurityTxt } from "@/utils/security-txt";

describe("GET /.well-known/security.txt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is built once at build time", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves the security.txt body as UTF-8 plain text", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T00:00:00.000Z"));
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(buildSecurityTxt(new Date("2026-09-23T00:00:00.000Z")));
  });

  it("isn't disallowed by robots.txt", () => {
    const [rule] = robots().rules as { disallow: string[] }[];
    for (const pattern of rule?.disallow ?? []) {
      expect("/.well-known/security.txt".startsWith(pattern.split("*")[0] ?? "")).toBe(false);
    }
  });
});
