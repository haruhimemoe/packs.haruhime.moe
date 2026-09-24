/**
 * @file tests/unit/app/robots.test.ts
 * @desc robots.txt: everything crawlable (AI crawlers included) except private and API paths; the
 *       OpenAPI document stays crawlable under /api/.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("allows the site and the OpenAPI document, blocks private paths, and points at the sitemap", () => {
    expect(robots()).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/api/v1/openapi.json"],
          disallow: ["/api/", "/admin", "/me", "/signin", "/p/*/edit"],
        },
      ],
      sitemap: "https://packs.haruhime.moe/sitemap.xml",
    });
  });

  /** RFC 9309 matching, enough for our rules: the longest matching pattern wins, Allow on a tie. */
  const crawlable = (path: string): boolean => {
    const [rule] = robots().rules as { allow: string[]; disallow: string[] }[];
    const matches = (pattern: string) =>
      new RegExp(
        `^${pattern
          .split("*")
          .map((part) => part.replace(/[.?+^$()[\]{}|\\]/g, "\\$&"))
          .join(".*")}`,
      ).test(path);
    const longest = (patterns: string[]) =>
      Math.max(-1, ...patterns.filter(matches).map((pattern) => pattern.length));
    return longest(rule?.allow ?? []) >= longest(rule?.disallow ?? []);
  };

  it.each([
    ["/api/v1/openapi.json", true],
    ["/api/v1/packs", false],
    ["/api/v1/me", false],
    ["/api/me/api-key", false],
    ["/docs/api", true],
    ["/llms.txt", true],
    ["/p/abcdefghij/edit", false],
  ])("%s is crawlable: %s", (path, expected) => {
    expect(crawlable(path)).toBe(expected);
  });

  it("has no host line (only Yandex ever read it)", () => {
    expect(robots()).not.toHaveProperty("host");
  });
});
