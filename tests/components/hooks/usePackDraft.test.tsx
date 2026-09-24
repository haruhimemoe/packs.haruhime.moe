/**
 * @file tests/components/hooks/usePackDraft.test.tsx
 * @desc usePackDraft: reducer actions (a lone surrogate in a name becomes U+FFFD, the bytes the
 *       aa9ae4a key codec wrote), hydration from IndexedDB, and debounced saving.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "fake-indexeddb/auto";
import { encodePackKey } from "@haruhimemoe/pool";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { draftReducer, EMPTY_DRAFT, usePackDraft } from "@/hooks/usePackDraft";
import { clearDraft, loadDraft, saveDraft } from "@/lib/storage/drafts";

describe("draftReducer", () => {
  it("applies each action", () => {
    let state = draftReducer(EMPTY_DRAFT, { type: "rename", name: "Quals" });
    state = draftReducer(state, { type: "add", mod: "NM", beatmapId: 10 });
    state = draftReducer(state, { type: "add", mod: "NM", beatmapId: 20 });
    state = draftReducer(state, { type: "merge", slots: [{ mod: "TB", index: 1, beatmapId: 30 }] });
    state = draftReducer(state, { type: "remove", mod: "NM", index: 1 });
    expect(state).toEqual({
      name: "Quals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 20 },
        { mod: "TB", index: 1, beatmapId: 30 },
      ],
    });
    expect(draftReducer(state, { type: "reset" })).toEqual(EMPTY_DRAFT);
    const other = { name: "x", slots: [] };
    expect(draftReducer(state, { type: "replace", pack: other })).toBe(other);
  });
});

describe("draftReducer rename", () => {
  it("clamps names to the key limit without splitting an emoji", () => {
    expect(draftReducer(EMPTY_DRAFT, { type: "rename", name: "x".repeat(70) }).name).toHaveLength(
      64,
    );
    const name = draftReducer(EMPTY_DRAFT, { type: "rename", name: `${"x".repeat(63)}🌸` }).name;
    expect(name).toBe("x".repeat(63));
  });

  it.each([
    ["a trailing high surrogate", "a\uD83D", "a\uFFFD"],
    ["a leading low surrogate", "\uDC00x", "\uFFFDx"],
    ["one at the limit", `${"x".repeat(63)}\uD83D`, `${"x".repeat(63)}\uFFFD`],
  ])("replaces %s with U+FFFD", (_, input, expected) => {
    const name = draftReducer(EMPTY_DRAFT, { type: "rename", name: input }).name;
    expect(name).toBe(expected);
    expect(name).not.toMatch(/\p{Cs}/u);
  });

  it("keeps a whole emoji", () => {
    expect(draftReducer(EMPTY_DRAFT, { type: "rename", name: "🌸 pool" }).name).toBe("🌸 pool");
  });

  it("gives a name with a lone surrogate the key the aa9ae4a codec made", () => {
    const named = draftReducer(EMPTY_DRAFT, { type: "rename", name: "a\uD83D" });
    const pool = draftReducer(named, { type: "add", mod: "NM", beatmapId: 129891 });
    // Recorded by running src/utils/pack-key.ts at aa9ae4a on { name: "a\uD83D", NM1 129891 }.
    expect(encodePackKey(pool)).toBe("pk1.AQRh77-9AQAB4_YHVE4");
  });
});

describe("draftReducer buckets", () => {
  it("creates pasted buckets before merging their maps, then edits buckets and moves maps", () => {
    let state = draftReducer(EMPTY_DRAFT, {
      type: "merge",
      slots: [
        { mod: "EZ", index: 1, beatmapId: 1 },
        { mod: null, index: 1, beatmapId: 2 },
      ],
      newBuckets: [{ code: "EZ", color: 0 }],
    });
    expect(state.slots).toEqual([
      { mod: null, index: 1, beatmapId: 2 },
      { mod: "EZ", index: 1, beatmapId: 1 },
    ]);
    state = draftReducer(state, { type: "add-bucket", code: "HT", color: 1 });
    state = draftReducer(state, { type: "rename-bucket", code: "EZ", next: "Easy" });
    state = draftReducer(state, { type: "recolor-bucket", code: "Easy", color: 5 });
    state = draftReducer(state, { type: "move-bucket", code: "HT", to: 0 });
    state = draftReducer(state, { type: "move-slot", mod: null, index: 1, to: "HT" });
    state = draftReducer(state, { type: "add", mod: null, beatmapId: 3 });
    expect(state.buckets?.map((b) => b.code)).toEqual([
      "HT",
      "NM",
      "HD",
      "HR",
      "DT",
      "FM",
      "Easy",
      "TB",
    ]);
    expect(state.buckets?.find((b) => b.code === "Easy")).toEqual({ code: "Easy", color: 5 });
    expect(state.slots).toEqual([
      { mod: null, index: 1, beatmapId: 3 },
      { mod: "HT", index: 1, beatmapId: 2 },
      { mod: "Easy", index: 1, beatmapId: 1 },
    ]);
    state = draftReducer(state, { type: "remove", mod: "HT", index: 1 });
    state = draftReducer(state, { type: "remove-bucket", code: "HT" });
    expect(state.buckets?.some((b) => b.code === "HT")).toBe(false);
  });
});

describe("draftReducer set-bucket-mods", () => {
  it("sets and clears a custom slot's mods", () => {
    const withEz = draftReducer(EMPTY_DRAFT, { type: "add-bucket", code: "EZ", color: 0 });
    const forced = draftReducer(withEz, {
      type: "set-bucket-mods",
      code: "EZ",
      mods: { kind: "forced", set: ["EZ"] },
    });
    expect(forced.buckets?.find((b) => b.code === "EZ")).toEqual({
      code: "EZ",
      color: 0,
      mods: { kind: "forced", set: ["EZ"] },
    });
    const cleared = draftReducer(forced, {
      type: "set-bucket-mods",
      code: "EZ",
      mods: { kind: "none" },
    });
    expect(cleared.buckets?.find((b) => b.code === "EZ")).toEqual({ code: "EZ", color: 0 });
  });
});

describe("usePackDraft", () => {
  beforeEach(async () => {
    await clearDraft();
  });

  it("starts empty and hydrates when nothing is saved", async () => {
    const { result } = renderHook(() => usePackDraft({ saveDelayMs: 0 }));
    expect(result.current.hydrated).toBe(false);
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.pack).toEqual(EMPTY_DRAFT);
  });

  it("hydrates a saved draft", async () => {
    await saveDraft({ name: "Saved", slots: [{ mod: "HD", index: 1, beatmapId: 5 }] });
    const { result } = renderHook(() => usePackDraft({ saveDelayMs: 0 }));
    await waitFor(() => expect(result.current.pack.name).toBe("Saved"));
  });

  it("saves changes after hydration", async () => {
    const { result } = renderHook(() => usePackDraft({ saveDelayMs: 0 }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => result.current.dispatch({ type: "add", mod: "DT", beatmapId: 42 }));
    await waitFor(async () =>
      expect(await loadDraft()).toEqual({
        name: EMPTY_DRAFT.name,
        slots: [{ mod: "DT", index: 1, beatmapId: 42 }],
      }),
    );
  });
});
