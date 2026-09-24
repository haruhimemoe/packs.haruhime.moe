/**
 * @file tests/unit/utils/paging.test.ts
 * @desc Page params and page links for /packs and /admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { MAX_PUBLIC_PAGE } from "@/constants/public-packs";
import { adminHref, parsePageParam, parsePublicPage, publicPageHref } from "@/utils/paging";

describe("parsePageParam", () => {
  it.each([
    ["1", 1],
    ["24", 24],
    ["999999", 999999],
  ])("reads %j", (raw, page) => {
    expect(parsePageParam(raw)).toBe(page);
  });

  it.each(["0", "01", "-1", "1.5", "abc", "", "1000000"])("refuses %j", (raw) => {
    expect(parsePageParam(raw)).toBeNull();
  });
});

describe("publicPageHref", () => {
  it("keeps page 1 at /packs", () => {
    expect(publicPageHref(1)).toBe("/packs");
    expect(publicPageHref(3)).toBe("/packs/page/3");
  });
});

describe("adminHref", () => {
  it("adds only the filters in use", () => {
    expect(adminHref({})).toBe("/admin");
    expect(adminHref({ page: 2, hiddenOnly: true, query: "spc cup" })).toBe(
      "/admin?show=hidden&q=spc+cup&page=2",
    );
    expect(adminHref({ page: 1, query: "a" })).toBe("/admin?q=a");
  });
});

describe("parsePublicPage", () => {
  it("stops where the search index stops, so crawlers can't mint endless cached pages", () => {
    expect(MAX_PUBLIC_PAGE).toBe(209);
    expect(parsePublicPage("209")).toBe(209);
    expect(parsePublicPage("210")).toBeNull();
    expect(parsePublicPage("abc")).toBeNull();
  });
});
