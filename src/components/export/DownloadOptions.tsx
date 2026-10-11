/**
 * @file src/components/export/DownloadOptions.tsx
 * @desc The Download card's "Download options" disclosure: include videos, include backgrounds.
 *       Closed, the button shows the current choice. Locked while the card is busy (downloading
 *       maps, saving a zip, making a torrent).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { Checkbox, Disclosure, Text } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { DownloadChoices } from "@/schemas/download-choices";

/** A translator: next-intl's t for "packs.downloadOptions". */
type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * @function downloadOptionsSummary
 * @param t {T} the "packs.downloadOptions" translator
 * @param choices {DownloadChoices} the current choice
 * @returns {string} e.g. "Download options: no videos, backgrounds"
 */
export const downloadOptionsSummary = (t: T, { videos, backgrounds }: DownloadChoices): string =>
  t("summary", { videos: String(videos), backgrounds: String(backgrounds) });

type DownloadOptionsProps = {
  choices: DownloadChoices;
  onChange: (next: DownloadChoices) => void;
  /** True while maps download, a zip is saving or a torrent is being made. */
  disabled?: boolean;
};

/**
 * @function DownloadOptions
 * @param props {DownloadOptionsProps} the choices, a change handler, and whether they're locked
 * @returns {JSX.Element} a @haruhimemoe/ui Disclosure whose button sums up the choices while closed
 */
export function DownloadOptions({ choices, onChange, disabled = false }: DownloadOptionsProps) {
  const t = useTranslations("packs.downloadOptions");
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <Disclosure
      summary={open ? t("downloadOptions") : downloadOptionsSummary(t, choices)}
      open={open}
      onOpenChange={setOpen}
    >
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="sr-only">{t("downloadOptions")}</legend>
        <Checkbox
          id={`${id}-videos`}
          label={t("includeVideos")}
          hint={t("videosMakePacksSeveral")}
          checked={choices.videos}
          onChange={(event) => onChange({ ...choices, videos: event.currentTarget.checked })}
        />
        <Checkbox
          id={`${id}-backgrounds`}
          label={t("includeBackgrounds")}
          hint={t("turnThisOffTo")}
          checked={choices.backgrounds}
          onChange={(event) => onChange({ ...choices, backgrounds: event.currentTarget.checked })}
        />
        {disabled ? <Text tone="muted">{t("youCanChangeThese")}</Text> : null}
      </fieldset>
    </Disclosure>
  );
}
