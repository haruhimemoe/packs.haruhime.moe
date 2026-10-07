/**
 * @file src/services/owners.ts
 * @desc Pack owners' names and avatars. People are haruhime.moe users, read from the hub's
 *       identity database (read-only, one `$in` query per list: a `$lookup` can't reach another
 *       database). System accounts (SYSTEM_USER_IDS, the haruhime pools account) aren't identity
 *       users: their name and avatar come from src/constants/pools.ts. An owner with no username,
 *       or no record at all, is missing from the map, and each caller decides what that means.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { SYSTEM_USER_IDS } from "@/constants/db";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { connectDb, getIdentityDb } from "@/lib/db";

/** A pack owner as lists show them. osuId is null for a system account (no osu! profile). */
export type Owner = { username: string; avatarUrl: string | null; osuId: number | null };

const POOLS_OWNER: Owner = {
  username: POOLS_ACCOUNT.name,
  avatarUrl: POOLS_ACCOUNT.avatarUrl,
  osuId: null,
};

const hexOf = (id: unknown): string | null =>
  id instanceof ObjectId ? id.toHexString() : typeof id === "string" ? id : null;

/**
 * @function findOwners
 * @param ids {readonly unknown[]} owner ids (ObjectIds or hex strings; anything else is skipped)
 * @returns {Promise<Map<string, Owner>>} each known owner by hex id
 */
export const findOwners = async (ids: readonly unknown[]): Promise<Map<string, Owner>> => {
  const owners = new Map<string, Owner>();
  const people = new Set<string>();
  for (const id of ids) {
    const hex = hexOf(id);
    if (!hex) continue;
    if (SYSTEM_USER_IDS.has(hex)) owners.set(hex, POOLS_OWNER);
    else if (ObjectId.isValid(hex)) people.add(hex);
  }
  if (people.size === 0) return owners;
  await connectDb();
  const rows = await getIdentityDb()
    .collection("user")
    .find(
      { _id: { $in: [...people].map((hex) => new ObjectId(hex)) } },
      { projection: { username: 1, avatarUrl: 1, osuId: 1 } },
    )
    .toArray();
  for (const row of rows) {
    if (typeof row.username !== "string") continue;
    owners.set(row._id.toHexString(), {
      username: row.username,
      avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : null,
      osuId: typeof row.osuId === "number" ? row.osuId : null,
    });
  }
  return owners;
};

/**
 * @function ownerOf
 * @param owners {Map<string, Owner>} from findOwners
 * @param id {unknown} one owner id
 * @returns {Owner | undefined} that owner, when known
 */
export const ownerOf = (owners: Map<string, Owner>, id: unknown): Owner | undefined => {
  const hex = hexOf(id);
  return hex ? owners.get(hex) : undefined;
};
