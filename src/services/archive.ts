/**
 * @file src/services/archive.ts
 * @desc Archive packs in the database. ensureArchiveAccount creates the system
 *       account that owns every archive pack: a users record with `system: true`, no osu! id and
 *       no linked osu! account, so nobody can sign in or use an API key as it (src/lib/auth.ts,
 *       src/services/api-keys.ts). It has no pack cap: the importer writes its packs directly.
 *       importArchive plans normalized pools against the stored archive packs (hidden ones
 *       included, so a pool an admin hid is never imported again) and, unless it's a dry run,
 *       writes the plan: new public packs with their seeded stats (always incomplete, so the
 *       stats job looks every rating up on osu! once) and archive details, new sources on stored
 *       packs, and old packs unlisted once every source of them changed (both through the
 *       driver, so `updatedAt` never moves), then rebuilds
 *       map usage for every map (src/services/map-usage.ts). A dry run writes nothing, the account
 *       and map usage included. Revalidating the live site is the runner's job
 *       (src/lib/archive-import.ts): this code also runs outside Next.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { bucketsOf, canonicalBuckets } from "@haruhimemoe/pool";
import { type Document, ObjectId } from "mongodb";
import { nanoid } from "nanoid";
import { ARCHIVE_ACCOUNT, type ArchiveSourceKind } from "@/constants/archive";
import { SLUG_LENGTH } from "@/constants/pack";
import { connectedDb } from "@/lib/db";
import { UNPIN } from "@/models/Pack";
import { rebuildMapUsage, type UsageRebuild } from "@/services/map-usage";
import { connectedPackModel } from "@/services/packs";
import {
  type ArchivePlan,
  type ExistingArchivePack,
  planArchiveImport,
} from "@/utils/archive-import";
import type { ArchiveSourceRef, NormalizedPool, SkippedPool } from "@/utils/archive-pools";
import { type PackStatsRecord, statsRetryAt } from "@/utils/saved-pack-stats";

const SLUG_ATTEMPTS = 3;

/**
 * @function ensureArchiveAccount
 * @param now {Date} creation time when the account doesn't exist yet (tests)
 * @returns {Promise<string>} the archive account's user id. Creates the account on first call and
 *          only refreshes its name and avatar after that, so calling it again changes nothing.
 */
export const ensureArchiveAccount = async (now: Date = new Date()): Promise<string> => {
  const users = (await connectedDb()).collection("user");
  const doc = await users.findOneAndUpdate(
    { email: ARCHIVE_ACCOUNT.email },
    {
      $set: {
        system: true,
        name: ARCHIVE_ACCOUNT.name,
        username: ARCHIVE_ACCOUNT.name,
        image: ARCHIVE_ACCOUNT.avatarUrl,
        avatarUrl: ARCHIVE_ACCOUNT.avatarUrl,
      },
      $setOnInsert: { emailVerified: false, createdAt: now, updatedAt: now },
    },
    { upsert: true, returnDocument: "after", projection: { _id: 1 } },
  );
  if (!doc) throw new Error("archive account upsert returned no document");
  return doc._id.toString();
};

/**
 * @function listArchivePacks
 * @returns {Promise<ExistingArchivePack[]>} every stored archive pack (any visibility, hidden ones
 *          included) with its fingerprint, sources, visibility and whether an admin hid it.
 *          Reads only: no index is built for it.
 */
export const listArchivePacks = async (): Promise<ExistingArchivePack[]> => {
  const packs = (await connectedDb()).collection("packs");
  const docs = await packs
    .find(
      { "archive.fingerprint": { $exists: true } },
      {
        projection: {
          slug: 1,
          name: 1,
          visibility: 1,
          hiddenAt: 1,
          "archive.fingerprint": 1,
          "archive.sources": 1,
        },
      },
    )
    .toArray();
  return docs.map((doc) => ({
    slug: String(doc.slug),
    name: String(doc.name),
    fingerprint: String(doc.archive.fingerprint),
    sources: (Array.isArray(doc.archive.sources) ? doc.archive.sources : []).map(
      (source: { kind?: unknown; id?: unknown }) => ({
        kind: String(source.kind),
        id: String(source.id),
      }),
    ),
    visibility: String(doc.visibility),
    hidden: doc.hiddenAt !== undefined && doc.hiddenAt !== null,
  }));
};

/**
 * Seeded stats as stored: always incomplete and due for the stats job (statsRetryAt), even when
 * the source had every rating, so osu!'s current numbers replace the source's at least once.
 */
const seededStats = (stats: PackStatsRecord) => ({
  ...stats,
  complete: false,
  attempts: 1,
  retryAt: statsRetryAt(stats.computedAt, 1),
});

const isDuplicateOf = (error: unknown, field: string): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  return (
    code === 11000 && typeof keyPattern === "object" && keyPattern !== null && field in keyPattern
  );
};

type StoredSource = { kind: ArchiveSourceKind; id: string; url: string; importedAt: Date };

const stamped = (sources: readonly ArchiveSourceRef[], now: Date): StoredSource[] =>
  sources.map(({ kind, id, url }) => ({ kind, id, url, importedAt: now }));

export type ArchiveWrites = { created: number; updated: number; unlisted: number };

