/**
 * @file src/services/packs.ts
 * @desc Saved pack operations. Every owner check lives here: callers pass the signed-in user's
 *       id and get null/false for "not found or not yours" (routes answer 404 for both, so they
 *       never confirm that a private slug exists). Changes that touch a public pack mark the
 *       cached /packs stale. Saves schedule the pack's filter stats after the response
 *       (services/pack-stats.ts); a slot or bucket change clears the old ones first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { bucketsOf, canonicalBuckets, encodePackKey } from "@haruhimemoe/pool";
import { nanoid } from "nanoid";
import { MAX_SAVED_PACKS, OWN_PAGE_SIZE, SLUG_LENGTH } from "@/constants/pack";
import { connectDb } from "@/lib/db";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { getPackModel } from "@/models/Pack";
import type { Pool } from "@/schemas/pack";
import { type PackStats, packStatsSchema } from "@/schemas/pack-stats";
import {
  type PackInput,
  type SavedPack,
  type SavedPackSummary,
  savedPackSchema,
  savedPackSummarySchema,
  slugSchema,
} from "@/schemas/saved-pack";
import { schedulePackStats } from "@/services/pack-stats";
import { canonicalLinks } from "@/utils/magnet";
import { storedBuckets } from "@/utils/stored-buckets";

const SLUG_ATTEMPTS = 3;

export class PackLimitError extends Error {
  constructor() {
    super(
      `You've saved ${MAX_SAVED_PACKS} packs, the most one account can keep. Delete one to save another.`,
    );
    this.name = "PackLimitError";
  }
}

export type PackRecord = {
  slug: string;
  name: string;
  slots: unknown;
  buckets?: unknown;
  description?: string | null;
  visibility: unknown;
  hiddenAt?: Date | null;
  exports?: { kind: string; url: string; createdAt: Date }[] | null;
  stats?: { computedAt?: unknown } | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * @function storedStats
 * @param value {PackRecord["stats"]} a stored document's (or aggregate row's) stats
 * @returns {PackStats | undefined} the DTO form, or undefined when there are none or they don't
 *          parse (a bad stats row never breaks the pack)
 */
export const storedStats = (value: PackRecord["stats"]): PackStats | undefined => {
  if (!value || !(value.computedAt instanceof Date)) return undefined;
  const parsed = packStatsSchema.safeParse({
    ...value,
    computedAt: value.computedAt.toISOString(),
  });
  return parsed.success ? parsed.data : undefined;
};

export type StoredExport = { kind: string; url: string; createdAt: Date };

/**
 * @function canonicalExports
 * @param list {StoredExport[] | null | undefined} stored export links, newest first
 * @returns {StoredExport[]} the same order, each link rebuilt by canonicalMagnet (our trackers
 *          only, no web seeds, sources or peers), links that aren't v1 magnets dropped, and only
 *          the first link per infohash kept. Rows stored before links were canonical come out
 *          clean too.
 */
export const canonicalExports = (
  list: readonly StoredExport[] | null | undefined,
): StoredExport[] => canonicalLinks(list ?? []);

/**
 * @function toPackExports
 * @param list {StoredExport[] | null | undefined} stored export links
 * @returns {{ kind; url; createdAt: string }[]} DTO entries (ISO dates), same order, canonical
 *          magnet links only (see canonicalExports)
 */
export const toPackExports = (list: readonly StoredExport[] | null | undefined) =>
  // A bad row never reaches an href, and an old row never carries someone else's tracker.
  canonicalExports(list).map((entry) => ({
    kind: entry.kind,
    url: entry.url,
    createdAt: entry.createdAt.toISOString(),
  }));

/**
 * @function toSavedPack
 * @param doc {PackRecord} a stored pack document (lean, or an aggregate row)
 * @returns {SavedPack} the DTO
 * @throws {ZodError} when the stored document is corrupt
 */
