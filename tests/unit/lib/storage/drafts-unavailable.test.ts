/**
 * @file tests/unit/lib/storage/drafts-unavailable.test.ts
 * @desc With no IndexedDB (private windows, locked-down browsers) drafts degrade to "none" instead
 *       of throwing. Separate file so idb-keyval's cached store never sees fake-indexeddb.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { loadDraft, saveDraft } from "@/lib/storage/drafts";

describe("drafts without IndexedDB", () => {
  it("has no indexedDB in this environment", () => {
    expect(globalThis.indexedDB).toBeUndefined();
  });

  it("loads null and saving rejects (callers swallow it)", async () => {
    expect(await loadDraft()).toBeNull();
    await expect(saveDraft({ name: "x", slots: [] })).rejects.toBeDefined();
  });
});
