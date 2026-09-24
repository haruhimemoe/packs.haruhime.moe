/**
 * @file src/services/archive.ts
 * @desc The system account that owns imported tournament pools. ensureArchiveAccount creates it:
 *       a users record with `system: true`, no osu! id and no linked osu! account, so nobody can
 *       sign in or use an API key as it (src/lib/auth.ts, src/services/api-keys.ts). Its packs
 *       have no cap (createPack's `unlimited`).
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
