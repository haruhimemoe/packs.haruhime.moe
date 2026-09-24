/**
 * @file tests/unit/app/sitemap.test.ts
 * @desc sitemap.xml: static pages, /packs pages, guides, docs, legal, and every indexed public
 *       pack.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";

const { buildSearchIndex } = vi.hoisted(() => ({ buildSearchIndex: vi.fn() }));
vi.mock("@/services/public-packs", () => ({ buildSearchIndex }));

const { default: sitemap, revalidate } = await import("@/app/sitemap");

const entry = (i: number) => ({
  s: `aaaaaaaa${String(i).padStart(2, "0")}`,
  n: "p",
  o: "o",
  c: 1,
  d: "",
  u: "2026-09-22T00:00:00.000Z",
});

describe("sitemap", () => {
  it("is ISR, regenerating at most once a day", () => {
    expect(revalidate).toBe(86400);
  });

  it("lists static pages, guides, docs, legal, public list pages, and public packs", async () => {
    buildSearchIndex.mockResolvedValueOnce({
      v: 1,
      packs: Array.from({ length: 25 }, (_, i) => entry(i)),
    });
    const urls = (await sitemap()).map((e) => e.url);
    for (const path of [
      "/",
      "/new",
      "/guide",
      "/brand",
      "/packs",
      "/packs/page/2",
      "/guide/download-a-torrent",
      "/guide/make-a-pack",
      "/guide/pack-key",
      "/guide/seed-a-torrent",
      "/docs/api",
      "/legal/terms",
      "/legal/privacy",
      "/legal/your-privacy-rights",
      "/legal/copyright",
      "/legal/disclaimers",
    ]) {
      expect(urls).toContain(`https://packs.haruhime.moe${path === "/" ? "/" : path}`);
    }
    expect(urls).not.toContain("https://packs.haruhime.moe/packs/page/3");
    expect(urls.filter((u) => u.includes("/p/"))).toHaveLength(25);
  });

  it("dates each pack by its last update", async () => {
    buildSearchIndex.mockResolvedValueOnce({ v: 1, packs: [entry(1)] });
    expect((await sitemap()).find((e) => e.url.endsWith("/p/aaaaaaaa01"))).toEqual({
      url: "https://packs.haruhime.moe/p/aaaaaaaa01",
      lastModified: "2026-09-22T00:00:00.000Z",
    });
  });

  it("still lists the static pages when the database can't be reached", async () => {
    buildSearchIndex.mockRejectedValueOnce(new Error("server selection timed out"));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://packs.haruhime.moe/new");
    expect(urls.filter((u) => u.includes("/p/"))).toHaveLength(0);
  });

  it("logs a database failure instead of hiding it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    buildSearchIndex.mockRejectedValueOnce(new Error("server selection timed out"));
    await sitemap();
    expect(error).toHaveBeenCalledWith("sitemap: couldn't list public packs", expect.any(Error));
    error.mockRestore();
  });
});
