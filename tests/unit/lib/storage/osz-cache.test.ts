/**
 * @file tests/unit/lib/storage/osz-cache.test.ts
 * @desc OPFS download cache: hit/miss, failed writes, no OPFS at all, clearing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { cacheFileName, createOszCache, oszCache } from "@/lib/storage/osz-cache";
import { createFakeOpfs } from "../../../helpers/fake-opfs";

const osz = (text: string) => new Blob([`PK\u0003\u0004${text}`]);

describe("createOszCache", () => {
  it("misses, stores, then hits with the same bytes as a File", async () => {
    const opfs = createFakeOpfs();
    const cache = createOszCache(async () => opfs.root);
    expect(await cache.get(39804)).toBeNull();
    const stored = await cache.put(39804, osz("a"));
    expect(stored).toBeInstanceOf(File);
    expect(await (await cache.get(39804))?.text()).toBe(await osz("a").text());
    expect(opfs.list("osz")).toEqual(["39804n.osz"]);
  });

  it("hands back the original blob and leaves nothing behind when a write fails", async () => {
    const opfs = createFakeOpfs({ failWrites: true });
    const cache = createOszCache(async () => opfs.root);
    const blob = osz("b");
    expect(await cache.put(1, blob)).toBe(blob);
    expect(await cache.get(1)).toBeNull();
    expect(opfs.list("osz")).toEqual([]);
  });

  it("doesn't cache (or break) where OPFS has no createWritable, like older Safari", async () => {
    const opfs = createFakeOpfs({ noCreateWritable: true });
    const cache = createOszCache(async () => opfs.root);
    const blob = osz("s");
    expect(await cache.put(1, blob)).toBe(blob);
    expect(await cache.get(1)).toBeNull();
    expect(opfs.list("osz")).toEqual([]);
  });

  it("works as a no-op cache when there is no OPFS", async () => {
    const cache = createOszCache(async () => null);
    const blob = osz("c");
    expect(await cache.get(1)).toBeNull();
    expect(await cache.put(1, blob)).toBe(blob);
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("clears everything, and clearing twice is fine", async () => {
    const opfs = createFakeOpfs();
    const cache = createOszCache(async () => opfs.root);
    await cache.put(1, osz("d"));
    await cache.put(2, osz("e"));
    await cache.clear();
    expect(await cache.get(1)).toBeNull();
    expect(await cache.get(2)).toBeNull();
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("the default cache is safe where navigator.storage doesn't exist", async () => {
    expect(await oszCache.get(1)).toBeNull();
    const blob = osz("f");
    expect(await oszCache.put(1, blob)).toBe(blob);
  });

  it.each([
    [{}, "39804n.osz"],
    [{ video: true }, "39804.osz"],
    [{ noBackgrounds: true }, "39804nb.osz"],
    [{ video: true, noBackgrounds: true }, "39804b.osz"],
  ])("names the file for %j %s", (variant, name) => {
    expect(cacheFileName(39804, variant)).toBe(name);
  });

  it("keeps every variant apart", async () => {
    const opfs = createFakeOpfs();
    const cache = createOszCache(async () => opfs.root);
    await cache.put(39804, osz("with video"), { video: true });
    expect(await cache.get(39804)).toBeNull();
    expect(await (await cache.get(39804, { video: true }))?.text()).toBe(
      await osz("with video").text(),
    );
    await cache.put(39804, osz("no video"));
    await cache.put(39804, osz("no backgrounds"), { noBackgrounds: true });
    await cache.put(39804, osz("both"), { video: true, noBackgrounds: true });
    expect(await (await cache.get(39804))?.text()).toBe(await osz("no video").text());
    expect(await (await cache.get(39804, { noBackgrounds: true }))?.text()).toBe(
      await osz("no backgrounds").text(),
    );
    expect(opfs.list("osz").sort()).toEqual([
      "39804.osz",
      "39804b.osz",
      "39804n.osz",
      "39804nb.osz",
    ]);
  });

  it("clears every variant", async () => {
    const opfs = createFakeOpfs();
    const cache = createOszCache(async () => opfs.root);
    const variants = [
      {},
      { video: true },
      { noBackgrounds: true },
      { video: true, noBackgrounds: true },
    ];
    for (const variant of variants) await cache.put(1, osz("x"), variant);
    await cache.clear();
    for (const variant of variants) expect(await cache.get(1, variant)).toBeNull();
    expect(opfs.list("osz")).toEqual([]);
  });
});
