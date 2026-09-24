/**
 * @file tests/unit/lib/storage/drafts.test.ts
 * @desc Draft persistence round trip and corrupt-data handling (fake IndexedDB).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "fake-indexeddb/auto";
import { set } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, DRAFT_KEY, loadDraft, saveDraft } from "@/lib/storage/drafts";

const PACK = { name: "SPC", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };

describe("drafts", () => {
  beforeEach(async () => {
    await clearDraft();
  });

  it("returns null when nothing is saved", async () => {
    expect(await loadDraft()).toBeNull();
  });

  it("round-trips a draft, including an empty name", async () => {
    await saveDraft(PACK);
    expect(await loadDraft()).toEqual(PACK);
    await saveDraft({ name: "", slots: [] });
    expect(await loadDraft()).toEqual({ name: "", slots: [] });
  });

  it("treats corrupt stored data as no draft", async () => {
    await set(DRAFT_KEY, { name: 5, slots: "nope" });
    expect(await loadDraft()).toBeNull();
  });

  it("clears the draft", async () => {
    await saveDraft(PACK);
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });
});
