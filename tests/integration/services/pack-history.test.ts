/**
 * @file tests/integration/services/pack-history.test.ts
 * @desc recordPackSave: a create makes a root, later saves append, a pre-history pack gets a root
 *       from its old content, an unchanged save writes nothing, and a pools-authored save carries
 *       the pools account.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { RevisionAuthor } from "@haruhimemoe/next-kit/vcs";
import { describe, expect, it } from "vitest";
import { packRevisions } from "@/lib/pack-revisions";
import { recordPackSave } from "@/services/pack-history";
import { snapshotOf } from "@/utils/pack-snapshot";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const AUTHOR: RevisionAuthor = { id: "u1", name: "player" };

describe("recordPackSave", () => {
  it("makes a root for a new pack (before: null)", async () => {
    const after = snapshotOf({ name: "Pack", slots: [{ mod: "NM", index: 1, beatmapId: 1 }] });
    await recordPackSave("slug1", null, after, AUTHOR);
    const head = await packRevisions.head("slug1");
    expect(head?.seq).toBe(0);
    expect(head?.value).toEqual(after);
  });

  it("appends later saves as seq 1, 2", async () => {
    const v0 = snapshotOf({ name: "Pack", slots: [] });
    await recordPackSave("slug2", null, v0, AUTHOR);
    const v1 = snapshotOf({ name: "Pack v2", slots: [] });
    await recordPackSave("slug2", v0, v1, AUTHOR);
    const v2 = snapshotOf({ name: "Pack v3", slots: [] });
    await recordPackSave("slug2", v1, v2, AUTHOR);
    const head = await packRevisions.head("slug2");
    expect(head?.seq).toBe(2);
  });

  it("gives a pre-history pack a root from its old content, then seq 1", async () => {
    const before = snapshotOf({ name: "Old", slots: [] });
    const after = snapshotOf({ name: "New", slots: [] });
    await recordPackSave("slug3", before, after, AUTHOR);
    const root = await packRevisions.get(
      "slug3",
      (await packRevisions.list("slug3")).at(-1)?.id ?? "",
    );
    expect(root?.value).toEqual(before);
    const head = await packRevisions.head("slug3");
    expect(head?.seq).toBe(1);
    expect(head?.value).toEqual(after);
  });

  it("writes nothing for an unchanged save", async () => {
    const value = snapshotOf({ name: "Same", slots: [] });
    await recordPackSave("slug4", null, value, AUTHOR);
    await recordPackSave("slug4", value, value, AUTHOR);
    const list = await packRevisions.list("slug4");
    expect(list).toHaveLength(1);
  });

  it("records a pools-authored save", async () => {
    const pools: RevisionAuthor = { id: "pools-id", name: "haruhime pools" };
    const after = snapshotOf({ name: "Pools pack", slots: [] });
    await recordPackSave("slug5", null, after, pools);
    const head = await packRevisions.head("slug5");
    expect(head?.authorId).toBe(pools.id);
    expect(head?.authorName).toBe(pools.name);
  });
});
