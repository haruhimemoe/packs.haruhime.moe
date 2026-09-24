/**
 * @file src/hooks/usePackDraft.ts
 * @desc The builder's draft pack: reducer over Pool, hydrated from IndexedDB on mount, saved
 *       (debounced) after every change once hydrated. Storage failures never break editing. A
 *       rename keeps no lone surrogate (each becomes U+FFFD), so the key encoder can't throw.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import {
  addBucket,
  addBuckets,
  addSlot,
  mergeSlots,
  moveBucket,
  moveSlot,
  recolorBucket,
  removeBucket,
  removeSlot,
  renameBucket,
  type SlotMods,
  setBucketMods,
} from "@haruhimemoe/pool";
import { type Dispatch, useEffect, useReducer, useState } from "react";
import { DEFAULT_PACK_NAME, MAX_NAME_LENGTH } from "@/constants/pack";
import { loadDraft, saveDraft } from "@/lib/storage/drafts";
import type { CustomBucket, Pool, PoolSlot, SlotBucket } from "@/schemas/pack";

export type DraftAction =
  | { type: "rename"; name: string }
  | { type: "add"; mod: SlotBucket; beatmapId: number }
  | { type: "remove"; mod: SlotBucket; index: number }
  | { type: "move-slot"; mod: SlotBucket; index: number; to: SlotBucket }
  | { type: "merge"; slots: PoolSlot[]; newBuckets?: CustomBucket[] }
  | { type: "add-bucket"; code: string; color: number }
  | { type: "rename-bucket"; code: string; next: string }
  | { type: "recolor-bucket"; code: string; color: number }
  | { type: "move-bucket"; code: string; to: number }
  | { type: "remove-bucket"; code: string }
  | { type: "set-bucket-mods"; code: string; mods: SlotMods }
  | { type: "replace"; pack: Pool }
  | { type: "reset" };

export const EMPTY_DRAFT: Pool = { name: DEFAULT_PACK_NAME, slots: [] };

/** With the u flag, \p{Cs} matches only a surrogate that isn't half of a pair. */
const LONE_SURROGATE = /\p{Cs}/gu;

/**
 * @function clampName
 * @param name {string} what the name field holds
 * @returns {string} cut to the key's name limit (UTF-16 units) without leaving half an emoji
 *          behind, and every other lone surrogate replaced with U+FFFD. The key codec refuses a
 *          lone surrogate; U+FFFD is what TextEncoder turned one into at aa9ae4a, so such a name
 *          keeps the key it always had.
 */
const clampName = (name: string): string => {
  const cut = name.slice(0, MAX_NAME_LENGTH);
  const last = cut.charCodeAt(cut.length - 1);
  const whole =
    cut.length < name.length && last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
  return whole.replace(LONE_SURROGATE, "\uFFFD");
};

/**
 * @function draftReducer
 * @param state {Pool} current draft
 * @param action {DraftAction} edit
 * @returns {Pool} next draft
 */
export const draftReducer = (state: Pool, action: DraftAction): Pool => {
  switch (action.type) {
    case "rename":
      return { ...state, name: clampName(action.name) };
    case "add":
      return addSlot(state, action.mod, action.beatmapId);
    case "remove":
      return removeSlot(state, action.mod, action.index);
    case "move-slot":
      return moveSlot(state, { mod: action.mod, index: action.index }, action.to);
    case "merge":
      // Pasted lines can name buckets that don't exist yet: create them first.
      return mergeSlots(addBuckets(state, action.newBuckets ?? []), action.slots);
    case "add-bucket":
      return addBucket(state, action.code, action.color);
    case "rename-bucket":
      return renameBucket(state, action.code, action.next);
    case "recolor-bucket":
      return recolorBucket(state, action.code, action.color);
    case "move-bucket":
      return moveBucket(state, action.code, action.to);
    case "remove-bucket":
      return removeBucket(state, action.code);
    case "set-bucket-mods":
      return setBucketMods(state, action.code, action.mods);
    case "replace":
      return action.pack;
    case "reset":
      return EMPTY_DRAFT;
  }
};

/**
 * @function usePackDraft
 * @param options {{ saveDelayMs?: number }} debounce for autosave (default 300ms)
 * @returns {{ pack: Pool; hydrated: boolean; dispatch: Dispatch<DraftAction> }}
 */
export const usePackDraft = ({
  saveDelayMs = 300,
}: {
  saveDelayMs?: number;
} = {}): {
  pack: Pool;
  hydrated: boolean;
  dispatch: Dispatch<DraftAction>;
} => {
  const [pack, dispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    loadDraft().then((draft) => {
      if (!active) return;
      if (draft) dispatch({ type: "replace", pack: draft });
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveDraft(pack).catch(() => {
        // No IndexedDB (private window etc.): keep editing without persistence.
      });
    }, saveDelayMs);
    return () => clearTimeout(timer);
  }, [pack, hydrated, saveDelayMs]);

  return { pack, hydrated, dispatch };
};
