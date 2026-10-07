/**
 * @file src/services/account-export.ts
 * @desc "Download my data": everything packs holds about one person, as the file
 *       content/legal/your-privacy-rights.mdx promises: who they are (read from the hub's identity
 *       user, read-only), the packs through the packs service, and the API key's info (never its
 *       hash) through the API keys service. Sessions and the osu! link belong to the haruhime.moe
 *       account, so they aren't here: haruhime.moe exports those. Never includes tokens or the
 *       synthetic email; accountExportSchema strips any field it doesn't name. Any new collection
 *       holding user data must be added here and in src/services/account.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { connectDb, getIdentityDb } from "@/lib/db";
import { type AccountExport, accountExportSchema } from "@/schemas/account-export";
import { getApiKeyInfo } from "@/services/api-keys";
import { listSavedPacks } from "@/services/pack-reads";

type UserRecord = {
  _id: ObjectId;
  osuId: number;
  username: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  createdAt: Date;
};

/**
 * @function exportAccountData
 * @param userId {string} signed-in user's id
 * @returns {Promise<AccountExport>} profile, every saved pack, and the API key's info (null
 *          without one)
 * @throws {Error} when the user record is gone (the route has already checked the session)
 */
export const exportAccountData = async (userId: string): Promise<AccountExport> => {
  await connectDb();
  const user = await getIdentityDb()
    .collection<UserRecord>("user")
    .findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error("exportAccountData: no user record for this id");
  const packs = await listSavedPacks(userId);
  return accountExportSchema.parse({
    exportedAt: new Date().toISOString(),
    user: {
      id: user._id.toHexString(),
      osuId: user.osuId,
      username: user.username,
      avatarUrl: user.avatarUrl ?? null,
      country: user.countryCode ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    packs,
    apiKey: await getApiKeyInfo(userId),
  });
};
