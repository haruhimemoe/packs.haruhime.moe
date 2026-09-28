/**
 * @file src/components/export/DownloadOptions.tsx
 * @desc The Download card's "Download options" disclosure: include videos, include backgrounds.
 *       Closed, the button shows the current choice. Locked while the card is busy (downloading
 *       maps, saving a zip, making a torrent).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Checkbox, Disclosure } from "@haruhimemoe/ui";
import { useId, useState } from "react";
import type { DownloadChoices } from "@/schemas/download-choices";

/**
 * @function downloadOptionsSummary
 * @param choices {DownloadChoices} the current choice
 * @returns {string} e.g. "Download options: no videos, backgrounds"
 */
export const downloadOptionsSummary = ({ videos, backgrounds }: DownloadChoices): string =>
  `Download options: ${videos ? "videos" : "no videos"}, ${backgrounds ? "backgrounds" : "no backgrounds"}`;

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
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <Disclosure
      summary={open ? "Download options" : downloadOptionsSummary(choices)}
      open={open}
      onOpenChange={setOpen}
    >
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="sr-only">Download options</legend>
        <Checkbox
          id={`${id}-videos`}
          label="Include videos"
          hint="Videos make packs several times larger."
          checked={choices.videos}
          onChange={(event) => onChange({ ...choices, videos: event.currentTarget.checked })}
        />
        <Checkbox
          id={`${id}-backgrounds`}
          label="Include backgrounds"
          hint="Turn this off to remove background images in your browser. osu! shows its default background instead."
          checked={choices.backgrounds}
          onChange={(event) => onChange({ ...choices, backgrounds: event.currentTarget.checked })}
        />
        {disabled ? (
          <p className="text-c3 text-sm">
            You can change these once the download, zip or torrent is done.
          </p>
        ) : null}
      </fieldset>
    </Disclosure>
  );
}
