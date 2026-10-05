/**
 * @file src/services/pack-history.ts
 * @desc Every save of a pack as a revision in pack_revisions. A pack saved before history gets
 *       its root from the content it had before this save; a new pack's root is its first save.
 *       Best effort: a history write that fails is logged and the save stands.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import type { RevisionAuthor } from "@haruhimemoe/next-kit/vcs";
import type { Revision } from "@haruhimemoe/vcs";
import { packRevisions } from "@/lib/pack-revisions";
import type { PackSnapshot } from "@/utils/pack-snapshot";

/** A pre-history pack's root: its message. */
export const HISTORY_START = "Saved before history was kept.";

const rootOf = async (
  slug: string,
  before: PackSnapshot,
  author: RevisionAuthor,
): Promise<Revision<PackSnapshot>> => {
  try {
    return await packRevisions.create(slug, before, author, HISTORY_START);
  } catch (error) {
    // Two first writes at once: the other one made the root.
    const head = await packRevisions.head(slug);
    if (head) return head;
    throw error;
  }
};

/**
 * @function recordPackSave
 * @param slug {string} the pack
 * @param before {PackSnapshot | null} its content before this save (null for a new pack)
 * @param after {PackSnapshot} its content now
 * @param author {RevisionAuthor} who saved
 * @returns {Promise<void>} once recorded, or logged when it couldn't be (never throws)
 */
export const recordPackSave = async (
  slug: string,
  before: PackSnapshot | null,
  after: PackSnapshot,
  author: RevisionAuthor,
): Promise<void> => {
  try {
    const head =
      (await packRevisions.head(slug)) ?? (before ? await rootOf(slug, before, author) : null);
    if (!head) {
      await packRevisions.create(slug, after, author, null);
      return;
    }
    const result = await packRevisions.commit({
      docId: slug,
      base: { id: head.id, seq: head.seq },
      value: after,
      author,
    });
    if (result.status === "conflict" || result.status === "missing") {
      console.warn(`[history] ${slug}: ${result.status}; this save isn't in its history`);
    }
  } catch (error) {
    console.error(`[history] ${slug} not recorded`, error);
  }
};
