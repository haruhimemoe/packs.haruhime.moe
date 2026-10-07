/**
 * @file src/services/account-fanout.ts
 * @desc What the hub's account fan-out (/api/internal/account/[op]) deletes in packs, given an
 *       identity user id: deletePacksData (key, counters, owned packs and their history). Export
 *       is "Download my data"'s exportAccountData (src/services/account-export.ts). A system
 *       account (the pools account) is never a person: delete is a no-op for it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { isSystemUserId } from "@/lib/auth";
import { deletePacksData } from "@/services/account";

export { exportAccountData } from "@/services/account-export";

/**
 * @function deleteAccountData
 * @param userId {string} an identity user id
 * @returns {Promise<void>} once deletePacksData ran for them (running it again is fine)
 */
export const deleteAccountData = async (userId: string): Promise<void> => {
  if (isSystemUserId(userId)) return;
  await deletePacksData(userId);
};
