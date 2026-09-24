/**
 * @file src/services/api-packs.ts
 * @desc Packs as /api/v1 returns them: the saved-pack DTO plus packKey and the owner's osu!
 *       name. Reads go through services/packs and services/public-packs, so the API and the site
 *       share one set of visibility rules.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import "server-only";
import { ObjectId } from "mongodb";
import { API_PAGE_SIZE, UNKNOWN_OWNER_NAME } from "@/constants/api";
import { connectedDb } from "@/lib/db";
import type { ApiPack, ApiPackPage } from "@/schemas/api";
import type { SavedPack } from "@/schemas/saved-pack";
import type { ApiCaller } from "@/services/api-keys";
import { getPackWithOwner, listSavedPackPage, packKeyOf } from "@/services/packs";
import { listPublicPacksFull } from "@/services/public-packs";

/**
 * @function toApiPack
 * @param pack {SavedPack} a saved pack DTO
 * @param ownerName {string} its owner's osu! username
 * @returns {ApiPack} the DTO with packKey and ownerName
 */
export const toApiPack = (pack: SavedPack, ownerName: string): ApiPack => ({
  ...pack,
  packKey: packKeyOf(pack),
  ownerName,
});

const usernameOf = async (userId: string): Promise<string> => {
  const user = await (await connectedDb())
    .collection("user")
    .findOne({ _id: new ObjectId(userId) }, { projection: { username: 1 } });
  return typeof user?.username === "string" ? user.username : UNKNOWN_OWNER_NAME;
};

/**
 * @function getApiPack
 * @param slug {string} untrusted route segment
 * @param caller {ApiCaller} the key's owner
 * @returns {Promise<ApiPack | null>} null when missing, or private or hidden and not the
 *          caller's. An owner with no username (or no record) shows as UNKNOWN_OWNER_NAME.
 */
export const getApiPack = async (slug: string, caller: ApiCaller): Promise<ApiPack | null> => {
  const found = await getPackWithOwner(slug, caller.id);
  if (!found) return null;
  const ownerName = found.isOwner ? caller.username : await usernameOf(found.ownerId);
  return toApiPack(found.pack, ownerName);
};

/**
 * @function listOwnApiPacks
 * @param caller {ApiCaller} the key's owner
 * @param page {number} 1-based page
 * @returns {Promise<ApiPackPage>} API_PAGE_SIZE of their packs (any visibility, hidden ones
 *          included), most recently updated first
 */
export const listOwnApiPacks = async (caller: ApiCaller, page: number): Promise<ApiPackPage> => {
  const result = await listSavedPackPage(caller.id, page, API_PAGE_SIZE);
  return { ...result, packs: result.packs.map((pack) => toApiPack(pack, caller.username)) };
};

/**
 * @function listPublicApiPacks
 * @param page {number} 1-based page
 * @returns {Promise<ApiPackPage>} API_PAGE_SIZE public packs, most recently updated first
 */
export const listPublicApiPacks = async (page: number): Promise<ApiPackPage> => {
  const result = await listPublicPacksFull(page, API_PAGE_SIZE);
  return {
    ...result,
    packs: result.packs.map(({ pack, ownerName }) => toApiPack(pack, ownerName)),
  };
};
