/**
 * @file tests/integration/services/pack-page-revalidation.test.ts
 * @desc Every change that alters /p/[slug] revalidates that slug's cached page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackInput } from "@/schemas/saved-pack";
import { deleteAccount } from "@/services/account";
import { adminDeletePack, setPackHidden } from "@/services/moderation";
import { addMagnet, removeMagnet } from "@/services/pack-exports";
import { createPack, deletePack, updatePack } from "@/services/packs";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const newId = () => new ObjectId().toHexString();
const INPUT: PackInput = {
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  visibility: "unlisted",
};
const KEY = encodePackKey({ name: INPUT.name, slots: INPUT.slots });
const MAGNET = `magnet:?xt=urn:btih:${"a".repeat(40)}&dn=SPC`;
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path);

describe("pack page revalidation", () => {
  beforeEach(() => vi.mocked(revalidatePath).mockClear());

  it("revalidates on update, even for a private pack", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, { ...INPUT, visibility: "private" });
    await updatePack(slug, owner, { ...INPUT, visibility: "private", name: "Renamed" });
    expect(paths()).toContain(`/p/${slug}`);
  });

  it("revalidates on delete", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, INPUT);
    await deletePack(slug, owner);
    expect(paths()).toContain(`/p/${slug}`);
  });

  it("revalidates on hide, unhide, and admin delete", async () => {
    const { slug } = await createPack(newId(), INPUT);
    await setPackHidden(slug, newId(), true);
    expect(paths()).toContain(`/p/${slug}`);
    vi.mocked(revalidatePath).mockClear();
    await setPackHidden(slug, newId(), false);
    expect(paths()).toContain(`/p/${slug}`);
    vi.mocked(revalidatePath).mockClear();
    await adminDeletePack(slug);
    expect(paths()).toContain(`/p/${slug}`);
  });

  it("revalidates when a magnet link is added or removed", async () => {
    const owner = newId();
    const { slug } = await createPack(owner, INPUT);
    await addMagnet(slug, owner, { url: MAGNET, packKey: KEY });
    expect(paths()).toContain(`/p/${slug}`);
    vi.mocked(revalidatePath).mockClear();
    await removeMagnet(slug, owner, MAGNET);
    expect(paths()).toContain(`/p/${slug}`);
  });

  it("revalidates every pack of a deleted account", async () => {
    const owner = newId();
    const a = await createPack(owner, INPUT);
    const b = await createPack(owner, { ...INPUT, visibility: "private" });
    await deleteAccount(owner);
    expect(paths()).toEqual(expect.arrayContaining([`/p/${a.slug}`, `/p/${b.slug}`]));
  });

  it("does nothing for a change that didn't happen", async () => {
    await deletePack("abcdefghij", newId());
    await setPackHidden("abcdefghij", newId(), true);
    expect(paths()).toEqual([]);
  });
});
