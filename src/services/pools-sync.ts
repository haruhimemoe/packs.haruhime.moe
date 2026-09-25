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
 *       stats. Every write marks the pack's page and every public list stale.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import {
  DELETED_ORIGINS_COLLECTION,
  POOLS_ORIGIN_KIND,
  POOLS_SYNC_SUBJECT,
} from "@/constants/pools";
import { connectedDb } from "@/lib/db";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import type { PoolsSyncAnswer } from "@/schemas/pools-service";
import type { PackInput, SavedPack } from "@/schemas/saved-pack";
import {
  connectedPackModel,
  createPack,
  duplicateKeyOn,
  inputPackKey,
  type PackRecord,
  packKeyOf,
  toSavedPack,
  updatePack,
} from "@/services/packs";
import { ensurePoolsAccount } from "@/services/pools-account";

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

/**
 * Updates the pack when the input changed; answers unchanged, with no write, otherwise. Null when
 * a moderator deleted the pack after it was found.
 */
const applyTo = async (
  doc: PackRecord,
  ownerId: string,
  input: PackInput,
  ref: string,
): Promise<PoolsSyncAnswer | null> => {
  const current = toSavedPack(doc);
  if (sameInput(current, input)) {
    return { slug: current.slug, state: "unchanged", listed: isListed(current) };
  }
  const pack = await updatePack(current.slug, ownerId, input, { subject: POOLS_SYNC_SUBJECT });
  if (!pack) {
    if (await isTombstoned(ref)) return null;
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
  if (existing) return applyTo(existing, ownerId, input, ref);
  let pack: SavedPack;
  try {
    pack = await createPack(ownerId, input, {
      unlimited: true,
      subject: POOLS_SYNC_SUBJECT,
      origin: { kind: POOLS_ORIGIN_KIND, id: ref },
    });
  } catch (error) {
    // Another sync of this pool created it first: update that pack instead, once.
    if (!duplicateKeyOn(error, "origin.id")) throw error;
    const winner = await findByOrigin(ref);
    if (!winner) throw error;
    return applyTo(winner, ownerId, input, ref);
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
