/**
 * @file src/services/pack-history-read.ts
 * @desc Reading and toggling a saved pack's history. "Not found" and "yours to see but not to
 *       read" are told apart (404 vs 403), matching pack-reads.ts's visibility rule. A pack with
 *       no recorded history yet (it predates this feature and has never been saved since) shows
 *       one synthetic row built from its current content: reading never writes, unlike pools and
 *       bb, where the first read lazily creates a real root. packs has no revert.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import type { Change, RevisionMeta } from "@haruhimemoe/vcs";
import { diffValue } from "@haruhimemoe/vcs/json";
import { SYNTHETIC_ROOT_ID } from "@/constants/history";
import { PACK_NOT_FOUND } from "@/lib/api";
import { packRevisions } from "@/lib/pack-revisions";
import { revalidatePack } from "@/lib/revalidate";
import { slugSchema } from "@/schemas/saved-pack";
import { HISTORY_START } from "@/services/pack-history";
import { connectedPackModel, toSavedPack } from "@/services/pack-records";
import {
  type PackHistoryAccess,
  type PackHistoryViewer,
  packHistoryAccessOf,
} from "@/utils/pack-history-access";
import { PACK_CODEC, type PackSnapshot, snapshotOf } from "@/utils/pack-snapshot";

/** A pack isn't found, or isn't the viewer's to read history for (not the same as not found). */
export const HISTORY_PRIVATE = "This pack's history is private.";
export const REVISION_NOT_FOUND = "That version doesn't exist any more.";

/** A refusal: a status and a message, no pack to show (packs has nothing like pools' conflict body). */
export type HistoryRefusal = { ok: false; status: 404 | 403; message: string };
export type HistoryAnswer<T> = { ok: true; value: T } | HistoryRefusal;

const refuse = (status: 404 | 403, message: string): HistoryRefusal => ({
  ok: false,
  status,
  message,
});

const HISTORY_PAGE = 50;

/** The parts a raw lookup needs; ownerId stays a string (the model casts it on the way in). */
type RawPack = {
  slug: string;
  name: string;
  ownerId: { toString(): string };
  visibility: string;
  hiddenAt?: Date | null;
  historyPublic?: boolean | null;
  description?: string | null;
  slots: unknown;
  buckets?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const findRaw = async (slug: string): Promise<RawPack | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  return model.findOne({ slug }).lean();
};

const accessOf = (doc: RawPack, viewer: PackHistoryViewer): PackHistoryAccess =>
  packHistoryAccessOf(
    {
      ownerId: doc.ownerId.toString(),
      visibility: doc.visibility,
      hiddenAt: doc.hiddenAt,
      historyPublic: doc.historyPublic === true,
    },
    viewer,
  );

/** True when the viewer could see the pack at all (the 403 vs 404 split). */
const visibleToViewer = (doc: RawPack, viewer: PackHistoryViewer): boolean => {
  const isOwner = viewer !== null && doc.ownerId.toString() === viewer.id;
  if (doc.visibility === "private" && !isOwner) return false;
  if (doc.hiddenAt && !isOwner && !(viewer?.isAdmin ?? false)) return false;
  return true;
};

const syntheticRoot = (doc: RawPack): RevisionMeta => ({
  id: SYNTHETIC_ROOT_ID,
  docId: doc.slug,
  seq: 0,
  kind: "root",
  valueHash: "",
  authorId: doc.ownerId.toString(),
  authorName: "",
  message: HISTORY_START,
  createdAt: doc.createdAt.toISOString(),
});

const readable = async (
  slug: string,
  viewer: PackHistoryViewer,
): Promise<HistoryAnswer<{ doc: RawPack; access: PackHistoryAccess }>> => {
  const doc = await findRaw(slug);
  if (!doc) return refuse(404, PACK_NOT_FOUND);
  const access = accessOf(doc, viewer);
  if (!access.canRead) {
    return visibleToViewer(doc, viewer)
      ? refuse(403, HISTORY_PRIVATE)
      : refuse(404, PACK_NOT_FOUND);
  }
  return { ok: true, value: { doc, access } };
};

