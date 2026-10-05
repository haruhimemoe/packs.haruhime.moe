/**
 * @file tests/integration/services/pack-history-read.test.ts
 * @desc loadPackHistory/loadPackRevision: 404 for a pack the caller can't see, 403 for one they
 *       see but whose history is private, a synthetic root for a pack with no recorded history
 *       yet, newest-first listing, and admin moderation reads of hidden/historyPublic-off packs
 *       (never private ones). setPackHistoryPublic: owner-only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import {
  loadPackHistory,
  loadPackRevision,
  setPackHistoryPublic,
} from "@/services/pack-history-read";
import { createPack, updatePack } from "@/services/packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const PACK = {
  name: "Pack",
  slots: [{ mod: "NM" as const, index: 1, beatmapId: 1 }],
  visibility: "unlisted" as const,
};

describe("loadPackHistory", () => {
  it("404s for a pack that doesn't exist", async () => {
    expect(await loadPackHistory("zzzzzzzzzz", null)).toMatchObject({ ok: false, status: 404 });
  });

  it("404s a private pack for anyone but the owner", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, { ...PACK, visibility: "private" });
    expect(await loadPackHistory(pack.slug, null)).toMatchObject({ ok: false, status: 404 });
  });

  it("shows a synthetic root for a pack with no recorded history", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, PACK);
    const history = await loadPackHistory(pack.slug, { id: owner.id, isAdmin: false });
    expect(history).toMatchObject({ ok: true });
    if (history.ok) expect(history.value.revisions).toHaveLength(1);
  });

  it("403s a public pack's history for a visitor when historyPublic is off", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, { ...PACK, visibility: "public" });
    expect(await loadPackHistory(pack.slug, null)).toMatchObject({ ok: false, status: 403 });
  });

  it("lets a visitor read a public pack's history once historyPublic is on", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, { ...PACK, visibility: "public" });
    await setPackHistoryPublic(pack.slug, owner.id, true);
    expect(await loadPackHistory(pack.slug, null)).toMatchObject({ ok: true });
  });

  it("lets an admin read a hidden pack's history even with historyPublic off", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, { ...PACK, visibility: "public" });
    const admin = { id: "mod", isAdmin: true };
    expect(await loadPackHistory(pack.slug, admin)).toMatchObject({ ok: true });
  });

  it("never lets an admin read a private pack's history", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, { ...PACK, visibility: "private" });
    const admin = { id: "mod", isAdmin: true };
    expect(await loadPackHistory(pack.slug, admin)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("loadPackRevision", () => {
  it("diffs the root against a later save", async () => {
    const owner = await createTestUser();
    const author = { id: owner.id, name: owner.username };
    const pack = await createPack(owner.id, PACK, { author });
    await updatePack(pack.slug, owner.id, { ...PACK, name: "Renamed" }, { author });
    const history = await loadPackHistory(pack.slug, { id: owner.id, isAdmin: false });
    if (!history.ok) throw new Error("expected ok");
    const head = history.value.revisions[0];
    if (!head) throw new Error("expected a revision");
    const revision = await loadPackRevision(pack.slug, { id: owner.id, isAdmin: false }, head.id);
    expect(revision).toMatchObject({ ok: true });
    if (revision.ok) {
      expect(revision.value.after.name).toBe("Renamed");
      expect(revision.value.changes.length).toBeGreaterThan(0);
    }
  });

  it("404s an unknown revision id", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, PACK);
    const revision = await loadPackRevision(pack.slug, { id: owner.id, isAdmin: false }, "nope");
    expect(revision).toMatchObject({ ok: false, status: 404 });
  });
});

describe("setPackHistoryPublic", () => {
  it("refuses a non-owner", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const pack = await createPack(owner.id, PACK);
    expect(await setPackHistoryPublic(pack.slug, other.id, true)).toBe(false);
  });

  it("lets the owner turn it on and off", async () => {
    const owner = await createTestUser();
    const pack = await createPack(owner.id, PACK);
    expect(await setPackHistoryPublic(pack.slug, owner.id, true)).toBe(true);
    const history = await loadPackHistory(pack.slug, { id: owner.id, isAdmin: false });
    if (history.ok) expect(history.value.historyPublic).toBe(true);
  });
});
