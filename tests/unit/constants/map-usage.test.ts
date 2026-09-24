/**
 * @file tests/unit/constants/map-usage.test.ts
 * @desc Map usage's CDN cache keeps the API docs' promise: the freshness window plus the stale
 *       window is at most an hour, so no answer served is more than an hour old.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_USAGE_CACHE } from "@/constants/map-usage";

const seconds = (directive: string): number => {
  const match = new RegExp(`${directive}=(\\d+)`).exec(MAP_USAGE_CACHE);
  if (!match) throw new Error(`${directive} is missing`);
  return Number(match[1]);
};

describe("MAP_USAGE_CACHE", () => {
  it("is public and never serves an answer more than an hour old, stale window included", () => {
    expect(MAP_USAGE_CACHE.startsWith("public, ")).toBe(true);
    expect(seconds("s-maxage") + seconds("stale-while-revalidate")).toBeLessThanOrEqual(3600);
    expect(seconds("stale-while-revalidate")).toBeGreaterThan(0);
  });

  it("matches what the API docs promise", () => {
    const docs = readFileSync(join(process.cwd(), "content/docs/api.mdx"), "utf8");
    expect(docs).toContain("answers can be up to an hour old");
  });
});
