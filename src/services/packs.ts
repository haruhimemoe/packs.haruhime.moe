/**
 * @file src/services/packs.ts
 * @desc Saved pack writes (create, update, delete). Every owner check lives here or in
 *       services/pack-reads.ts: callers pass the signed-in user's id and get null/false for "not found or not yours" (routes answer 404 for both, so they
 *       never confirm that a private slug exists). Changes that touch a public pack mark the
 *       cached /packs stale. Saves schedule the pack's filter stats after the response
 *       (services/pack-stats.ts); a slot or bucket change clears the old ones first. Saving a
 *       pack as anything but public takes away its pin (services/pins.ts). A pack
 *       pools.haruhime.moe publishes also stores its origin (the pools pool), which no DTO
 *       carries. Every create and update records a revision (services/pack-history.ts), best
 *       effort; delete removes the pack's history too. Reads live in services/pack-reads.ts;
 *       record mappers and pack keys in services/pack-records.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { isDuplicateKeyError } from "@haruhimemoe/next-kit/mongo";
import "server-only";
import type { RevisionAuthor } from "@haruhimemoe/next-kit/vcs";
import { bucketsOf, canonicalBuckets } from "@haruhimemoe/pool";
import type { PackInput } from "@haruhimemoe/pool/service";
import { nanoid } from "nanoid";
import { MAX_SAVED_PACKS, SLUG_LENGTH } from "@/constants/pack";
import { packRevisions } from "@/lib/pack-revisions";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { UNPIN } from "@/models/Pack";
import { type SavedPack, slugSchema } from "@/schemas/saved-pack";
import { recordPackSave } from "@/services/pack-history";
import {
  connectedPackModel,
  duplicateKeyOn,
  inputPackKey,
  type PackOrigin,
  packKeyOf,
  statsKey,
  toSavedPack,
} from "@/services/pack-records";
import { schedulePackStats } from "@/services/pack-stats";
import { snapshotOf } from "@/utils/pack-snapshot";

const SLUG_ATTEMPTS = 3;

export class PackLimitError extends Error {
  constructor() {
    super(
      `You've saved ${MAX_SAVED_PACKS} packs, the most one account can keep. Delete one to save another.`,
    );
    this.name = "PackLimitError";
  }
}

const touchesPublicList = (...visibilities: unknown[]): boolean => visibilities.includes("public");

type CreateOptions = {
  makeSlug?: () => string;
  unlimited?: boolean;
  subject?: string;
  origin?: PackOrigin;
  hiddenAt?: Date;
  /** Who to record the pack's first revision as. Every real write path (session, API key, pools
   *  sync) passes its caller; the default only covers callers that predate history (tests). */
  author?: RevisionAuthor;
};

/**
 * @function createPack
 * @param ownerId {string} signed-in user's id
 * @param input {PackInput} validated pack
 * @param options {CreateOptions} slug source (tests), unlimited to skip the MAX_SAVED_PACKS check
 *        (admins, the pools account), the caller's rate-limit subject (its share of the osu!
 *        budget pays for the stats lookups), the pools pool it comes from, hiddenAt to create
 *        it already hidden (a pools pack a moderator hid before pools deleted it), and who to
 *        record the pack's first revision as (default: the owner, name "unknown")
 * @returns {Promise<SavedPack>} the stored pack, without stats: they're computed after the
 *          response
 * @throws {PackLimitError} when the owner already has MAX_SAVED_PACKS packs and isn't unlimited
 * @throws {MongoServerError} a duplicate key on origin.id when a pack with that origin exists
 */
export const createPack = async (
  ownerId: string,
  input: PackInput,
  {
    makeSlug = () => nanoid(SLUG_LENGTH),
    unlimited = false,
    subject,
    origin,
    hiddenAt,
    author = { id: ownerId, name: "unknown" },
  }: CreateOptions = {},
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
        ...(origin ? { origin } : {}),
        ...(hiddenAt ? { hiddenAt } : {}),
      });
      // Counting first can't stop creates racing past the cap. The earliest packs (by _id) keep
      // their place: a create with the cap's worth already ahead of it backs out.
      if (
        !unlimited &&
        (await model.countDocuments({ ownerId, _id: { $lt: doc._id } })) >= MAX_SAVED_PACKS
      ) {
        await model.deleteOne({ _id: doc._id });
        throw new PackLimitError();
      }
      if (touchesPublicList(input.visibility)) revalidatePublicPacks();
      schedulePackStats(doc.slug, subject);
      const pack = toSavedPack(doc.toObject());
      await recordPackSave(doc.slug, null, snapshotOf(pack), author);
      return pack;
    } catch (error) {
      // A slug collision gets a new slug; a pack with the same origin is the caller's to handle.
      if (
        attempt < SLUG_ATTEMPTS &&
        isDuplicateKeyError(error) &&
        !duplicateKeyOn(error, "origin.id")
      ) {
        continue;
      }
      throw error;
    }
  }
};

/**
 * @function updatePack
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @param input {PackInput} validated replacement (a missing description clears it)
 * @param options {{ subject?: string; author?: RevisionAuthor }} the caller's rate-limit subject
 *        (for the stats lookups) and who to record this save as (default: the owner, name
 *        "unknown"; every real write path passes its caller)
 * @returns {Promise<SavedPack | null>} the updated pack, or null when missing or not the owner's.
 *          Never touches the moderation flag. Clears recorded export links when the pack
 *          key changes, stats when the slots or buckets change, and the pin when it stops being
 *          public; schedules new stats then, or whenever the pack has none or incomplete ones.
 */
export const updatePack = async (
  slug: string,
  ownerId: string,
  input: PackInput,
  {
    subject,
    author = { id: ownerId, name: "unknown" },
  }: { subject?: string; author?: RevisionAuthor } = {},
): Promise<SavedPack | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const model = await connectedPackModel();
  const before = await model.findOne({ slug, ownerId }).lean();
  if (!before) return null;
  const buckets = canonicalBuckets(bucketsOf(input));
  const description = input.description ?? "";
  const previous = toSavedPack(before);
  // A different pack key means different files, folder, or pack.txt: its torrents no longer match.
  const poolChanged = packKeyOf(previous) !== inputPackKey(input);
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
    // Only public packs can be pinned; the "Pinned" row on /packs would drop it anyway.
    ...(input.visibility === "public" ? {} : UNPIN),
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
  await recordPackSave(slug, snapshotOf(previous), snapshotOf(pack), author);
  return pack;
};

/**
 * @function deletePack
 * @param slug {string} untrusted route segment
 * @param ownerId {string} signed-in user's id
 * @returns {Promise<boolean>} true when the owner's pack was deleted (its history goes too)
 */
export const deletePack = async (slug: string, ownerId: string): Promise<boolean> => {
  if (!slugSchema.safeParse(slug).success) return false;
  const model = await connectedPackModel();
  const doc = await model.findOneAndDelete({ slug, ownerId }).select("visibility").lean();
  if (!doc) return false;
  await packRevisions.removeDoc(slug);
  revalidatePack(slug);
  if (touchesPublicList(doc.visibility)) revalidatePublicPacks();
  return true;
};
