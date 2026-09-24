/**
 * @file tests/integration/services/pack-exports.test.ts
 * @desc Magnet links on saved packs (in-memory Mongo): owner-only add and remove, newest first,
 *       dedupe by infohash, the 10-link cap, updatedAt untouched, and PUT clearing stale links
 *       (a custom slot's mods included), and only canonical links stored or shown (old rows too).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { MAX_PACK_EXPORTS } from "@/constants/pack";
import { TRACKERS } from "@/constants/trackers";
import { getPackModel } from "@/models/Pack";
import type { BucketEntry } from "@/schemas/pack";
import type { PackInput } from "@/schemas/saved-pack";
import { addMagnet, ExportLimitError, removeMagnet, StalePackError } from "@/services/pack-exports";
import { createPack, getPackForViewer, updatePack } from "@/services/packs";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const newId = () => new ObjectId().toHexString();
const INPUT: PackInput = {
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  visibility: "unlisted",
};
const hash = (n: number) => n.toString(16).padStart(40, "0");
const magnet = (n: number, dn = "SPC") => `magnet:?xt=urn:btih:${hash(n)}&dn=${dn}`;

const keyOf = (pack: PackInput): string =>
  encodePackKey(
    pack.buckets
      ? { name: pack.name, slots: pack.slots, buckets: pack.buckets }
      : { name: pack.name, slots: pack.slots },
  );
const add = (slug: string, ownerId: string, url: string, now?: Date, pack: PackInput = INPUT) =>
  addMagnet(slug, ownerId, { url, packKey: keyOf(pack) }, now);

const saved = async () => {
  const ownerId = newId();
  const pack = await createPack(ownerId, INPUT);
  return { ownerId, slug: pack.slug, pack };
};

describe("addMagnet", () => {
  it("adds the newest link first and shows it to viewers", async () => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1), new Date("2026-09-22T01:00:00Z"));
    const list = await add(slug, ownerId, magnet(2), new Date("2026-09-22T02:00:00Z"));
    expect(list).toEqual([
      { kind: "magnet", url: magnet(2), createdAt: "2026-09-22T02:00:00.000Z" },
      { kind: "magnet", url: magnet(1), createdAt: "2026-09-22T01:00:00.000Z" },
    ]);
    expect((await getPackForViewer(slug, null))?.pack.exports).toEqual(list);
  });

  it("lists the same torrent once, moving it to the top", async () => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1));
    await add(slug, ownerId, magnet(2));
    const list = await add(slug, ownerId, `magnet:?xt=urn:btih:${hash(1).toUpperCase()}&dn=again`);
    expect(list?.map((e) => e.url)).toEqual([magnet(1, "again"), magnet(2)]);
  });

  it("stores only the canonical link: our trackers, no web seeds, sources, or peers", async () => {
    const { ownerId, slug } = await saved();
    const ours = encodeURIComponent(TRACKERS[0] ?? "");
    const list = await add(
      slug,
      ownerId,
      `${magnet(1)}&tr=${encodeURIComponent("http://tracker.attacker.example/announce")}&tr=${ours}` +
        "&ws=http%3A%2F%2F192.168.0.1%2Fx&xs=http%3A%2F%2Fa.example%2Ft&x.pe=10.0.0.5%3A22",
    );
    const canonical = `${magnet(1)}&tr=${ours}`;
    expect(list?.map((e) => e.url)).toEqual([canonical]);
    const doc = await getPackModel().findOne({ slug }).lean();
    expect(doc?.exports?.map((e) => e.url)).toEqual([canonical]);
  });

  it(`refuses an ${MAX_PACK_EXPORTS + 1}th link but still allows re-adding a listed one`, async () => {
    const { ownerId, slug } = await saved();
    for (let n = 1; n <= MAX_PACK_EXPORTS; n++) await add(slug, ownerId, magnet(n));
    await expect(add(slug, ownerId, magnet(99))).rejects.toBeInstanceOf(ExportLimitError);
    expect(await add(slug, ownerId, magnet(3))).toHaveLength(MAX_PACK_EXPORTS);
  });

  it("answers null for someone else's pack or a bad slug", async () => {
    const { slug } = await saved();
    expect(await add(slug, newId(), magnet(1))).toBeNull();
    expect(await add("../nope", newId(), magnet(1))).toBeNull();
  });

  it("leaves updatedAt alone", async () => {
    const { ownerId, slug, pack } = await saved();
    await add(slug, ownerId, magnet(1));
    await removeMagnet(slug, ownerId, magnet(1));
    expect((await getPackForViewer(slug, ownerId))?.pack.updatedAt).toBe(pack.updatedAt);
  });
});

describe("links stored before canonical links", () => {
  it("come out canonical, bad ones dropped, one per infohash", async () => {
    const { ownerId, slug } = await saved();
    const at = new Date("2026-09-22T01:00:00Z");
    await getPackModel().updateOne(
      { slug },
      {
        $set: {
          exports: [
            { kind: "magnet", url: `${magnet(1)}&ws=http%3A%2F%2F192.168.0.1%2F`, createdAt: at },
            { kind: "magnet", url: "javascript:alert(1)", createdAt: at },
            { kind: "magnet", url: `magnet:?xt=urn:btih:${hash(1).toUpperCase()}`, createdAt: at },
            { kind: "magnet", url: `${magnet(2)}&x.pe=10.0.0.5%3A22`, createdAt: at },
          ],
        },
      },
    );
    const expected = [magnet(1), magnet(2)];
    expect((await getPackForViewer(slug, null))?.pack.exports?.map((e) => e.url)).toEqual(expected);
    // The owner's next write stores the cleaned list.
    const list = await add(slug, ownerId, magnet(3));
    expect(list?.map((e) => e.url)).toEqual([magnet(3), ...expected]);
  });
});

describe("removeMagnet", () => {
  it("removes by infohash and returns what's left", async () => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1));
    await add(slug, ownerId, magnet(2));
    const list = await removeMagnet(slug, ownerId, magnet(1, "other-name"));
    expect(list?.map((e) => e.url)).toEqual([magnet(2)]);
  });

  it("answers null for someone else's pack", async () => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1));
    expect(await removeMagnet(slug, newId(), magnet(1))).toBeNull();
    expect((await getPackForViewer(slug, ownerId))?.pack.exports).toHaveLength(1);
  });
});

describe("new packs and edits", () => {
  it("starts with no links", async () => {
    const { pack } = await saved();
    expect(pack.exports).toEqual([]);
  });

  it("keeps links when only visibility or description change", async () => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1));
    const pack = await updatePack(slug, ownerId, {
      ...INPUT,
      visibility: "public",
      description: "Finals week",
    });
    expect(pack?.exports).toHaveLength(1);
  });

  it("keeps links when the same slots arrive in another order", async () => {
    const ownerId = newId();
    const two: PackInput = {
      ...INPUT,
      slots: [
        { mod: "NM", index: 1, beatmapId: 129891 },
        { mod: "TB", index: 1, beatmapId: 1872396 },
      ],
    };
    const { slug } = await createPack(ownerId, two);
    await add(slug, ownerId, magnet(1), undefined, two);
    const pack = await updatePack(slug, ownerId, { ...two, slots: [...two.slots].reverse() });
    expect(pack?.exports).toHaveLength(1);
  });

  it.each([
    ["the name", { name: "SPC Grand Finals" }],
    ["the maps", { slots: [{ mod: "NM" as const, index: 1, beatmapId: 1872396 }] }],
    [
      "the slot list",
      {
        buckets: [
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "EZ", color: 3 },
          { code: "TB" },
        ],
      },
    ],
  ])("clears links when %s change", async (_label, change) => {
    const { ownerId, slug } = await saved();
    await add(slug, ownerId, magnet(1));
    const pack = await updatePack(slug, ownerId, { ...INPUT, ...change } as PackInput);
    expect(pack?.exports).toEqual([]);
  });

  it("clears links when a custom slot's mods change", async () => {
    const ownerId = newId();
    const plain: BucketEntry[] = [
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "EZ", color: 3 },
      { code: "TB" },
    ];
    const forced: BucketEntry[] = [
      ...plain.slice(0, 5),
      { code: "EZ", color: 3, mods: { kind: "forced", set: ["EZ"] } },
      { code: "TB" },
    ];
    const before: PackInput = { ...INPUT, buckets: plain };
    const { slug } = await createPack(ownerId, before);
    await add(slug, ownerId, magnet(1), undefined, before);
    const pack = await updatePack(slug, ownerId, { ...INPUT, buckets: forced });
    expect(pack?.exports).toEqual([]);
  });
});

describe("guarding the list", () => {
  it("refuses a torrent made from an older version of the pack", async () => {
    const { ownerId, slug } = await saved();
    await expect(
      add(slug, ownerId, magnet(1), undefined, { ...INPUT, name: "SPC Finals (old)" }),
    ).rejects.toBeInstanceOf(StalePackError);
    expect((await getPackForViewer(slug, ownerId))?.pack.exports).toEqual([]);
  });

  it("keeps both links when two are added at once", async () => {
    const { ownerId, slug } = await saved();
    await Promise.all([add(slug, ownerId, magnet(1)), add(slug, ownerId, magnet(2))]);
    const urls = (await getPackForViewer(slug, ownerId))?.pack.exports?.map((e) => e.url);
    expect(urls?.sort()).toEqual([magnet(1), magnet(2)]);
  });

  it("never shows a stored link that isn't a magnet link", async () => {
    const { slug } = await saved();
    await getPackModel().updateOne(
      { slug },
      {
        $set: {
          exports: [
            { kind: "magnet", url: "https://phish.example/", createdAt: new Date() },
            { kind: "magnet", url: "javascript:alert(1)", createdAt: new Date() },
            { kind: "magnet", url: magnet(1), createdAt: new Date() },
          ],
        },
      },
    );
    expect((await getPackForViewer(slug, null))?.pack.exports?.map((e) => e.url)).toEqual([
      magnet(1),
    ]);
  });
});
