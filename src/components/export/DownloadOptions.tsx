/**
 * @file src/components/export/DownloadOptions.tsx
 * @desc The Download card's "Download options" disclosure: include videos, include backgrounds.
 *       Closed, the button shows the current choice. Locked while the card is busy (downloading
 *       maps, saving a zip, making a torrent).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { useId, useState } from "react";
import type { DownloadChoices } from "@/schemas/download-choices";

/**
 * @function downloadOptionsSummary
 * @param choices {DownloadChoices} the current choice
 * @returns {string} e.g. "Download options: no videos, backgrounds"
 */
export const downloadOptionsSummary = ({ videos, backgrounds }: DownloadChoices): string =>
  `Download options: ${videos ? "videos" : "no videos"}, ${backgrounds ? "backgrounds" : "no backgrounds"}`;

type ChoiceProps = {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Choice({ label, hint, checked, onChange }: ChoiceProps) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-1 accent-h1"
      />
      <span>
        <span className="font-bold text-c1">{label}</span>
        <span className="text-c3"> · {hint}</span>
      </span>
    </label>
  );
}

type DownloadOptionsProps = {
  choices: DownloadChoices;
  onChange: (next: DownloadChoices) => void;
  /** True while maps download, a zip is saving or a torrent is being made. */
  disabled?: boolean;
};

export function DownloadOptions({ choices, onChange, disabled = false }: DownloadOptionsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 self-start font-bold text-c2 text-sm transition-colors hover:text-c1 focus-visible:outline-2 focus-visible:outline-h1 focus-visible:outline-offset-2"
      >
        {open ? "Download options" : downloadOptionsSummary(choices)}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <fieldset id={panelId} hidden={!open} disabled={disabled} className="flex flex-col gap-2">
        <legend className="sr-only">Download options</legend>
        <Choice
          label="Include videos"
          hint="Videos make packs several times larger."
          checked={choices.videos}
          onChange={(videos) => onChange({ ...choices, videos })}
        />
        <Choice
          label="Include backgrounds"
          hint="Turn this off to remove background images in your browser. osu! shows its default background instead."
          checked={choices.backgrounds}
          onChange={(backgrounds) => onChange({ ...choices, backgrounds })}
        />
        {disabled ? (
          <p className="text-c3 text-sm">
            You can change these once the download, zip or torrent is done.
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}
