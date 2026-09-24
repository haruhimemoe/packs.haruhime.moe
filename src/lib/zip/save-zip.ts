/**
 * @file src/lib/zip/save-zip.ts
 * @desc Saves a pack zip. Chromium: showSaveFilePicker, streaming straight to disk. Everything else
 *       (or a refused dialog): build a Blob and trigger a normal download. Browser-only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { type PackZipInput, packZipStream } from "@/lib/zip/pack-zip";

/** showSaveFilePicker is Chromium-only and not in TypeScript's DOM lib. */
export type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

export type SaveOutcome = "streamed" | "downloaded" | "cancelled";

export type SaveZipDeps = {
  picker: SaveFilePicker | null;
  downloadBlob: (blob: Blob, filename: string) => void;
};

/**
 * @function getSaveFilePicker
 * @returns {SaveFilePicker | null} the browser's save dialog, or null where it doesn't exist
 */
export const getSaveFilePicker = (): SaveFilePicker | null => {
  const picker = (globalThis as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  return typeof picker === "function" ? picker.bind(globalThis) : null;
};

/**
 * @function downloadBlob
 * @param blob {Blob} file contents
 * @param filename {string} suggested name
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

/**
 * @function saveZip
 * @param input {PackZipInput} plan + blobs
 * @param deps {SaveZipDeps} save dialog and download trigger (injectable for tests)
 * @returns {Promise<SaveOutcome>} how it was saved, or "cancelled" when the user closed the dialog
 * Call it straight from a click handler: the dialog needs the user's click, so it is the first await.
 */
export const saveZip = async (
  input: PackZipInput,
  deps: SaveZipDeps = { picker: getSaveFilePicker(), downloadBlob },
): Promise<SaveOutcome> => {
  if (deps.picker) {
    let handle: FileSystemFileHandle | null = null;
    try {
      handle = await deps.picker({
        suggestedName: input.plan.zipName,
        types: [{ description: "Zip archive", accept: { "application/zip": [".zip"] } }],
      });
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      // Refused (e.g. the click is too old): fall through to a normal download.
    }
    if (handle) {
      await packZipStream(input).pipeTo(await handle.createWritable());
      return "streamed";
    }
  }
  const zipped = await new Response(packZipStream(input)).blob();
  deps.downloadBlob(new Blob([zipped], { type: "application/zip" }), input.plan.zipName);
  return "downloaded";
};