/** A pack's history page: its header, the caller's access, and a page of revisions. */
export type PackHistoryPage = {
  pack: { slug: string; name: string };
  access: PackHistoryAccess;
  historyPublic: boolean;
  revisions: RevisionMeta[];
  older: number | null;
};

/**
 * @function loadPackHistory
 * @param slug {string} untrusted route segment
 * @param viewer {PackHistoryViewer} who's asking
 * @param before {number} only revisions with a lower seq (paging)
 * @returns {Promise<HistoryAnswer<PackHistoryPage>>} 404 when the pack doesn't exist or the
 *          viewer can't see it, 403 when they can see the pack but not its history, else a page
 *          of revisions newest first (one synthetic row for a pack with no recorded history yet)
 */
export const loadPackHistory = async (
  slug: string,
  viewer: PackHistoryViewer,
  before?: number,
): Promise<HistoryAnswer<PackHistoryPage>> => {
  const loaded = await readable(slug, viewer);
  if (!loaded.ok) return loaded;
  const { doc, access } = loaded.value;
  const list = await packRevisions.list(slug, { before, limit: HISTORY_PAGE });
  const revisions = list.length > 0 || before !== undefined ? list : [syntheticRoot(doc)];
  const older = list.length === HISTORY_PAGE ? (list.at(-1)?.seq ?? null) : null;
  return {
    ok: true,
    value: {
      pack: { slug: doc.slug, name: doc.name },
      access,
      historyPublic: doc.historyPublic === true,
      revisions,
      older,
    },
  };
};

/** One revision's content and what changed since the one before it. */
export type PackRevisionView = {
  revision: RevisionMeta;
  previous: RevisionMeta | null;
  before: PackSnapshot | null;
  after: PackSnapshot;
  changes: Change[];
};

/**
 * @function loadPackRevision
 * @param slug {string} untrusted route segment
 * @param viewer {PackHistoryViewer} who's asking
 * @param revisionId {string} a revision id from loadPackHistory's list, or the synthetic root id
 * @returns {Promise<HistoryAnswer<PackRevisionView>>} 404/403 as loadPackHistory, or 404
 *          `REVISION_NOT_FOUND` for an id that isn't one of the pack's revisions
 */
export const loadPackRevision = async (
  slug: string,
  viewer: PackHistoryViewer,
  revisionId: string,
): Promise<HistoryAnswer<PackRevisionView>> => {
  const loaded = await readable(slug, viewer);
  if (!loaded.ok) return loaded;
  const { doc } = loaded.value;
  if (revisionId === SYNTHETIC_ROOT_ID) {
    const after = snapshotOf(toSavedPack(doc));
    return {
      ok: true,
      value: { revision: syntheticRoot(doc), previous: null, before: null, after, changes: [] },
    };
  }
  const revision = await packRevisions.get(slug, revisionId);
  if (!revision) return refuse(404, REVISION_NOT_FOUND);
  const [previousMeta] = await packRevisions.list(slug, { before: revision.seq, limit: 1 });
  const previous = previousMeta ? await packRevisions.get(slug, previousMeta.id) : null;
  const { value, ...meta } = revision;
  return {
    ok: true,
    value: {
      revision: meta,
      previous: previousMeta ?? null,
      before: previous?.value ?? null,
      after: value,
      changes: previous ? diffValue(previous.value, value, PACK_CODEC) : [],
    },
  };
};

/**
 * @function setPackHistoryPublic
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @param historyPublic {boolean} the new value
 * @returns {Promise<boolean>} true when the owner's pack was updated (false for missing or not
 *          the owner's); writes nothing and still answers true when the value didn't change
 */
export const setPackHistoryPublic = async (
  slug: string,
  ownerId: string,
  historyPublic: boolean,
): Promise<boolean> => {
  if (!slugSchema.safeParse(slug).success) return false;
  const model = await connectedPackModel();
  const result = await model.updateOne(
    { slug, ownerId },
    { $set: { historyPublic } },
    { timestamps: false },
  );
  if (result.matchedCount === 0) return false;
  revalidatePack(slug);
  return true;
};
