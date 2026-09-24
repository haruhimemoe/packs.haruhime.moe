/**
 * @file src/services/pools-account.ts
 * @desc ensurePoolsAccount creates the haruhime pools account (src/constants/pools.ts) the first
 *       time pools.haruhime.moe publishes a pack: a users record with `system: true`, no osu! id
 *       and no linked osu! account, so nobody can sign in or use an API key as it
 *       (src/lib/auth.ts, src/services/api-keys.ts). Its packs have no cap (createPack's
 *       `unlimited`). The record is keyed on its fixed id, so first calls racing still make one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { connectedDb } from "@/lib/db";

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

/**
 * @function ensurePoolsAccount
 * @param now {Date} creation time when the account doesn't exist yet (tests)
 * @returns {Promise<string>} the pools account's user id (POOLS_ACCOUNT.id). Creates the account
 *          on first call and only refreshes its name, email and avatar after that.
 */
export const ensurePoolsAccount = async (now: Date = new Date()): Promise<string> => {
  const users = (await connectedDb()).collection("user");
  try {
    await users.updateOne(
      { _id: new ObjectId(POOLS_ACCOUNT.id) },
      {
        $set: {
          system: true,
          email: POOLS_ACCOUNT.email,
          name: POOLS_ACCOUNT.name,
          username: POOLS_ACCOUNT.name,
          image: POOLS_ACCOUNT.avatarUrl,
          avatarUrl: POOLS_ACCOUNT.avatarUrl,
        },
        $setOnInsert: { emailVerified: false, createdAt: now, updatedAt: now },
      },
      { upsert: true },
    );
  } catch (error) {
    // Two first calls at once: the other one created it.
    if (!isDuplicateKey(error)) throw error;
  }
  return POOLS_ACCOUNT.id;
};
