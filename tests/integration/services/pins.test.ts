/**
 * @file tests/integration/services/pins.test.ts
 * @desc Pinned packs: pin (public and not hidden only, at most MAX_PINNED_PACKS, new pins last,
 *       racing pins never pass the limit), unpin, reorder, the admin list, and the pins a hide or
 *       a change away from public takes away. Pin writes never move updatedAt. The pin queries
 *       use the partial pin index, never a collection scan.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import { setPackHidden } from "@/services/moderation";
import { createPack, updatePack } from "@/services/packs";
import {
  isPackPinned,
  listPinnedForAdmin,
  PIN_SORT,
  PINNED,
  PinRefusedError,
  pinPack,
  reorderPins,
  unpinPack,
} from "@/services/pins";
import { PIN_HIDDEN, PIN_LIMIT, PIN_PUBLIC_ONLY, PINS_CHANGED } from "@/utils/pins";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const input = (overrides: Partial<PackInput> = {}): PackInput => ({
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  visibility: "public",
  ...overrides,
});

const newHost = () => createTestUser({ username: "host" });

/** Public packs named "Pack 0", "Pack 1", … for one host. */
const publicPacks = async (count: number): Promise<string[]> => {
  const host = await newHost();
  const slugs: string[] = [];
  for (let i = 0; i < count; i++) {
    slugs.push((await createPack(host.id, input({ name: `Pack ${i}` }))).slug);
  }
  return slugs;
};

const pinnedNames = async () => (await listPinnedForAdmin()).map((pin) => pin.name);

const refusal = async (promise: Promise<unknown>): Promise<string> => {
  const error = await promise.then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(PinRefusedError);
  return (error as Error).message;
};

beforeEach(() => vi.mocked(revalidatePath).mockClear());

describe("pinPack", () => {
  it("pins a public pack and answers the pinned list, new pins last", async () => {
    const [first, second] = await publicPacks(2);
    const pins = await pinPack(first as string);
    expect(pins).toEqual([
      { slug: first, name: "Pack 0", ownerName: "host", pinnedAt: expect.any(String) },
    ]);
    expect((await pinPack(second as string))?.map((pin) => pin.name)).toEqual(["Pack 0", "Pack 1"]);
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
  });

  it("never moves updatedAt", async () => {
    const [slug] = await publicPacks(1);
    const before = await getPackModel().findOne({ slug }).lean();
    await pinPack(slug as string);
    const after = await getPackModel().findOne({ slug }).lean();
    expect(after?.updatedAt.toISOString()).toBe(before?.updatedAt.toISOString());
    expect(after?.pinnedAt).toBeInstanceOf(Date);
    expect(after?.pinOrder).toBe(0);
  });

  it("leaves a pinned pack where it is when pinned again", async () => {
    const [a, b] = await publicPacks(2);
    await pinPack(a as string);
    await pinPack(b as string);
    const first = await getPackModel().findOne({ slug: a }).lean();
    vi.mocked(revalidatePath).mockClear();
    expect((await pinPack(a as string))?.map((pin) => pin.slug)).toEqual([a, b]);
    const again = await getPackModel().findOne({ slug: a }).lean();
    expect(again?.pinnedAt?.toISOString()).toBe(first?.pinnedAt?.toISOString());
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses unlisted and hidden packs", async () => {
    const host = await newHost();
    const unlisted = await createPack(host.id, input({ visibility: "unlisted" }));
    const hidden = await createPack(host.id, input());
    await setPackHidden(hidden.slug, new ObjectId().toHexString(), true);
    expect(await refusal(pinPack(unlisted.slug))).toBe(PIN_PUBLIC_ONLY);
    expect(await refusal(pinPack(hidden.slug))).toBe(PIN_HIDDEN);
    expect(await listPinnedForAdmin()).toEqual([]);
  });

  it("is null for private, unknown, and malformed slugs", async () => {
    const host = await newHost();
    const secret = await createPack(host.id, input({ visibility: "private" }));
    expect(await pinPack(secret.slug)).toBeNull();
    expect(await pinPack("zzzzzzzzzz")).toBeNull();
    expect(await pinPack("../etc")).toBeNull();
    expect((await getPackModel().findOne({ slug: secret.slug }).lean())?.pinnedAt).toBeUndefined();
  });

  it(`refuses a pin past ${MAX_PINNED_PACKS} with a clear message`, async () => {
    const slugs = await publicPacks(MAX_PINNED_PACKS + 1);
    for (const slug of slugs.slice(0, MAX_PINNED_PACKS)) await pinPack(slug);
    const extra = slugs[MAX_PINNED_PACKS] as string;
    expect(await refusal(pinPack(extra))).toBe(PIN_LIMIT);
    expect(await listPinnedForAdmin()).toHaveLength(MAX_PINNED_PACKS);
    expect(await isPackPinned(extra)).toBe(false);
  });

  it("never lets racing pins pass the limit", async () => {
    const slugs = await publicPacks(MAX_PINNED_PACKS + 1);
    for (const slug of slugs.slice(0, MAX_PINNED_PACKS - 1)) await pinPack(slug);
    const racing = slugs.slice(MAX_PINNED_PACKS - 1);
    const results = await Promise.allSettled(racing.map((slug) => pinPack(slug)));
    const refused = results.flatMap((result, i) => (result.status === "rejected" ? [i] : []));
    // Both can back out; both can never stay.
    expect(refused.length).toBeGreaterThanOrEqual(1);
    for (const i of refused) {
      const reason = (results[i] as PromiseRejectedResult).reason as Error;
      expect(reason).toBeInstanceOf(PinRefusedError);
      expect(reason.message).toBe(PIN_LIMIT);
      expect(await isPackPinned(racing[i] as string)).toBe(false);
    }
    expect(await getPackModel().countDocuments({ pinnedAt: { $exists: true } })).toBe(
      MAX_PINNED_PACKS - refused.length + 1,
    );
  });
});

