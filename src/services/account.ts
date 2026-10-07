/**
 * @file src/services/account.ts
 * @desc Deleting someone's packs data: their API key and its rate-limit counters first (so an
 *       API write can't add a pack mid-deletion), then their packs and each pack's history.
 *       Mirrors content/legal/privacy.mdx ("Getting or deleting your data"). Any new collection
 *       holding user data must be deleted here too. The haruhime account itself (user, sessions,
 *       the osu! link) lives in the hub's identity database, which packs can't write: it's
 *       deleted on haruhime.moe/account. A failure partway can simply be retried.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { apiKeys } from "@/lib/api-keys";
import { connectDb } from "@/lib/db";
import { packRevisions } from "@/lib/pack-revisions";
import { deleteRateLimitsFor } from "@/lib/rate-limit";
import { revalidatePack, revalidatePublicPacks } from "@/lib/revalidate";
import { getPackModel } from "@/models/Pack";

/**
 * @function deletePacksData
 * @param userId {string} signed-in user's id
 * @returns {Promise<void>} resolves once their API key, counters, packs and pack history are gone
 */
export const deletePacksData = async (userId: string): Promise<void> => {
  await connectDb();
  const id = new ObjectId(userId);
  // Cut off every way to write first, so no pack can be created after the packs go.
  await apiKeys.deleteFor(id.toString());
  await deleteRateLimitsFor(userId);
  const packs = getPackModel();
  const listed = await packs.exists({ ownerId: id, visibility: "public" });
  const slugs = (await packs.find({ ownerId: id }, { slug: 1 }).lean()).map((doc) => doc.slug);
  await packs.deleteMany({ ownerId: id });
  for (const slug of slugs) {
    await packRevisions.removeDoc(slug);
    revalidatePack(slug);
  }
  if (listed) revalidatePublicPacks();
};
