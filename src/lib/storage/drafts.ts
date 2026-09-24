/**
 * @file src/lib/storage/drafts.ts
 * @desc The builder's single autosaved draft, in IndexedDB via idb-keyval. Identity only; metadata
 *       is refetched. A missing or broken IndexedDB means "no draft", never an error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { del, get, set } from "idb-keyval";
import { type Pool, poolDraftSchema } from "@/schemas/pack";

export const DRAFT_KEY = "packs:draft:v1";

/**
 * @function loadDraft
 * @returns {Promise<Pool | null>} the saved draft, or null if none, corrupt, or storage is unavailable
 */
export const loadDraft = async (): Promise<Pool | null> => {
  try {
    const parsed = poolDraftSchema.safeParse(await get(DRAFT_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * @function saveDraft
 * @param pack {Pool} draft to persist
 * @returns {Promise<void>} rejects when storage is unavailable (callers decide whether to care)
 */
export const saveDraft = async (pack: Pool): Promise<void> => {
  // async so a missing IndexedDB (idb-keyval throws synchronously) becomes a rejection
  await set(DRAFT_KEY, pack);
};

/**
 * @function clearDraft
 * @returns {Promise<void>} resolves once the draft is gone
 */
export const clearDraft = async (): Promise<void> => {
  await del(DRAFT_KEY);
};
