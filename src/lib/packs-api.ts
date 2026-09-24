/**
 * @file src/lib/packs-api.ts
 * @desc Browser client for our own JSON API (/api/packs, /api/me, /api/me/api-key, /api/admin/packs,
 *       /api/admin/pack-stats). Errors carry the server's message so components can show it as-is.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { type ApiKeyCreated, apiErrorSchema, apiKeyCreatedSchema } from "@/schemas/api";
import { type PackExport, packExportsSchema } from "@/schemas/pack-export";
import { type PackStatsJob, packStatsJobSchema } from "@/schemas/pack-stats";
import { type AdminPackRow, adminPackRowSchema } from "@/schemas/public-pack";
import { type PackInputBody, type SavedPack, savedPackSchema } from "@/schemas/saved-pack";

export class PacksApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PacksApiError";
    this.status = status;
  }
}

const packResponseSchema = z.object({ pack: savedPackSchema });
const adminRowResponseSchema = z.object({ pack: adminPackRowSchema });
const exportsResponseSchema = z.object({ exports: packExportsSchema });
const viewerResponseSchema = z.object({
  pack: savedPackSchema,
  isOwner: z.boolean(),
  isAdmin: z.boolean().default(false),
});

export type PackViewer = z.infer<typeof viewerResponseSchema>;

type PacksApiOptions = {
  baseUrl?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
};

/**
 * @function createPacksApi
 * @param options {PacksApiOptions} base URL and fetch (tests)
 * @returns {{ get; create; update; remove; deleteAccount; createApiKey; revokeApiKey; setHidden; adminRemove; fillPackStats; addMagnet; removeMagnet; adminRemoveMagnet }}
 */
export const createPacksApi = ({
  baseUrl = "",
  fetch: doFetch = (input, init) => globalThis.fetch(input, init),
}: PacksApiOptions = {}) => {
  const request = async (path: string, init: RequestInit): Promise<Response> => {
    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, init);
    } catch (cause) {
      throw new PacksApiError(
        "Couldn't reach packs.haruhime.moe. Check your connection and try again.",
        null,
        { cause },
      );
    }
    if (response.ok) return response;
    const body = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new PacksApiError(
      body.success
        ? body.data.error.message
        : `Something went wrong (${response.status}). Try again.`,
      response.status,
    );
  };

  const sendPack = async (method: "POST" | "PUT", path: string, input: PackInputBody) => {
    const response = await request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return packResponseSchema.parse(await response.json()).pack;
  };

  return {
    /** @function get @param slug {string} @returns {Promise<PackViewer | null>} the pack, and whether the viewer owns it or is an admin; null when not found for this viewer */
    get: async (slug: string): Promise<PackViewer | null> => {
      try {
        const response = await request(`/api/packs/${encodeURIComponent(slug)}`, { method: "GET" });
        return viewerResponseSchema.parse(await response.json());
      } catch (error) {
        if (error instanceof PacksApiError && error.status === 404) return null;
        throw error;
      }
    },
    /** @function create @param input {PackInputBody} @returns {Promise<SavedPack>} */
    create: (input: PackInputBody): Promise<SavedPack> => sendPack("POST", "/api/packs", input),
    /** @function update @param slug {string} @param input {PackInputBody} @returns {Promise<SavedPack>} */
    update: (slug: string, input: PackInputBody): Promise<SavedPack> =>
      sendPack("PUT", `/api/packs/${encodeURIComponent(slug)}`, input),
    /** @function remove @param slug {string} @returns {Promise<void>} */
    remove: async (slug: string): Promise<void> => {
      await request(`/api/packs/${encodeURIComponent(slug)}`, { method: "DELETE" });
    },
    /** @function deleteAccount @returns {Promise<void>} */
    deleteAccount: async (): Promise<void> => {
      await request("/api/me", { method: "DELETE" });
    },
    /** @function createApiKey @returns {Promise<ApiKeyCreated>} a new key (shown once); replaces the old one */
    createApiKey: async (): Promise<ApiKeyCreated> => {
      const response = await request("/api/me/api-key", { method: "POST" });
      return apiKeyCreatedSchema.parse(await response.json());
    },
    /** @function revokeApiKey @returns {Promise<void>} */
    revokeApiKey: async (): Promise<void> => {
      await request("/api/me/api-key", { method: "DELETE" });
    },
    /** @function setHidden @param slug {string} @param hidden {boolean} @returns {Promise<AdminPackRow>} */
    setHidden: async (slug: string, hidden: boolean): Promise<AdminPackRow> => {
      const response = await request(`/api/admin/packs/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      return adminRowResponseSchema.parse(await response.json()).pack;
    },
    /** @function adminRemove @param slug {string} @returns {Promise<void>} */
    adminRemove: async (slug: string): Promise<void> => {
      await request(`/api/admin/packs/${encodeURIComponent(slug)}`, { method: "DELETE" });
    },
    /** @function fillPackStats @returns {Promise<PackStatsJob>} runs one batch of the stats job (admins only): packs updated, packs left, packs waiting to retry */
    fillPackStats: async (): Promise<PackStatsJob> => {
      const response = await request("/api/admin/pack-stats", { method: "POST" });
      return packStatsJobSchema.parse(await response.json());
    },
    /** @function addMagnet @param slug {string} @param url {string} @param packKey {string} the key the torrent was made from @returns {Promise<PackExport[]>} */
    addMagnet: async (slug: string, url: string, packKey: string): Promise<PackExport[]> => {
      const response = await request(`/api/packs/${encodeURIComponent(slug)}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "magnet", url, packKey }),
      });
      return exportsResponseSchema.parse(await response.json()).exports;
    },
    /** @function removeMagnet @param slug {string} @param url {string} @returns {Promise<PackExport[]>} */
    removeMagnet: async (slug: string, url: string): Promise<PackExport[]> => {
      const response = await request(
        `/api/packs/${encodeURIComponent(slug)}/exports?url=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
      return exportsResponseSchema.parse(await response.json()).exports;
    },
    /** @function adminRemoveMagnet @param slug {string} @param url {string} @returns {Promise<PackExport[]>} the links left (admins only) */
    adminRemoveMagnet: async (slug: string, url: string): Promise<PackExport[]> => {
      const response = await request(
        `/api/admin/packs/${encodeURIComponent(slug)}/exports?url=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
      return exportsResponseSchema.parse(await response.json()).exports;
    },
  };
};

export const packsApi = createPacksApi();
