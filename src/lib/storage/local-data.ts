/**
 * @file src/lib/storage/local-data.ts
 * @desc "Clear local data" (privacy policy): deletes the IndexedDB draft, the OPFS .osz cache and
 *       the saved download options.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { clearDownloadChoices } from "@/lib/storage/download-choices";
import { clearDraft } from "@/lib/storage/drafts";
import { type OszCache, oszCache } from "@/lib/storage/osz-cache";

/** Fired on window before anything is deleted, so open export panels drop files that are going away. */
export const LOCAL_DATA_CLEARING_EVENT = "packs:local-data-clearing";

type LocalDataDeps = {
  clearDraft: () => Promise<void>;
  cache: Pick<OszCache, "clear">;
  clearChoices?: () => void;
  notify?: () => void;
};

const notifyPage = (): void => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_DATA_CLEARING_EVENT));
};

// No IndexedDB means no draft was ever stored: nothing to clear.
const clearDraftIfStored = (): Promise<void> =>
  typeof indexedDB === "undefined" ? Promise.resolve() : clearDraft();

/**
 * @function clearLocalData
 * @param deps {LocalDataDeps} injectable for tests
 * @returns {Promise<void>} rejects if either store couldn't be cleared; open pages are told first
 */
export const clearLocalData = async (
  deps: LocalDataDeps = {
    clearDraft: clearDraftIfStored,
    cache: oszCache,
    clearChoices: clearDownloadChoices,
    notify: notifyPage,
  },
): Promise<void> => {
  deps.notify?.();
  deps.clearChoices?.();
  await Promise.all([deps.clearDraft(), deps.cache.clear()]);
};
