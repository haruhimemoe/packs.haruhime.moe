/**
 * @file src/lib/storage/download-choices.ts
 * @desc Keeps the Download card's download options in localStorage. Best effort: no storage, a
 *       refusal (private windows, blocked site data) or junk just means the defaults.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import {
  DEFAULT_DOWNLOAD_CHOICES,
  type DownloadChoices,
  downloadChoicesSchema,
} from "@/schemas/download-choices";

export const DOWNLOAD_CHOICES_KEY = "packs-download-options";

export type ChoicesStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** window.localStorage, or null where there is no window or the browser refuses access. */
const browserStorage = (): ChoicesStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * @function loadDownloadChoices
 * @param storage {ChoicesStorage | null} where to read (injectable for tests)
 * @returns {DownloadChoices} the saved choice, or the defaults
 */
export const loadDownloadChoices = (
  storage: ChoicesStorage | null = browserStorage(),
): DownloadChoices => {
  try {
    const raw = storage?.getItem(DOWNLOAD_CHOICES_KEY);
    if (!raw) return DEFAULT_DOWNLOAD_CHOICES;
    const parsed = downloadChoicesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_DOWNLOAD_CHOICES;
  } catch {
    return DEFAULT_DOWNLOAD_CHOICES;
  }
};

/**
 * @function saveDownloadChoices
 * @param choices {DownloadChoices} the choice to keep
 * @param storage {ChoicesStorage | null} where to write (injectable for tests)
 */
export const saveDownloadChoices = (
  choices: DownloadChoices,
  storage: ChoicesStorage | null = browserStorage(),
): void => {
  try {
    storage?.setItem(DOWNLOAD_CHOICES_KEY, JSON.stringify(choices));
  } catch {
    // Full or blocked: the choice lasts until the page closes.
  }
};

/**
 * @function clearDownloadChoices
 * @param storage {ChoicesStorage | null} where to delete (injectable for tests)
 */
export const clearDownloadChoices = (storage: ChoicesStorage | null = browserStorage()): void => {
  try {
    storage?.removeItem(DOWNLOAD_CHOICES_KEY);
  } catch {
    // Blocked storage holds nothing of ours.
  }
};
