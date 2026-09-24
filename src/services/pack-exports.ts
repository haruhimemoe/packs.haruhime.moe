/**
 * @file src/services/pack-exports.ts
 * @desc Magnet links on saved packs. Owner-only (null = not found or not yours, like the packs
 *       service), except that admins can remove one link from a public or unlisted pack (the
 *       moderation scope in src/services/moderation.ts). Newest first, one entry per infohash, at most MAX_PACK_EXPORTS. A link is only
 *       accepted for the pack key its torrent was made from. Writes are conditional on the
 *       document not having changed since it was read (updatedAt + exportsRev), retried a few
 *       times, so concurrent adds and pool edits never lose or resurrect links. Never touches
 *       updatedAt, so recording a link doesn't reorder /packs or need a revalidation. Links are
 *       stored canonical (canonicalMagnet: infohash, name, size, our trackers), and every write
 *       cleans links stored before that.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { MAX_PACK_EXPORTS } from "@/constants/pack";
import { revalidatePack } from "@/lib/revalidate";
import type { PackExport } from "@/schemas/pack-export";
import { slugSchema } from "@/schemas/saved-pack";
import { MODERATED } from "@/services/moderation";
import {
  canonicalExports,
  connectedPackModel,
  type StoredExport,
  storedPackKey,
  toPackExports,
} from "@/services/packs";
import { canonicalMagnet, infohashOf } from "@/utils/magnet";

const WRITE_ATTEMPTS = 3;

export class ExportLimitError extends Error {
  constructor() {
    super(`A pack can list ${MAX_PACK_EXPORTS} magnet links. Remove one first.`);
    this.name = "ExportLimitError";
  }
}

export class StalePackError extends Error {
  constructor() {
    super("This pack changed after the torrent was made. Reload the page and make it again.");
    this.name = "StalePackError";
  }
}

export class ExportConflictError extends Error {
  constructor() {
    super("This pack changed while saving the link. Try again.");
    this.name = "ExportConflictError";
  }
}

const sameTorrent = (url: string) => {
  const hash = infohashOf(url);
  return (entry: StoredExport): boolean =>
    hash === null ? entry.url === url : infohashOf(entry.url) === hash;
};

/** Which packs a write may touch: the owner's own, or (admins) any public or unlisted one. */
type Scope = { ownerId: string } | typeof MODERATED;

/**
 * Reads the pack in scope, lets `change` compute the next list (or throw, or return null for "no
 * change"), and writes it only if nothing else wrote the pack in between. Retries on a race.
 */
const writeExports = async (
  slug: string,
  scope: Scope,
  change: (list: StoredExport[], doc: Parameters<typeof storedPackKey>[0]) => StoredExport[] | null,
): Promise<PackExport[] | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  for (let attempt = 1; ; attempt++) {
    const doc = await model.findOne({ slug, ...scope }).lean();
    if (!doc) return null;
    const list = canonicalExports(doc.exports as StoredExport[] | null | undefined);
    const next = change(list, doc);
    if (next === null) return toPackExports(list) as PackExport[];
    const result = await model.updateOne(
      { slug, ...scope, updatedAt: doc.updatedAt, exportsRev: doc.exportsRev ?? null },
      { $set: { exports: next }, $inc: { exportsRev: 1 } },
      { timestamps: false },
    );
    if (result.modifiedCount === 1) {
      revalidatePack(slug);
      return toPackExports(next) as PackExport[];
    }
    if (attempt >= WRITE_ATTEMPTS) throw new ExportConflictError();
  }
};

/**
 * @function addMagnet
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @param input {{ url: string; packKey: string }} a magnet link already validated by magnetSchema
 *        (stored as its canonicalMagnet form), and the pack key its torrent was made from
 * @param now {Date} when it was added (tests)
 * @returns {Promise<PackExport[] | null>} the pack's links, or null when missing or not the owner's
 * @throws {StalePackError} when the pack's key no longer matches (it was edited since)
 * @throws {ExportLimitError} when the pack already lists MAX_PACK_EXPORTS other torrents
 * @throws {ExportConflictError} when concurrent writes keep winning
 * @throws {TypeError} when url isn't a magnet link (the route validates it first)
 */
export const addMagnet = (
  slug: string,
  ownerId: string,
  { url, packKey }: { url: string; packKey: string },
  now: Date = new Date(),
): Promise<PackExport[] | null> =>
  writeExports(slug, { ownerId }, (list, doc) => {
    if (storedPackKey(doc) !== packKey) throw new StalePackError();
    const canonical = canonicalMagnet(url);
    if (canonical === null) throw new TypeError("addMagnet: not a magnet link");
    const isSame = sameTorrent(canonical);
    const others = list.filter((entry) => !isSame(entry));
    if (others.length >= MAX_PACK_EXPORTS) throw new ExportLimitError();
    return [{ kind: "magnet", url: canonical, createdAt: now }, ...others];
  });

/** The list without `url`'s torrent, or null when it isn't listed. */
const withoutTorrent =
  (url: string) =>
  (list: StoredExport[]): StoredExport[] | null => {
    const isSame = sameTorrent(url);
    const next = list.filter((entry) => !isSame(entry));
    return next.length === list.length ? null : next;
  };

/**
 * @function removeMagnet
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @param url {string} the magnet link (matched by infohash)
 * @returns {Promise<PackExport[] | null>} the links left, or null when missing or not the owner's
 * @throws {ExportConflictError} when concurrent writes keep winning
 */
export const removeMagnet = (
  slug: string,
  ownerId: string,
  url: string,
): Promise<PackExport[] | null> => writeExports(slug, { ownerId }, withoutTorrent(url));

/**
 * @function adminRemoveMagnet
 * @param slug {string} untrusted route segment
 * @param url {string} the magnet link (matched by infohash)
 * @returns {Promise<PackExport[] | null>} the links left, or null when missing or private (the
 *          route checks that the caller is an admin)
 * @throws {ExportConflictError} when concurrent writes keep winning
 */
export const adminRemoveMagnet = (slug: string, url: string): Promise<PackExport[] | null> =>
  writeExports(slug, MODERATED, withoutTorrent(url));