describe("unpinPack", () => {
  it("unpins and answers the rest in order, without moving updatedAt", async () => {
    const [a, b, c] = (await publicPacks(3)) as [string, string, string];
    for (const slug of [a, b, c]) await pinPack(slug);
    const before = await getPackModel().findOne({ slug: b }).lean();
    vi.mocked(revalidatePath).mockClear();
    expect((await unpinPack(b))?.map((pin) => pin.slug)).toEqual([a, c]);
    const after = await getPackModel().findOne({ slug: b }).lean();
    expect(after && "pinnedAt" in after).toBe(false);
    expect(after && "pinOrder" in after).toBe(false);
    expect(after?.updatedAt.toISOString()).toBe(before?.updatedAt.toISOString());
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
  });

  it("answers the list unchanged for a pack that isn't pinned", async () => {
    const [a, b] = (await publicPacks(2)) as [string, string];
    await pinPack(a);
    vi.mocked(revalidatePath).mockClear();
    expect((await unpinPack(b))?.map((pin) => pin.slug)).toEqual([a]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("is null for private, unknown, and malformed slugs", async () => {
    const host = await newHost();
    const secret = await createPack(host.id, input({ visibility: "private" }));
    expect(await unpinPack(secret.slug)).toBeNull();
    expect(await unpinPack("zzzzzzzzzz")).toBeNull();
    expect(await unpinPack("../etc")).toBeNull();
  });
});

describe("reorderPins", () => {
  it("puts the pinned packs in the order given", async () => {
    const [a, b, c] = (await publicPacks(3)) as [string, string, string];
    for (const slug of [a, b, c]) await pinPack(slug);
    vi.mocked(revalidatePath).mockClear();
    expect((await reorderPins([c, a, b])).map((pin) => pin.slug)).toEqual([c, a, b]);
    expect(await pinnedNames()).toEqual(["Pack 2", "Pack 0", "Pack 1"]);
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
    // A new pin still goes last.
    const [d] = (await publicPacks(1)) as [string];
    expect((await pinPack(d))?.map((pin) => pin.slug)).toEqual([c, a, b, d]);
  });

  it("refuses a list that isn't exactly the pinned packs", async () => {
    const [a, b, c] = (await publicPacks(3)) as [string, string, string];
    await pinPack(a);
    await pinPack(b);
    for (const slugs of [[a], [a, b, c], [b, b], [c, a]]) {
      expect(await refusal(reorderPins(slugs))).toBe(PINS_CHANGED);
    }
    expect((await listPinnedForAdmin()).map((pin) => pin.slug)).toEqual([a, b]);
  });

  it("accepts an empty list when nothing is pinned", async () => {
    expect(await reorderPins([])).toEqual([]);
  });
});

describe("listPinnedForAdmin", () => {
  it("keeps a pinned pack whose host record is gone, so it can still be unpinned", async () => {
    const [slug] = (await publicPacks(1)) as [string];
    await pinPack(slug);
    await getPackModel().collection.updateOne({ slug }, { $set: { ownerId: new ObjectId() } });
    expect(await listPinnedForAdmin()).toEqual([
      expect.objectContaining({ slug, ownerName: expect.any(String) }),
    ]);
  });
});

describe("what takes a pin away", () => {
  it("hiding a pack unpins it, and unhiding doesn't pin it again", async () => {
    const [slug] = (await publicPacks(1)) as [string];
    await pinPack(slug);
    await setPackHidden(slug, new ObjectId().toHexString(), true);
    expect(await isPackPinned(slug)).toBe(false);
    await setPackHidden(slug, new ObjectId().toHexString(), false);
    expect(await isPackPinned(slug)).toBe(false);
  });

  it.each(["unlisted", "private"] as const)(
    "changing a pack to %s unpins it",
    async (visibility) => {
      const host = await newHost();
      const pack = await createPack(host.id, input());
      await pinPack(pack.slug);
      vi.mocked(revalidatePath).mockClear();
      await updatePack(pack.slug, host.id, input({ visibility }));
      expect(await isPackPinned(pack.slug)).toBe(false);
      expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
    },
  );

  it("an edit that keeps a pack public keeps its pin and place", async () => {
    const host = await newHost();
    const first = await createPack(host.id, input({ name: "First" }));
    const second = await createPack(host.id, input({ name: "Second" }));
    await pinPack(first.slug);
    await pinPack(second.slug);
    await updatePack(first.slug, host.id, input({ name: "First, renamed" }));
    expect(await pinnedNames()).toEqual(["First, renamed", "Second"]);
  });
});

describe("pin queries", () => {
  /** The winning plan of an explain, as text: which stages and index it used. */
  const planText = (explain: unknown): string => JSON.stringify(explain);
  const PIN_INDEX = "pinOrder_1_pinnedAt_1__id_1";

  it("find pinned packs through the partial pin index, in pin order, with no collection scan", async () => {
    const model = getPackModel();
    await model.init();
    const ownerId = new ObjectId();
    const now = new Date();
    await model.collection.insertMany(
      Array.from({ length: 40 }, (_, i) => ({
        slug: `pinscan${String(i).padStart(3, "0")}`,
        ownerId,
        name: `Pack ${i}`,
        slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
        visibility: "public",
        createdAt: now,
        updatedAt: now,
        ...(i < 3 ? { pinnedAt: now, pinOrder: 2 - i } : {}),
      })),
    );
    const plans = [
      await model.collection.find(PINNED).explain("executionStats"),
      await model.collection.find(PINNED).sort(PIN_SORT).explain("executionStats"),
      await model.collection
        .aggregate([
          { $match: { ...PINNED, visibility: "public", hiddenAt: null } },
          { $sort: PIN_SORT },
        ])
        .explain("executionStats"),
      await model.collection
        .aggregate([{ $match: PINNED }, { $group: { _id: 1, n: { $sum: 1 } } }])
        .explain("executionStats"),
    ].map(planText);
    for (const plan of plans) {
      expect(plan).toContain(PIN_INDEX);
      expect(plan).not.toContain('"COLLSCAN"');
    }
    expect(plans[1]).not.toContain('"SORT"');
    expect(await model.collection.countDocuments(PINNED)).toBe(3);
    expect((await listPinnedForAdmin()).map((pin) => pin.slug)).toEqual([
      "pinscan002",
      "pinscan001",
      "pinscan000",
    ]);
  });
});