/**
 * An import that stopped partway, with what it had written by then: the runner still says so
 * and refreshes the site for those packs (a rerun finds them unchanged and wouldn't).
 */
export class ArchiveImportError extends Error {
  readonly writes: ArchiveWrites;

  constructor(cause: unknown, writes: ArchiveWrites) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "ArchiveImportError";
    this.writes = writes;
  }
}

/**
 * @function applyArchivePlan
 * @param plan {ArchivePlan} what to write
 * @param options {{ ownerId: string; now?: Date; makeSlug?: () => string }} the archive account,
 *        the import time, and the slug source (tests)
 * @returns {Promise<ArchiveWrites>} how many packs were created, how many stored packs gained a
 *          source, and how many old packs were unlisted (still public and not hidden when
 *          written; their pin goes with it). A pool another import created meanwhile gets the
 *          sources instead of a second pack (the fingerprint index refuses it), and a source a
 *          pack already has is never added twice.
 * @throws {ArchiveImportError} when a write fails, carrying what was written before it
 */
export const applyArchivePlan = async (
  plan: ArchivePlan,
  {
    ownerId,
    now = new Date(),
    makeSlug = () => nanoid(SLUG_LENGTH),
  }: { ownerId: string; now?: Date; makeSlug?: () => string },
): Promise<ArchiveWrites> => {
  const writes: ArchiveWrites = { created: 0, updated: 0, unlisted: 0 };
  try {
    const model = await connectedPackModel();
    const addSources = async (filter: Document, sources: readonly ArchiveSourceRef[]) => {
      let added = false;
      for (const source of stamped(sources, now)) {
        const result = await model.collection.updateOne(
          {
            ...filter,
            "archive.sources": { $not: { $elemMatch: { kind: source.kind, id: source.id } } },
          },
          { $push: { "archive.sources": source } } as Document,
        );
        added ||= result.modifiedCount > 0;
      }
      return added;
    };
    for (const { pool, sources } of plan.create) {
      const buckets = canonicalBuckets(bucketsOf(pool.input));
      for (let attempt = 1; ; attempt++) {
        try {
          await model.create({
            slug: makeSlug(),
            ownerId: new ObjectId(ownerId),
            name: pool.input.name,
            slots: pool.input.slots,
            ...(buckets ? { buckets } : {}),
            ...(pool.input.description ? { description: pool.input.description } : {}),
            visibility: "public",
            stats: seededStats(pool.stats),
            archive: {
              tournament: pool.archive.tournament,
              round: pool.archive.round,
              year: pool.archive.year,
              badged: null,
              fingerprint: pool.fingerprint,
              sources: stamped(sources, now),
            },
          });
          writes.created++;
          break;
        } catch (error) {
          if (isDuplicateOf(error, "archive.fingerprint")) {
            if (await addSources({ "archive.fingerprint": pool.fingerprint }, sources)) {
              writes.updated++;
            }
            break;
          }
          if (attempt < SLUG_ATTEMPTS && isDuplicateOf(error, "slug")) continue;
          throw error;
        }
      }
    }
    for (const update of plan.update) {
      if (await addSources({ slug: update.slug }, update.sources)) writes.updated++;
    }
    for (const { slug } of plan.unlist) {
      const result = await model.collection.updateOne(
        { slug, visibility: "public", hiddenAt: null, "archive.fingerprint": { $exists: true } },
        { $set: { visibility: "unlisted" }, $unset: UNPIN },
      );
      writes.unlisted += result.modifiedCount;
    }
    return writes;
  } catch (error) {
    throw new ArchiveImportError(error, { ...writes });
  }
};

export type ArchiveImport = ArchiveWrites & {
  plan: ArchivePlan;
  /** The full map usage rebuild after a real run; null on a dry run. */
  usage: UsageRebuild | null;
};

/**
 * @function importArchive
 * @param pools {readonly NormalizedPool[]} one source's normalized pools, in creation order
 * @param skipped {readonly SkippedPool[]} pools already left out (for the report)
 * @param options {{ dryRun: boolean; now?: Date; makeSlug?: () => string }} whether to write,
 *        the import time, and the slug source (tests)
 * @returns {Promise<ArchiveImport>} the plan, what was written, and the map usage rebuild that
 *          follows every real run (nothing on a dry run)
 * @throws {ArchiveImportError} when writing or the map usage rebuild fails, carrying what was
 *         written
 */
export const importArchive = async (
  pools: readonly NormalizedPool[],
  skipped: readonly SkippedPool[],
  { dryRun, now = new Date(), makeSlug }: { dryRun: boolean; now?: Date; makeSlug?: () => string },
): Promise<ArchiveImport> => {
  const plan = planArchiveImport(pools, skipped, await listArchivePacks());
  if (dryRun) return { plan, created: 0, updated: 0, unlisted: 0, usage: null };
  const ownerId = await ensureArchiveAccount(now);
  const writes = await applyArchivePlan(plan, { ownerId, now, makeSlug });
  try {
    return { plan, ...writes, usage: await rebuildMapUsage(undefined, now) };
  } catch (error) {
    throw new ArchiveImportError(error, writes);
  }
};