export const toSavedPack = (doc: PackRecord): SavedPack => {
  const buckets = storedBuckets(doc.buckets);
  const stats = storedStats(doc.stats);
  return savedPackSchema.parse({
    slug: doc.slug,
    name: doc.name,
    slots: doc.slots,
    ...(buckets ? { buckets } : {}),
    ...(doc.description ? { description: doc.description } : {}),
    visibility: doc.visibility,
    exports: toPackExports(doc.exports),
    ...(doc.hiddenAt ? { hiddenAt: doc.hiddenAt.toISOString() } : {}),
    ...(stats ? { stats } : {}),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
};

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

/**
 * @function connectedPackModel
 * @returns {Promise<ReturnType<typeof getPackModel>>} the Pack model, connected, indexes built
 */
export const connectedPackModel = async () => {
  await connectDb();
  const model = getPackModel();
  await model.init();
  return model;
};

/** A change that touches a public pack (before or after) makes the cached /packs stale. */
const touchesPublicList = (...visibilities: unknown[]): boolean => visibilities.includes("public");

/**
 * @function createPack
 * @param ownerId {string} signed-in user's id
 * @param input {PackInput} validated pack
 * @param options {{ makeSlug?: () => string; unlimited?: boolean; subject?: string }} slug
 *        source (tests), unlimited to skip the MAX_SAVED_PACKS check (admins), and the caller's
 *        rate-limit subject (its share of the osu! budget pays for the stats lookups)
 * @returns {Promise<SavedPack>} the stored pack, without stats: they're computed after the
 *          response
 * @throws {PackLimitError} when the owner already has MAX_SAVED_PACKS packs and isn't unlimited
 */
export const createPack = async (
  ownerId: string,
  input: PackInput,
  {
    makeSlug = () => nanoid(SLUG_LENGTH),
    unlimited = false,
    subject,
  }: { makeSlug?: () => string; unlimited?: boolean; subject?: string } = {},
): Promise<SavedPack> => {
  const model = await connectedPackModel();
  if (!unlimited && (await model.countDocuments({ ownerId })) >= MAX_SAVED_PACKS) {
    throw new PackLimitError();
  }
  const buckets = canonicalBuckets(bucketsOf(input));
  const description = input.description ?? "";
  for (let attempt = 1; ; attempt++) {
    try {
      const doc = await model.create({
        slug: makeSlug(),
        ownerId,
        name: input.name,
        slots: input.slots,
        ...(buckets ? { buckets } : {}),
        ...(description ? { description } : {}),
        visibility: input.visibility,
      });
      if (touchesPublicList(input.visibility)) revalidatePublicPacks();
      schedulePackStats(doc.slug, subject);
      return toSavedPack(doc.toObject());
    } catch (error) {
      if (attempt < SLUG_ATTEMPTS && isDuplicateKey(error)) continue;
      throw error;
    }
  }
};

export type OwnPackPage = {
  packs: SavedPackSummary[];
  page: number;
  pageCount: number;
  total: number;
};

/**
 * @function listPacks
 * @param ownerId {string} signed-in user's id
 * @param page {number} 1-based page (a page past the end is empty)
 * @returns {Promise<OwnPackPage>} OWN_PAGE_SIZE of the owner's packs, most recently updated
 *          first, with the page count (at least 1) and the owner's total
 */
export const listPacks = async (ownerId: string, page = 1): Promise<OwnPackPage> => {
  const model = await connectedPackModel();
  const [docs, total] = await Promise.all([
    model
      .find({ ownerId }, { slug: 1, name: 1, visibility: 1, updatedAt: 1, slots: 1, hiddenAt: 1 })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * OWN_PAGE_SIZE)
      .limit(OWN_PAGE_SIZE)
      .lean(),
    model.countDocuments({ ownerId }),
  ]);
  const packs = docs.map((doc) =>
    savedPackSummarySchema.parse({
      slug: doc.slug,
      name: doc.name,
      slotCount: doc.slots.length,
      visibility: doc.visibility,
      ...(doc.hiddenAt ? { hidden: true } : {}),
      updatedAt: doc.updatedAt.toISOString(),
    }),
  );
  return { packs, page, pageCount: Math.max(1, Math.ceil(total / OWN_PAGE_SIZE)), total };
};

/**
 * @function listSavedPacks
 * @param ownerId {string} signed-in user's id
 * @returns {Promise<SavedPack[]>} every pack the owner saved as full DTOs: any visibility,
 *          moderator-hidden ones included (with hiddenAt), most recently updated first
 */
export const listSavedPacks = async (ownerId: string): Promise<SavedPack[]> => {
  const model = await connectedPackModel();
  const docs = await model.find({ ownerId }).sort({ updatedAt: -1, _id: -1 }).lean();
  return docs.map((doc) => toSavedPack(doc));
};

/**
 * @function listSavedPackPage
 * @param ownerId {string} the owner's user id
 * @param page {number} 1-based page (a page past the end is empty)
 * @param pageSize {number} packs per page
 * @returns {Promise<{ packs: SavedPack[]; page: number; pageCount: number; total: number }>}
 *          one page of listSavedPacks' order, with the page count (at least 1) and the total
 */
export const listSavedPackPage = async (
  ownerId: string,
  page: number,
  pageSize: number,
): Promise<{ packs: SavedPack[]; page: number; pageCount: number; total: number }> => {
  const model = await connectedPackModel();
  const [docs, total] = await Promise.all([
    model
      .find({ ownerId })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    model.countDocuments({ ownerId }),
  ]);
  return {
    packs: docs.map((doc) => toSavedPack(doc)),
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
};

/** The one copy of "who may see this pack": private and hidden packs only for their owner. */
const findVisiblePack = async (slug: string, viewerId: string | null, isAdmin: boolean) => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  const doc = await model.findOne({ slug }).lean();
  if (!doc) return null;
  const isOwner = viewerId !== null && doc.ownerId.toString() === viewerId;
  if (doc.visibility === "private" && !isOwner) return null;
  if (doc.hiddenAt && !isOwner && !isAdmin) return null;
  return { doc, isOwner };
};

/**
 * @function getPackForViewer
 * @param slug {string} untrusted route segment
 * @param viewerId {string | null} signed-in user's id, or null when anonymous
 * @param options {{ isAdmin?: boolean }} admins also see hidden public/unlisted packs
 * @returns {Promise<{ pack: SavedPack; isOwner: boolean } | null>} null when missing, private to
 *          someone else, or hidden from this viewer
 */
export const getPackForViewer = async (
  slug: string,
  viewerId: string | null,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Promise<{ pack: SavedPack; isOwner: boolean } | null> => {
  const found = await findVisiblePack(slug, viewerId, isAdmin);
  return found ? { pack: toSavedPack(found.doc), isOwner: found.isOwner } : null;
};

/**
 * @function getPackWithOwner
 * @param slug {string} untrusted route segment
 * @param viewerId {string | null} the API caller's user id
 * @returns {Promise<{ pack: SavedPack; isOwner: boolean; ownerId: string } | null>} same rules
 *          as getPackForViewer without admin rights (API keys never carry them)
 */
export const getPackWithOwner = async (
  slug: string,
  viewerId: string | null,
): Promise<{ pack: SavedPack; isOwner: boolean; ownerId: string } | null> => {
  const found = await findVisiblePack(slug, viewerId, false);
  return found
    ? {
        pack: toSavedPack(found.doc),
        isOwner: found.isOwner,
        ownerId: found.doc.ownerId.toString(),
      }
    : null;
};

/** The canonical pack key: the same pool (in any slot order) gives the same key. */
const poolKey = (pack: { name: string; slots: Pool["slots"]; buckets?: Pool["buckets"] }) =>
  encodePackKey(
    pack.buckets
      ? { name: pack.name, slots: pack.slots, buckets: pack.buckets }
      : { name: pack.name, slots: pack.slots },
  );

/** Stats depend on slots and buckets only: the pool key under a fixed name. */
const statsKey = (pack: { slots: Pool["slots"]; buckets?: Pool["buckets"] }) =>
  poolKey({ ...pack, name: "stats" });

/**
 * @function storedPackKey
 * @param doc {PackRecord} a stored pack document
 * @returns {string} its canonical pack key
 */
export const storedPackKey = (doc: PackRecord): string => poolKey(toSavedPack(doc));

/**
 * @function packKeyOf
 * @param pack {SavedPack} a saved pack
 * @returns {string} its canonical pack key (the same key the site shows)
 */
export const packKeyOf = (pack: SavedPack): string => poolKey(pack);

/**
 * @function updatePack
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @param input {PackInput} validated replacement (a missing description clears it)
 * @param options {{ subject?: string }} the caller's rate-limit subject (for the stats lookups)
 * @returns {Promise<SavedPack | null>} the updated pack, or null when missing or not the owner's.
 *          Never touches the moderation flag. Clears recorded export links when the pack
 *          key changes, and stats when the slots or buckets change; schedules new stats then,
 *          or whenever the pack has none or incomplete ones.
 */
export const updatePack = async (
  slug: string,
  ownerId: string,
  input: PackInput,
  { subject }: { subject?: string } = {},
): Promise<SavedPack | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  const before = await model.findOne({ slug, ownerId }).lean();
  if (!before) return null;
  const buckets = canonicalBuckets(bucketsOf(input));
  const description = input.description ?? "";
  const previous = toSavedPack(before);
  // A different pack key means different files, folder, or pack.txt: its torrents no longer match.
  const poolChanged = poolKey(previous) !== poolKey(input);
  // Old stats describe other maps: clear them rather than serve them until the new ones land.
  const statsChanged = statsKey(previous) !== statsKey(input);
  const set = {
    name: input.name,
    slots: input.slots,
    visibility: input.visibility,
    ...(buckets ? { buckets } : {}),
    ...(description ? { description } : {}),
  };
  const unset = {
    ...(buckets ? {} : { buckets: 1 }),
    ...(description ? {} : { description: 1 }),
    ...(poolChanged ? { exports: 1 } : {}),
    ...(statsChanged ? { stats: 1 } : {}),
  };
  const doc = await model
    .findOneAndUpdate(
      { slug, ownerId },
      Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set },
      { returnDocument: "after", runValidators: true },
    )
    .lean();
  if (!doc) return null;
  revalidatePack(slug);
  if (touchesPublicList(before.visibility, doc.visibility)) revalidatePublicPacks();
  const pack = toSavedPack(doc);
  if (!pack.stats?.complete) schedulePackStats(slug, subject);
  return pack;
};

/**
 * @function deletePack
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @returns {Promise<boolean>} true when the owner's pack was deleted
 */
export const deletePack = async (slug: string, ownerId: string): Promise<boolean> => {
  if (!slugSchema.safeParse(slug).success) return false;
  const model = await connectedPackModel();
  const doc = await model.findOneAndDelete({ slug, ownerId }).select("visibility").lean();
  if (!doc) return false;
  revalidatePack(slug);
  if (touchesPublicList(doc.visibility)) revalidatePublicPacks();
  return true;
};
