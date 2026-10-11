/**
 * @file src/components/export/ZipExport.tsx
 * @desc The Download card's zip section: save the downloaded sets as one zip (streamed to disk where
 *       the browser allows, else built in memory with a warning for huge packs).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { formatBytes } from "@haruhimemoe/osu/format";
import { Button, Text, textClasses } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { BLOB_FALLBACK_WARN_BYTES, type PackZipInput, packZipSize } from "@/lib/zip/pack-zip";
import { getSaveFilePicker, type SaveOutcome, saveZip } from "@/lib/zip/save-zip";
import { countOf } from "@/utils/text";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

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

const SAVE_MESSAGES = (t: T): Record<SaveState, string> => ({
  idle: "",
  saving: t("buildingTheZip"),
  streamed: t("zipSaved"),
  downloaded: t("downloadStarted"),
  cancelled: "",
  error: t("couldnTSaveThe"),
});

/**
 * @function ZipExport
 * @param props {ZipExportProps} input, failedSlots, headingLevel, onBusyChange, save, canStream,
 *        blobWarnBytes
 * @returns {JSX.Element} the Download card's zip section
 */
export function ZipExport({
  input,
  failedSlots,
  headingLevel = 3,
  onBusyChange,
  save = saveZip,
  canStream,
  blobWarnBytes = BLOB_FALLBACK_WARN_BYTES,
}: ZipExportProps) {
  const t = useTranslations("packs.zipExport");
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
        {t("zip")}
      </Heading>
      <Text tone="muted">{t("oneFolderNumberedIn")}</Text>
      {inMemorySize > blobWarnBytes ? (
        <Text tone="warning">
          This zip is about {formatBytes(inMemorySize)}. This browser has to build it in memory,
          which can fail for packs this big. Chrome and Edge save straight to disk instead.
        </Text>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={failedSlots > 0 ? "secondary" : "primary"}
          onClick={onSave}
          disabled={saveState === "saving"}
        >
          {failedSlots > 0
            ? t("saveZipWithoutMap", { map: countOf(failedSlots, "map") })
            : t("saveZip")}
        </Button>
      </div>
      <output className={textClasses({ tone: "muted" })}>{SAVE_MESSAGES(t)[saveState]}</output>
    </section>
  );
}
