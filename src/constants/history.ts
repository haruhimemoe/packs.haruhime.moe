/**
 * @file src/constants/history.ts
 * @desc What each revision kind reads as in a pack's history list, and the page's fixed copy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { RevisionKind } from "@haruhimemoe/vcs";

/** What each revision kind reads as in a history list. Packs only ever writes "root" and "save". */
export const REVISION_LABELS: Readonly<Record<RevisionKind, string>> = {
  root: "Started",
  save: "Saved",
  autosave: "Autosaved",
  merge: "Saved (merged)",
  revert: "Restored",
  fork: "Copied",
  pull: "Pulled",
};

/** History page copy. */
export const HISTORY_COPY = {
  privateTitle: "This history is private",
  privateBody: "Only the owner can see it.",
  empty: "No changes since history started.",
  publicLabel: "Who can see this pack's history",
} as const;

/** A pack with no recorded history yet shows one synthetic row with this id. */
export const SYNTHETIC_ROOT_ID = "pre-history";
