/**
 * @file src/services/pack-records.ts
 * @desc Stored pack documents and what they turn into: the PackRecord shape, the mappers to the
 *       SavedPack DTO (stats, magnet links), canonical pack keys, the duplicate-key check on a
 *       path, and the pack model after connectDb. Shared by every pack service.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { isDuplicateKeyError } from "@haruhimemoe/next-kit/mongo";
import { encodePackKey } from "@haruhimemoe/pool";
import type { PackInput } from "@haruhimemoe/pool/service";
import { connectDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { Pool } from "@/schemas/pack";
import { type PackStats, packStatsSchema } from "@/schemas/pack-stats";
import { type SavedPack, savedPackSchema } from "@/schemas/saved-pack";
import { canonicalLinks } from "@/utils/magnet";
import { storedBuckets } from "@/utils/stored-buckets";

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

/** The pools pool a pack pools.haruhime.moe publishes comes from (never sent anywhere). */
export type PackOrigin = { kind: string; id: string };

/**
 * @function duplicateKeyOn
 * @param error {unknown} what a write threw
 * @param path {string} a unique index's field ("slug", "origin.id")
 * @returns {boolean} true for a duplicate-key error on that index
 */
export const duplicateKeyOn = (error: unknown, path: string): boolean =>
  isDuplicateKeyError(error) &&
  typeof error === "object" &&
  error !== null &&
  "keyPattern" in error &&
  typeof error.keyPattern === "object" &&
  error.keyPattern !== null &&
  path in error.keyPattern;

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

/** The canonical pack key: the same pool (in any slot order) gives the same key. */
const poolKey = (pack: { name: string; slots: Pool["slots"]; buckets?: Pool["buckets"] }) =>
  encodePackKey(
    pack.buckets
      ? { name: pack.name, slots: pack.slots, buckets: pack.buckets }
      : { name: pack.name, slots: pack.slots },
  );

/**
 * @function statsKey
 * @param pack {{ slots; buckets? }} a pool
 * @returns {string} the pool key under a fixed name: stats depend on slots and buckets only
 */
export const statsKey = (pack: { slots: Pool["slots"]; buckets?: Pool["buckets"] }) =>
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
 * @function inputPackKey
 * @param input {PackInput} a validated pack input
 * @returns {string} the canonical pack key it saves as (compare with packKeyOf)
 */
export const inputPackKey = (input: PackInput): string => poolKey(input);
