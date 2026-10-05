/**
 * @file src/utils/pack-history-access.ts
 * @desc Who may read and open up a saved pack's history. The owner always reads it; only the
 *       owner turns historyPublic on or off (packs has no editors, unlike pools and bb). With it
 *       on, anyone who can see the pack reads its history, except while the pack is private or
 *       hidden: those hide history from everyone but the owner and admins. Admins read the
 *       history of any pack that isn't private (for moderation), hidden or not and whatever
 *       historyPublic says, but never revert or toggle it (packs has no revert at all). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

/** The parts of a saved pack history access reads. */
export type PackHistoryGuarded = {
  ownerId: string;
  visibility: string;
  hiddenAt?: unknown;
  historyPublic?: boolean;
};

/** Who's asking: the signed-in caller, or null when anonymous. */
export type PackHistoryViewer = { id: string; isAdmin: boolean } | null;

/** What a caller may do with a pack's history. */
export type PackHistoryAccess = {
  canRead: boolean;
  canToggle: boolean;
  isOwner: boolean;
};

/**
 * @function packHistoryAccessOf
 * @param pack {PackHistoryGuarded} the pack
 * @param viewer {PackHistoryViewer} who's asking
 * @returns {PackHistoryAccess} what they may do with its history
 */
export const packHistoryAccessOf = (
  pack: PackHistoryGuarded,
  viewer: PackHistoryViewer,
): PackHistoryAccess => {
  const isOwner = viewer !== null && pack.ownerId === viewer.id;
  const notPrivate = pack.visibility !== "private";
  const open = pack.historyPublic === true && notPrivate && !pack.hiddenAt;
  const moderator = viewer?.isAdmin === true && notPrivate;
  return {
    canRead: isOwner || moderator || open,
    canToggle: isOwner,
    isOwner,
  };
};
