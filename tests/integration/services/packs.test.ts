/**
 * @file tests/integration/services/packs.test.ts
 * @desc Packs service on in-memory Mongo: create, visibility rules, owner-only edits, list order,
 *       the per-account cap (none for admins), paging, and slug collision retries.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SAVED_PACKS, OWN_PAGE_SIZE } from "@/constants/pack";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import { deleteAccount } from "@/services/account";
import {
  createPack,
  deletePack,
  getPackForViewer,
  listPacks,
  PackLimitError,
  updatePack,
} from "@/services/packs";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const newId = () => new ObjectId().toHexString();
const input = (overrides: Partial<PackInput> = {}): PackInput => ({
  name: "SPC Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "TB", index: 1, beatmapId: 1872396 },
  ],
  visibility: "unlisted",
  ...overrides,
});

describe("createPack", () => {
  it("stores the pack under a 10-character slug", async () => {
    const pack = await createPack(newId(), input());
    expect(pack.slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(pack).toMatchObject({ name: "SPC Finals", visibility: "unlisted" });
    expect(pack.slots).toEqual(input().slots);
    expect(Number.isNaN(Date.parse(pack.createdAt))).toBe(false);
  });

  it("retries when a slug is taken", async () => {
    const slugs = ["aaaaaaaaaa", "aaaaaaaaaa", "bbbbbbbbbb"];
    const makeSlug = () => slugs.shift() ?? "cccccccccc";
    await createPack(newId(), input(), { makeSlug });
    expect((await createPack(newId(), input(), { makeSlug })).slug).toBe("bbbbbbbbbb");
  });

  it("gives up after three taken slugs", async () => {
    await createPack(newId(), input(), { makeSlug: () => "aaaaaaaaaa" });
    await expect(
      createPack(newId(), input(), { makeSlug: () => "aaaaaaaaaa" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it(`stops at ${MAX_SAVED_PACKS} packs per account`, async () => {
    const owner = newId();
    await getPackModel().insertMany(
      Array.from({ length: MAX_SAVED_PACKS }, (_, i) => ({
        ...input(),
        slug: `cap${String(i).padStart(7, "0")}`,
        ownerId: owner,
      })),
    );
    await expect(createPack(owner, input())).rejects.toBeInstanceOf(PackLimitError);
    await expect(createPack(newId(), input())).resolves.toMatchObject({ name: "SPC Finals" });
  });
});

describe("getPackForViewer", () => {
  it("shows an unlisted pack to anyone, flagging the owner", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input());
    expect(await getPackForViewer(slug, null)).toMatchObject({ isOwner: false });
    expect(await getPackForViewer(slug, newId())).toMatchObject({ isOwner: false });
    expect(await getPackForViewer(slug, owner)).toMatchObject({ isOwner: true });
  });

  it("hides a private pack from everyone but its owner", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input({ visibility: "private" }));
    expect(await getPackForViewer(slug, null)).toBeNull();
    expect(await getPackForViewer(slug, newId())).toBeNull();
    expect((await getPackForViewer(slug, owner))?.pack.visibility).toBe("private");
  });

  it("returns null for unknown or malformed slugs", async () => {
    expect(await getPackForViewer("zzzzzzzzzz", null)).toBeNull();
    expect(await getPackForViewer("../etc", null)).toBeNull();
  });
});

describe("listPacks", () => {
  it("lists only the owner's packs, most recently updated first", async () => {
    const owner = newId();
    const a = await createPack(owner, input({ name: "A" }));
    await createPack(owner, input({ name: "B" }));
    await createPack(newId(), input({ name: "Not mine" }));
    await updatePack(a.slug, owner, input({ name: "A2" }));
    const { packs } = await listPacks(owner);
    expect(packs.map((p) => p.name)).toEqual(["A2", "B"]);
    expect(packs[0]).toMatchObject({ slotCount: 2, visibility: "unlisted" });
  });
});

describe("updatePack / deletePack", () => {
  it("lets only the owner update", async () => {
    const owner = newId();
    const created = await createPack(owner, input());
    expect(await updatePack(created.slug, newId(), input({ name: "Hijacked" }))).toBeNull();
    const updated = await updatePack(
      created.slug,
      owner,
      input({ name: "Renamed", visibility: "private" }),
    );
    expect(updated).toMatchObject({ name: "Renamed", visibility: "private", slug: created.slug });
    expect(Date.parse(updated?.updatedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(created.updatedAt),
    );
  });

  it("lets only the owner delete", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input());
    expect(await deletePack(slug, newId())).toBe(false);
    expect(await deletePack(slug, owner)).toBe(true);
    expect(await getPackForViewer(slug, owner)).toBeNull();
    expect(await deletePack(slug, owner)).toBe(false);
  });
});

const CUSTOM_BUCKETS = [
  { code: "TB" as const },
  { code: "NM" as const },
  { code: "HD" as const },
  { code: "HR" as const },
  { code: "EZ", color: 0 },
  { code: "DT" as const },
  { code: "FM" as const },
];

describe("buckets", () => {
  it("stores custom buckets, their order, and no-slot maps, and gives them back", async () => {
    const owner = newId();
    const created = await createPack(
      owner,
      input({
        slots: [
          { mod: null, index: 1, beatmapId: 5 },
          { mod: "EZ", index: 1, beatmapId: 6 },
        ],
        buckets: CUSTOM_BUCKETS,
      }),
    );
    expect(created.buckets).toEqual(CUSTOM_BUCKETS);
    const found = await getPackForViewer(created.slug, owner);
    expect(found?.pack.buckets).toEqual(CUSTOM_BUCKETS);
    expect(found?.pack.slots).toContainEqual({ mod: null, index: 1, beatmapId: 5 });
  });

  it("drops the list when an update goes back to the default buckets", async () => {
    const owner = newId();
    const created = await createPack(owner, input({ slots: [], buckets: CUSTOM_BUCKETS }));
    const updated = await updatePack(created.slug, owner, input());
    expect(updated?.buckets).toBeUndefined();
    const raw = await getDb().collection("packs").findOne({ slug: created.slug });
    expect(raw).not.toHaveProperty("buckets");
  });

  it("stores an explicitly sent default list as no list at all", async () => {
    const created = await createPack(
      newId(),
      input({
        buckets: [
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "TB" },
        ],
      }),
    );
    expect(created.buckets).toBeUndefined();
  });

  it("still loads a pack saved before buckets existed", async () => {
    const owner = new ObjectId();
    await getDb()
      .collection("packs")
      .insertOne({
        slug: "oldpackabc",
        ownerId: owner,
        name: "Old",
        slots: [{ mod: "HD", index: 1, beatmapId: 5 }],
        visibility: "unlisted",
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-01T00:00:00Z"),
      });
    const found = await getPackForViewer("oldpackabc", null);
    expect(found?.pack).toMatchObject({
      name: "Old",
      slots: [{ mod: "HD", index: 1, beatmapId: 5 }],
    });
    expect(found?.pack.buckets).toBeUndefined();
  });

  it("stores a custom slot's mods and gives them back", async () => {
    const owner = newId();
    const buckets = [
      { code: "NM" as const },
      { code: "HD" as const },
      { code: "HR" as const },
      { code: "DT" as const },
      { code: "FM" as const },
      {
        code: "EZ",
        color: 0,
        mods: { kind: "forced" as const, set: ["EZ" as const, "HD" as const] },
      },
      { code: "Any", color: 1, mods: { kind: "free" as const } },
      { code: "Plain", color: 2 },
      { code: "TB" as const },
    ];
    const created = await createPack(owner, input({ buckets }));
    expect(created.buckets).toEqual(buckets);
    expect((await getPackForViewer(created.slug, owner))?.pack.buckets).toEqual(buckets);
    const raw = await getDb().collection("packs").findOne({ slug: created.slug });
    expect(raw?.buckets[5].mods).toEqual({ kind: "forced", set: ["EZ", "HD"] });
    expect(raw?.buckets[7]).not.toHaveProperty("mods");
  });
});

const hide = (slug: string) =>
  getPackModel().updateOne(
    { slug },
    { $set: { hiddenAt: new Date("2026-09-22T12:00:00Z"), hiddenBy: new ObjectId() } },
  );

describe("descriptions", () => {
  it("stores a description and clears it when an update sends an empty one", async () => {
    const owner = newId();
    const created = await createPack(owner, input({ description: "Quals pool" }));
    expect(created.description).toBe("Quals pool");
    const cleared = await updatePack(created.slug, owner, input({ description: "" }));
    expect(cleared?.description).toBeUndefined();
    const doc = await getPackModel().findOne({ slug: created.slug }).lean();
    expect(doc && "description" in doc).toBe(false);
  });

  it("clears it when an update leaves it out (PUT replaces the pack)", async () => {
    const owner = newId();
    const created = await createPack(owner, input({ description: "Quals pool" }));
    expect((await updatePack(created.slug, owner, input()))?.description).toBeUndefined();
  });
});

describe("hidden packs", () => {
  it("shows a hidden pack only to its owner and admins", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input({ visibility: "public" }));
    await hide(slug);
    expect(await getPackForViewer(slug, null)).toBeNull();
    expect(await getPackForViewer(slug, newId())).toBeNull();
    expect((await getPackForViewer(slug, owner))?.pack.hiddenAt).toBe("2026-09-22T12:00:00.000Z");
    expect(await getPackForViewer(slug, newId(), { isAdmin: true })).toMatchObject({
      isOwner: false,
    });
  });

  it("never shows a private pack to an admin", async () => {
    const { slug } = await createPack(newId(), input({ visibility: "private" }));
    expect(await getPackForViewer(slug, newId(), { isAdmin: true })).toBeNull();
  });

  it("stays hidden when its owner edits it or makes it public again", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input({ visibility: "public" }));
    await hide(slug);
    await updatePack(slug, owner, input({ visibility: "private" }));
    const republished = await updatePack(slug, owner, input({ visibility: "public" }));
    expect(republished?.hiddenAt).toBe("2026-09-22T12:00:00.000Z");
    expect(await getPackForViewer(slug, null)).toBeNull();
  });

  it("is marked hidden in its owner's list", async () => {
    const owner = newId();
    const hidden = await createPack(owner, input({ name: "Hidden", visibility: "public" }));
    await createPack(owner, input({ name: "Shown" }));
    await hide(hidden.slug);
    const { packs: list } = await listPacks(owner);
    expect(list.find((p) => p.name === "Hidden")?.hidden).toBe(true);
    expect(list.find((p) => p.name === "Shown")).not.toHaveProperty("hidden");
  });
});

describe("public list revalidation", () => {
  const revalidated = () =>
    vi.mocked(revalidatePath).mock.calls.some(([path]) => path === "/(public)/packs");
  beforeEach(() => vi.mocked(revalidatePath).mockClear());

  it("revalidates when a public pack is created, never for others", async () => {
    await createPack(newId(), input({ visibility: "unlisted" }));
    await createPack(newId(), input({ visibility: "private" }));
    expect(revalidated()).toBe(false);
    await createPack(newId(), input({ visibility: "public" }));
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("revalidates an update when the pack was or becomes public", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, input());
    await updatePack(slug, owner, input({ name: "Renamed" }));
    expect(revalidated()).toBe(false);
    await updatePack(slug, owner, input({ visibility: "public" }));
    expect(revalidated()).toBe(true);
    vi.mocked(revalidatePath).mockClear();
    await updatePack(slug, owner, input({ visibility: "private" }));
    expect(revalidated()).toBe(true);
  });

  it("revalidates a delete only for a public pack", async () => {
    const owner = newId();
    const unlisted = await createPack(owner, input());
    const listed = await createPack(owner, input({ visibility: "public" }));
    vi.mocked(revalidatePath).mockClear();
    await deletePack(unlisted.slug, owner);
    expect(revalidated()).toBe(false);
    await deletePack(listed.slug, owner);
    expect(revalidated()).toBe(true);
  });

  it("revalidates when a deleted account had a public pack", async () => {
    const quiet = newId();
    await createPack(quiet, input());
    const loud = newId();
    await createPack(loud, input({ visibility: "public" }));
    vi.mocked(revalidatePath).mockClear();
    await deleteAccount(quiet);
    expect(revalidated()).toBe(false);
    await deleteAccount(loud);
    expect(revalidated()).toBe(true);
  });
});

describe("saved-pack limit", () => {
  const fill = async (ownerId: string, count: number) => {
    const model = await getPackModel();
    const now = Date.now();
    await model.insertMany(
      Array.from({ length: count }, (_, i) => ({
        slug: `s${String(i).padStart(9, "0")}`,
        ownerId,
        name: `P${i}`,
        slots: input().slots,
        visibility: "private",
        createdAt: new Date(now - i * 1000),
        updatedAt: new Date(now - i * 1000),
      })),
    );
  };

  it("stops a normal account at MAX_SAVED_PACKS", async () => {
    const owner = newId();
    await fill(owner, MAX_SAVED_PACKS);
    await expect(createPack(owner, input())).rejects.toBeInstanceOf(PackLimitError);
  });

  it("lets an admin save past it", async () => {
    const owner = newId();
    await fill(owner, MAX_SAVED_PACKS);
    const pack = await createPack(owner, input(), { unlimited: true });
    expect(pack.name).toBe("SPC Finals");
  });
});

describe("listPacks paging", () => {
  it("returns every pack exactly once, newest first, with a total", async () => {
    const owner = newId();
    const model = await getPackModel();
    const now = Date.now();
    await model.insertMany(
      Array.from({ length: OWN_PAGE_SIZE + 7 }, (_, i) => ({
        slug: `p${String(i).padStart(9, "0")}`,
        ownerId: owner,
        name: `P${i}`,
        slots: input().slots,
        visibility: "private",
        createdAt: new Date(now - i * 1000),
        updatedAt: new Date(now - i * 1000),
      })),
    );
    const first = await listPacks(owner, 1);
    const second = await listPacks(owner, 2);
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: OWN_PAGE_SIZE + 7 });
    expect(first.packs).toHaveLength(OWN_PAGE_SIZE);
    expect(second.packs).toHaveLength(7);
    const slugs = [...first.packs, ...second.packs].map((pack) => pack.slug);
    expect(new Set(slugs).size).toBe(OWN_PAGE_SIZE + 7);
    expect(first.packs[0]?.name).toBe("P0");
  });
});
