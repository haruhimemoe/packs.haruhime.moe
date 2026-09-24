/**
 * @file src/services/account-export.ts
 * @desc "Download my data": everything we hold about one account, as the file
 *       content/legal/your-privacy-rights.mdx promises. Reads better-auth's user, linked account
 *       and session records directly (collection names as in src/services/account.ts), the packs through the
 *       packs service, and the API key's info (never its hash) through the API keys service.
 *       Never includes tokens or the synthetic email; accountExportSchema strips any field it
 *       doesn't name. Any new collection holding user data must be added here and in
 *       src/services/account.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "@/lib/db";
import { type AccountExport, accountExportSchema } from "@/schemas/account-export";
import { getApiKeyInfo } from "@/services/api-keys";
import { listSavedPacks } from "@/services/packs";

type UserRecord = {
  _id: ObjectId;
  osuId: number;
  username: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  createdAt: Date;
};

type AccountRecord = {
  userId: ObjectId;
  providerId: string;
  accountId: string;
  scope?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * @function exportAccountData
 * @param userId {string} signed-in user's id
 * @returns {Promise<AccountExport>} profile, the linked osu! account record (no tokens), every
 *          stored session (expired ones too, newest
 *          first; "" from better-auth becomes null), every saved pack, and the API key's info
 *          (null without one)
 * @throws {Error} when the user record is gone (the route has already checked the session)
 */
export const exportAccountData = async (userId: string): Promise<AccountExport> => {
  await connectDb();
  const id = new ObjectId(userId);
  const db = getDb();
  const user = await db.collection<UserRecord>("user").findOne({ _id: id });
  if (!user) throw new Error("exportAccountData: no user record for this id");
  const accounts = await db
    .collection<AccountRecord>("account")
    .find(
      { userId: id },
      { projection: { providerId: 1, accountId: 1, scope: 1, createdAt: 1, updatedAt: 1 } },
    )
    .sort({ createdAt: 1 })
    .toArray();
  const sessions = await db
    .collection<SessionRecord>("session")
    .find({ userId: id })
    .sort({ createdAt: -1 })
    .toArray();
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
    accounts: accounts.map((account) => ({
      provider: account.providerId,
      accountId: account.accountId,
      scope: account.scope || null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    })),
    sessions: sessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
    })),
    packs,
    apiKey: await getApiKeyInfo(userId),
  });
};
