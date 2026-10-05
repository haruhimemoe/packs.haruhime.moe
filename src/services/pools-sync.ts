/**
 * @file src/services/pools-sync.ts
 * @desc The packs pools.haruhime.moe publishes (PUT /api/service/pools/{ref}): one plain pack per
 *       pools pool, owned by the haruhime pools account and found by its origin (`{ kind: "pools",
 *       id }`, never sent anywhere). The first sync creates the pack; later ones update it when
 *       the name, description, visibility or pack key changed (a moderator's hide stays) and leave
 *       it alone otherwise. A pool whose pack a moderator deleted has a tombstone in
 *       deleted_origins and is never created again: the sync checks it first, and again after a
 *       create or a failed update, because a moderator's delete can land in between (the pack it
 *       just made is deleted again). Saves spend the pools-sync share of the osu! budget on their
 *       stats. A pool that went private or was deleted in pools loses its pack
 *       (DELETE /api/service/pools/{ref}): the pools account's pack with that origin is deleted,
 *       with no tombstone, so a later sync creates it again; a tombstoned pool is left alone. A
 *       pack a moderator hid leaves a hide marker in hidden_origins when pools deletes it, and the
 *       next create for that pool comes back hidden, so pools can't clear a hide by deleting and
 *       publishing again; a moderator's unhide drops the marker (src/services/moderation.ts).
 *       Every write marks the pack's page and every public list stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { RevisionAuthor } from "@haruhimemoe/next-kit/vcs";
import type { PackInput, PoolsSyncAnswer } from "@haruhimemoe/pool/service";
import { ObjectId } from "mongodb";
import {
  DELETED_ORIGINS_COLLECTION,
  HIDDEN_ORIGINS_COLLECTION,
  POOLS_ACCOUNT,
  POOLS_ORIGIN_KIND,
  POOLS_SYNC_SUBJECT,
} from "@/constants/pools";
import { connectedDb } from "@/lib/db";
import { packRevisions } from "@/lib/pack-revisions";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import type { SavedPack } from "@/schemas/saved-pack";
import {
  connectedPackModel,
  duplicateKeyOn,
  inputPackKey,
  type PackRecord,
  packKeyOf,
  toSavedPack,
} from "@/services/pack-records";
import { createPack, updatePack } from "@/services/packs";
import { ensurePoolsAccount } from "@/services/pools-account";

/** Who the pools account's own saves (creates, updates) are recorded as in pack history. */
const POOLS_AUTHOR: RevisionAuthor = { id: POOLS_ACCOUNT.id, name: POOLS_ACCOUNT.name };

/** A tombstone: the pools id (as _id) of a pack a moderator deleted. */
type DeletedOrigin = { _id: string; deletedAt: Date };

const tombstones = async () =>
  (await connectedDb()).collection<DeletedOrigin>(DELETED_ORIGINS_COLLECTION);

const isTombstoned = async (ref: string): Promise<boolean> =>
  (await (await tombstones()).findOne({ _id: ref })) !== null;

/**
 * @function tombstoneOrigin
 * @param originId {string} the pools id of a pack a moderator just deleted
 * @param now {Date} when (tests)
 * @returns {Promise<void>} remembers it, so no later sync creates that pool's pack again; a
 *          second delete keeps the first date
 */
export const tombstoneOrigin = async (originId: string, now: Date = new Date()): Promise<void> => {
  await (await tombstones()).updateOne(
    { _id: originId },
    { $setOnInsert: { deletedAt: now } },
    { upsert: true },
  );
};

/** A hide marker: a pools pack a moderator hid, then pools deleted (HIDDEN_ORIGINS_COLLECTION). */
type HiddenOrigin = { originId: string; hiddenAt: Date };

const hideMarkers = async () =>
  (await connectedDb()).collection<HiddenOrigin>(HIDDEN_ORIGINS_COLLECTION);

