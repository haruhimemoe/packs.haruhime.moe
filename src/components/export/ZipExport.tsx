/**
 * @file src/components/export/ZipExport.tsx
 * @desc The Download card's zip section: save the downloaded sets as one zip (streamed to disk where
 *       the browser allows, else built in memory with a warning for huge packs).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useEffect, useId, useState } from "react";
import { BLOB_FALLBACK_WARN_BYTES, type PackZipInput, packZipSize } from "@/lib/zip/pack-zip";
import { getSaveFilePicker, type SaveOutcome, saveZip } from "@/lib/zip/save-zip";
import { formatBytes } from "@/utils/format";

export type ZipExportProps = {
  input: PackZipInput;
  /** Slots left out because their set failed to download. */
  failedSlots: number;
  /** 4 when the card puts the mirror flow under its own h3 ("From the mirror"). Default 3. */
  headingLevel?: 3 | 4;
  /** Told true when a save starts and false when it ends; the card locks its download options. */
  onBusyChange?: (busy: boolean) => void;
  /** Test seams. Defaults: the real save dialog. */
  save?: (input: PackZipInput) => Promise<SaveOutcome>;
  canStream?: boolean;
  blobWarnBytes?: number;
};

export type ZipSeams = Pick<ZipExportProps, "save" | "canStream" | "blobWarnBytes">;

type SaveState = "idle" | "saving" | SaveOutcome | "error";

const SAVE_MESSAGES: Record<SaveState, string> = {
  idle: "",
  saving: "Building the zip…",
  streamed: "Zip saved.",
  downloaded: "Download started.",
  cancelled: "",
  error: "Couldn't save the zip. Try again.",
};

const maps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

export function ZipExport({
  input,
  failedSlots,
  headingLevel = 3,
  onBusyChange,
  save = saveZip,
  canStream,
  blobWarnBytes = BLOB_FALLBACK_WARN_BYTES,
}: ZipExportProps) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const headingId = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const streaming = canStream ?? getSaveFilePicker() !== null;
  const inMemorySize = streaming ? 0 : packZipSize(input);
  const saving = saveState === "saving";
  useEffect(() => {
    onBusyChange?.(saving);
  }, [saving, onBusyChange]);
  // Unmounting mid-save (a pool change) must not leave the card locked.
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  // Must stay synchronous up to save(): the save dialog needs this click.
  const onSave = () => {
    setSaveState("saving");
    save(input).then(setSaveState, () => setSaveState("error"));
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <Heading id={headingId} className="font-bold text-c1">
        Zip
      </Heading>
      <p className="text-c3 text-sm">One folder, numbered in pool order, with a pack.txt.</p>
      {inMemorySize > blobWarnBytes ? (
        <p className="text-amber-300 text-sm">
          This zip is about {formatBytes(inMemorySize)}. This browser has to build it in memory,
          which can fail for packs this big. Chrome and Edge save straight to disk instead.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={failedSlots > 0 ? "secondary" : "primary"}
          onClick={onSave}
          disabled={saveState === "saving"}
        >
          {failedSlots > 0 ? `Save .zip without ${maps(failedSlots)}` : "Save .zip"}
        </Button>
      </div>
      <output className="text-c3 text-sm">{SAVE_MESSAGES[saveState]}</output>
    </section>
  );
}
