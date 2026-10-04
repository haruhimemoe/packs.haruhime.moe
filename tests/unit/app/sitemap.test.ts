/**
 * @file tests/unit/app/sitemap.test.ts
 * @desc sitemap.xml: static pages, /packs pages, the docs, guides (osu! collections included)
 *       and legal sections with their index pages, and every indexed public pack.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { findEntry } from "@haruhimemoe/next-kit/docs";
import { describe, expect, it, vi } from "vitest";
import { CONTENT } from "@/constants/content";

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
      "/guides",
      "/docs",
      "/legal",
      "/brand",
      "/packs",
      "/packs/page/2",
      "/guides/download-a-torrent",
      "/guides/make-a-pack",
      "/guides/pack-key",
      "/guides/seed-a-torrent",
      "/guides/osu-collections",
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
    expect((await sitemap()).find((e) => e.url.endsWith("/p/aaaaaaaa01"))).toMatchObject({
      url: "https://packs.haruhime.moe/p/aaaaaaaa01",
      lastModified: "2026-09-22T00:00:00.000Z",
    });
  });

  it("dates guides, docs and legal pages by their lastUpdated, and fakes no other date", async () => {
    buildSearchIndex.mockResolvedValueOnce({ v: 1, packs: [] });
    const entries = await sitemap();
    const byPath = (path: string) =>
      entries.find((e) => e.url === `https://packs.haruhime.moe${path}`);
    expect(new Date(String(byPath("/guides/make-a-pack")?.lastModified)).toISOString()).toBe(
      new Date(String(findEntry(CONTENT, "guides", "make-a-pack")?.lastUpdated)).toISOString(),
    );
    expect(byPath("/docs/api")?.lastModified).toBeDefined();
    expect(byPath("/legal/terms")?.lastModified).toBeDefined();
    expect(byPath("/new")?.lastModified).toBeUndefined();
    expect(byPath("/packs")?.lastModified).toBeUndefined();
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
