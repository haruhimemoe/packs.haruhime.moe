/**
 * @file src/services/archive.ts
 * @desc Archive packs in the database (pool archive spec). ensureArchiveAccount creates the system
 *       account that owns every archive pack: a users record with `system: true`, no osu! id and
 *       no linked osu! account, so nobody can sign in or use an API key as it (src/lib/auth.ts,
 *       src/services/api-keys.ts). It has no pack cap: the importer writes its packs directly.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { ARCHIVE_ACCOUNT } from "@/constants/archive";
import { connectedDb } from "@/lib/db";

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