/** When a moderator hid the pool's last pack, if pools deleted it hidden; otherwise undefined. */
const hiddenSince = async (ref: string): Promise<Date | undefined> =>
  (await (await hideMarkers()).findOne({ originId: ref }))?.hiddenAt;

const rememberHidden = async (ref: string, hiddenAt: Date): Promise<void> => {
  await (await hideMarkers()).updateOne(
    { originId: ref },
    { $set: { hiddenAt } },
    { upsert: true },
  );
};

/**
 * @function forgetHiddenOrigin
 * @param originId {string} a pools pool id
 * @returns {Promise<void>} drops the pool's hide marker, if it has one: a moderator unhid its pack
 *          (src/services/moderation.ts), so the next pack pools creates for it is listed
 */
export const forgetHiddenOrigin = async (originId: string): Promise<void> => {
  await (await hideMarkers()).deleteOne({ originId });
};

/** The pack a pools pool became, or null. */
const findByOrigin = async (ref: string): Promise<PackRecord | null> =>
  (await connectedPackModel()).findOne({ "origin.id": ref }).lean();

const isListed = (pack: SavedPack): boolean =>
  pack.visibility === "public" && pack.hiddenAt === undefined;

/** Name, description, visibility and pack key (slots and buckets, in any order) all match. */
const sameInput = (pack: SavedPack, input: PackInput): boolean =>
  pack.name === input.name &&
  (pack.description ?? "") === (input.description ?? "") &&
  pack.visibility === input.visibility &&
  packKeyOf(pack) === inputPackKey(input);

const touch = (slug: string): void => {
  revalidatePack(slug);
  revalidatePublicPacks();
};

/** applyTo's answer when the pack it found is gone with no tombstone: pools deleted it. */
const VANISHED = "vanished";

/**
 * Updates the pack when the input changed; answers unchanged, with no write, otherwise. Null when
 * a moderator deleted the pack after it was found; VANISHED when pools' own DELETE did.
 */
const applyTo = async (
  doc: PackRecord,
  ownerId: string,
  input: PackInput,
  ref: string,
): Promise<PoolsSyncAnswer | typeof VANISHED | null> => {
  const current = toSavedPack(doc);
  if (sameInput(current, input)) {
    return { slug: current.slug, state: "unchanged", listed: isListed(current) };
  }
  const pack = await updatePack(current.slug, ownerId, input, {
    subject: POOLS_SYNC_SUBJECT,
    author: POOLS_AUTHOR,
  });
  if (!pack) {
    if (await isTombstoned(ref)) return null;
    if (!(await findByOrigin(ref))) return VANISHED;
    throw new Error(`pools pack ${current.slug} isn't the pools account's`);
  }
  touch(pack.slug);
  return { slug: pack.slug, state: "updated", listed: isListed(pack) };
};

/**
 * @function syncPoolsPack
 * @param ref {string} a validated pools pool id
 * @param input {PackInput} the validated pack, public or unlisted
 * @param deps {{ lookup?: (ref: string) => Promise<PackRecord | null> }} the first lookup by
 *        origin (tests stand in a stale one to reach the lost-race path)
 * @returns {Promise<PoolsSyncAnswer | null>} created, updated or unchanged, with the slug and
 *          whether /packs lists it; null when a moderator deleted this pool's pack, before or
 *          during this sync
 * @throws when the database fails, or a create fails for any reason but a lost race
 */
export const syncPoolsPack = async (
  ref: string,
  input: PackInput,
  { lookup = findByOrigin }: { lookup?: (ref: string) => Promise<PackRecord | null> } = {},
): Promise<PoolsSyncAnswer | null> => {
  if (await isTombstoned(ref)) return null;
  const ownerId = await ensurePoolsAccount();
  const existing = await lookup(ref);
  if (existing) {
    const applied = await applyTo(existing, ownerId, input, ref);
    // pools deleted the pack between the lookup and the update: make it again, as a first PUT.
    if (applied !== VANISHED) return applied;
  }
  return createFor(ref, ownerId, input);
};

