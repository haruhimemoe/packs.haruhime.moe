/**
 * @file src/services/account.ts
 * @desc Account deletion: the user's API key and its rate-limit counters and their sessions
 *       first (so an API write can't add a pack mid-deletion), then packs, the osu!
 *       account link, and last the user record. Mirrors content/legal/privacy.mdx ("Getting
 *       or deleting your data"). Any new collection holding user data must be deleted here too.
 *       Collection names are better-auth's mongodb-adapter defaults; tests/integration/app/api/me.test.ts
 *       pins them against real better-auth rows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "@/lib/db";
import { deleteRateLimitsFor } from "@/lib/rate-limit";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { getApiKeyModel } from "@/models/ApiKey";
import { getPackModel } from "@/models/Pack";

/**
 * @function deleteAccount
 * @param userId {string} signed-in user's id
 * @returns {Promise<void>} resolves once every record is gone. The user record goes last, so a
 *          failure part-way leaves an account the person can sign back into and delete again.
 */
export const deleteAccount = async (userId: string): Promise<void> => {
  await connectDb();
  const id = new ObjectId(userId);
  const db = getDb();
  // Cut off every way to write first, so no pack can be created after the packs go.
  await getApiKeyModel().deleteMany({ userId: id });
  await deleteRateLimitsFor(userId);
  await db.collection("session").deleteMany({ userId: id });
  const packs = getPackModel();
  const listed = await packs.exists({ ownerId: id, visibility: "public" });
  const slugs = (await packs.find({ ownerId: id }, { slug: 1 }).lean()).map((doc) => doc.slug);
  await packs.deleteMany({ ownerId: id });
  for (const slug of slugs) revalidatePack(slug);
  if (listed) revalidatePublicPacks();
  await db.collection("account").deleteMany({ userId: id });
  await db.collection("user").deleteOne({ _id: id });
};
