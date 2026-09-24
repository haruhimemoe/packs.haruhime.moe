/**
 * @file src/lib/storage/osz-cache.ts
 * @desc Finished .osz downloads cached in the browser's Origin Private File System, so a second
 *       export of the same pool downloads nothing. One file per variant in osz/: "<setId>n.osz"
 *       (no video) and "<setId>.osz" (with video) hold the mirror's file; "<setId>nb.osz" and
 *       "<setId>b.osz" hold the same sets with backgrounds removed (b). Best effort: no OPFS, a
 *       full quota, or a failed write just means "not cached". The bytes stay on the user's device.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

export const OSZ_CACHE_DIR = "osz";

/** Which copy of a set: with or without its video, as the mirror sent it or without backgrounds. */
export type OszVariant = { video?: boolean; noBackgrounds?: boolean };

/**
 * @function cacheFileName
 * @param setId {number} beatmapset id
 * @param variant {OszVariant} which copy (default: no video, as the mirror sent it)
 * @returns {string} "<setId>n.osz" (n = no video) or "<setId>.osz" (with video), with a "b"
 *          before ".osz" when backgrounds were removed: "<setId>nb.osz", "<setId>b.osz"
 */
export const cacheFileName = (
  setId: number,
  { video = false, noBackgrounds = false }: OszVariant = {},
): string => `${setId}${video ? "" : "n"}${noBackgrounds ? "b" : ""}.osz`;

export type OszCache = {
  get(setId: number, variant?: OszVariant): Promise<File | null>;
  put(setId: number, blob: Blob, variant?: OszVariant): Promise<Blob>;
  clear(): Promise<void>;
};

type RootGetter = () => Promise<FileSystemDirectoryHandle | null>;

const opfsRoot: RootGetter = async () => {
  try {
    return (await globalThis.navigator?.storage?.getDirectory?.()) ?? null;
  } catch {
    // Firefox private windows reject with SecurityError.
    return null;
  }
};

/**
 * @function createOszCache
 * @param getRoot {RootGetter} OPFS root, or null when unavailable (injectable for tests)
 * @returns {OszCache}
 */
export const createOszCache = (getRoot: RootGetter = opfsRoot): OszCache => {
  const directory = async (create: boolean) => {
    const root = await getRoot();
    return root ? root.getDirectoryHandle(OSZ_CACHE_DIR, { create }) : null;
  };

  return {
    async get(setId, variant) {
      try {
        const dir = await directory(false);
        if (!dir) return null;
        const file = await (await dir.getFileHandle(cacheFileName(setId, variant))).getFile();
        return file.size > 0 ? file : null;
      } catch {
        return null;
      }
    },

    async put(setId, blob, variant) {
      const name = cacheFileName(setId, variant);
      let dir: FileSystemDirectoryHandle | null = null;
      try {
        dir = await directory(true);
        if (!dir) return blob;
        const handle = await dir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        try {
          await writable.write(blob);
          await writable.close();
        } catch (error) {
          await writable.abort().catch(() => undefined);
          throw error;
        }
        // The File is disk-backed, so the in-memory download can be garbage collected.
        return await handle.getFile();
      } catch {
        await dir?.removeEntry(name).catch(() => undefined);
        return blob;
      }
    },

    async clear() {
      const root = await getRoot();
      if (!root) return;
      try {
        await root.removeEntry(OSZ_CACHE_DIR, { recursive: true });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
      }
    },
  };
};

/** Shared default cache for the app. */
export const oszCache: OszCache = createOszCache();