/** The create path: a new pack for this pool, started hidden when a moderator's marker says so. */
const createFor = async (
  ref: string,
  ownerId: string,
  input: PackInput,
): Promise<PoolsSyncAnswer | null> => {
  // Pools deleted this pool's pack while a moderator had it hidden: the new one starts hidden, in
  // the same write, and the marker stays until a moderator unhides it.
  const hiddenAt = await hiddenSince(ref);
  let pack: SavedPack;
  try {
    pack = await createPack(ownerId, input, {
      unlimited: true,
      subject: POOLS_SYNC_SUBJECT,
      origin: { kind: POOLS_ORIGIN_KIND, id: ref },
      ...(hiddenAt ? { hiddenAt } : {}),
      author: POOLS_AUTHOR,
    });
  } catch (error) {
    // Another sync of this pool created it first: update that pack instead, once.
    if (!duplicateKeyOn(error, "origin.id")) throw error;
    const winner = await findByOrigin(ref);
    if (!winner) throw error;
    const applied = await applyTo(winner, ownerId, input, ref);
    if (applied === VANISHED) throw error;
    return applied;
  }
  // A moderator deleted this pool's pack after the first check: the create only got in because
  // that pack was gone, and its tombstone is written before the delete, so it's here by now.
  if (await isTombstoned(ref)) {
    await (await connectedPackModel()).collection.deleteOne({
      slug: pack.slug,
      "origin.id": ref,
    });
    touch(pack.slug);
    return null;
  }
  touch(pack.slug);
  return { slug: pack.slug, state: "created", listed: isListed(pack) };
};

/** What a delete from pools did: removed the pool's pack, found none, or found its tombstone. */
export type PoolsDeleteResult = "deleted" | "missing" | "gone";

/** Reads before a delete gives up on a pack a moderator keeps hiding and unhiding under it. */
const DELETE_ATTEMPTS = 3;

/**
 * @function deletePoolsPack
 * @param ref {string} a validated pools pool id
 * @param deps {{ afterRead?: () => Promise<unknown> }} runs after each read of the pack (tests
 *        hide or unhide it there to reach the retry)
 * @returns {Promise<PoolsDeleteResult>} "deleted" when the pools account's pack for that pool is
 *          gone (its stats with it); "missing" when there's no such pack (another owner's pack
 *          with that origin id doesn't count); "gone" when a moderator deleted it, touching
 *          nothing. Writes no tombstone, so a later sync creates the pack again. A hidden pack
 *          leaves a hide marker first (a failed write leaves the pack in place), so that sync
 *          creates it hidden; a visible one leaves none and drops a stale one.
 * @throws when the database fails, or the pack's hide keeps changing under the delete
 */
export const deletePoolsPack = async (
  ref: string,
  { afterRead = async () => {} }: { afterRead?: () => Promise<unknown> } = {},
): Promise<PoolsDeleteResult> => {
  if (await isTombstoned(ref)) return "gone";
  const packs = (await connectedPackModel()).collection;
  const filter = {
    "origin.kind": POOLS_ORIGIN_KIND,
    "origin.id": ref,
    ownerId: new ObjectId(POOLS_ACCOUNT.id),
  };
  for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt++) {
    const found = (await packs.findOne(filter, { projection: { slug: 1, hiddenAt: 1 } })) as {
      _id: ObjectId;
      slug: string;
      hiddenAt?: unknown;
    } | null;
    if (!found) return "missing";
    await afterRead();
    const hiddenAt = found.hiddenAt instanceof Date ? found.hiddenAt : null;
    if (hiddenAt) await rememberHidden(ref, hiddenAt);
    else await forgetHiddenOrigin(ref);
    // Only while the hide is as read: a moderator's hide or unhide in between means read again.
    const { deletedCount } = await packs.deleteOne({ _id: found._id, hiddenAt });
    if (deletedCount === 1) {
      await packRevisions.removeDoc(found.slug);
      touch(found.slug);
      return "deleted";
    }
  }
  throw new Error(`the pools pack for ${ref} kept changing while it was being deleted`);
};
