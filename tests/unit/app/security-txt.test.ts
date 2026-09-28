/**
 * @file tests/unit/app/security-txt.test.ts
 * @desc /.well-known/security.txt: static, plain UTF-8, GitHub private vulnerability reporting as
 *       the first Contact and email second, and not blocked by robots.txt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { dynamic, GET } from "@/app/.well-known/security.txt/route";
import robots from "@/app/robots";

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
    expect(await response.text()).toBe(
      [
        "Contact: https://github.com/haruhimemoe/packs.haruhime.moe/security/advisories/new",
        "Contact: mailto:contact@haruhime.moe",
        "Expires: 2027-09-23T00:00:00.000Z",
        "Preferred-Languages: en",
        "Canonical: https://packs.haruhime.moe/.well-known/security.txt",
        "Policy: https://github.com/haruhimemoe/packs.haruhime.moe/blob/main/SECURITY.md",
        "",
      ].join("\n"),
    );
  });

  it("isn't disallowed by robots.txt", () => {
    const [rule] = robots().rules as { disallow: string[] }[];
    for (const pattern of rule?.disallow ?? []) {
      expect("/.well-known/security.txt".startsWith(pattern.split("*")[0] ?? "")).toBe(false);
    }
  });
});
