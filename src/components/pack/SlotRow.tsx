/**
 * @file src/components/pack/SlotRow.tsx
 * @desc One pool slot: badge, cover, title/difficulty/mapper, stars + stats, stars with mods,
 *       Copy ID (the beatmap ID, for "!mp map"), optional move and remove, and "Used in N pools"
 *       in the stats line when other archive pools used the map (only once the map's details
 *       show, so both land together). A press of Copy ID never moves the row:
 *       its status has room kept for it. Editable rows put their controls on their own line
 *       below lg, so the map keeps room for its title.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { beatmapUrl, coverUrl } from "@haruhimemoe/osu/shapes";
import { type SlotMods, slotTitle } from "@haruhimemoe/pool";
import { Button, CopyButton, fieldClasses } from "@haruhimemoe/ui";
import Image from "next/image";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import { BeatmapStats } from "@/components/beatmap/BeatmapStats";
import { StarRating } from "@/components/beatmap/StarRating";
import { MapUsage } from "@/components/pack/MapUsage";
import { ModBadge } from "@/components/pack/ModBadge";
import { NO_SLOT_VALUE } from "@/constants/mods";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { MapUsageEntry } from "@/schemas/map-usage";
import type { BucketEntry, PoolSlot, SlotBucket } from "@/schemas/pack";
import { type ModdedRating, slotStars } from "@/utils/slot-stars";

export type MoveTarget = { value: SlotBucket; label: string; disabled: boolean };

const VIEW_ROW = "flex flex-wrap items-center gap-3 sm:flex-nowrap";
const EDIT_ROW = "flex flex-wrap items-center gap-3 lg:flex-nowrap";
const VIEW_ACTIONS = "flex w-full items-center gap-3 sm:w-auto sm:shrink-0";
const EDIT_ACTIONS =
  "flex w-full flex-wrap items-center gap-3 sm:justify-end lg:w-auto lg:shrink-0 lg:flex-nowrap";

type SlotRowProps = {
  slot: PoolSlot;
  entry: BucketEntry | null;
  state: MetaState;
  onRemove?: () => void;
  moveTargets?: readonly MoveTarget[];
  onMove?: (to: SlotBucket) => void;
  /** What this slot plays with. Absent: shown without mods. */
  slotMods?: SlotMods;
  /** Ratings with mods: absent while calculating, empty when they couldn't be calculated. */
  ratings?: readonly ModdedRating[];
  /** Other archive pools that used this map (map usage). Absent or empty: nothing shows. */
  usage?: readonly MapUsageEntry[];
  /** Copy ID's key: a new one starts it over, clearing its "Copied." (PoolTable). */
  copyKey?: number;
  /** Called on every press of Copy ID, before it copies. */
  onCopy?: () => void;
};

const body = (
  slot: PoolSlot,
  state: MetaState,
  slotMods: SlotMods | undefined,
  ratings: readonly ModdedRating[] | undefined,
  usage: readonly MapUsageEntry[] | undefined,
): ReactNode => {
  switch (state.status) {
    case "found": {
      const { meta } = state;
      const stars = slotStars(meta.starRating, slotMods, ratings);
      return (
        <>
          <Image
            src={coverUrl(meta.beatmapsetId, "list@2x")}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="size-12 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <a
              href={beatmapUrl(meta.beatmapId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block max-w-full truncate align-top font-bold text-c1 hover:underline"
            >
              {meta.artist} - {meta.title}
            </a>
            <p className="truncate text-c3 text-sm">
              [{meta.version}] mapped by {meta.creator}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StarRating value={stars.stars} title={stars.title} label={stars.label} />
              <BeatmapStats meta={meta} />
              {/* In the stats line, not under the row, so an answer that comes after the map's
                details adds no line; and only here, so it never shows before them. */}
              {usage ? <MapUsage beatmapId={slot.beatmapId} entries={usage} /> : null}
            </div>
            {stars.freemod ? (
              <p className="mt-1 text-c4 text-xs">
                <span className="sr-only">With mods:</span>{" "}
                <span>
                  {stars.freemod.map((entry, i) => (
                    <Fragment key={entry}>
                      {i > 0 ? " · " : null}
                      <span className="whitespace-nowrap">{entry}</span>
                    </Fragment>
                  ))}
                </span>
              </p>
            ) : null}
          </div>
        </>
      );
    }
    case "loading":
      return <p className="flex-1 text-c4 text-sm">Loading beatmap {slot.beatmapId}…</p>;
    case "missing":
      return (
        <p className="flex-1 text-rose-300 text-sm">
          Beatmap {slot.beatmapId} wasn't found on the mirror. Check the ID.
        </p>
      );
    case "error":
      return <p className="flex-1 text-rose-300 text-sm">{state.message}</p>;
  }
};

export function SlotRow({
  slot,
  entry,
  state,
  onRemove,
  moveTargets,
  onMove,
  slotMods,
  ratings,
  usage,
  copyKey,
  onCopy,
}: SlotRowProps) {
  const title = slotTitle(slot);
  // Pick, then press Move: a <select> fires change on arrow keys, so moving on change would
  // move the map to whatever a keyboard user arrows past.
  const [picked, setPicked] = useState("");
  // A bucket renamed or deleted since it was picked is no longer a target: forget it.
  const offered = moveTargets?.some(
    (option) => !option.disabled && (option.value ?? NO_SLOT_VALUE) === picked,
  );
  const target = offered ? picked : "";
  const editable = Boolean(onRemove) || Boolean(onMove && moveTargets);
  return (
    <li className="flex flex-col gap-2 rounded-[10px] bg-b4 p-3">
      {/* One line from sm up when viewing. Editing adds Move and Remove, which leave the map
        too little room below lg, so there the controls take a line of their own under it. */}
      <div className={editable ? EDIT_ROW : VIEW_ROW}>
        <ModBadge entry={entry} index={slot.index} />
        {body(slot, state, slotMods, ratings, usage)}
        <div className={editable ? EDIT_ACTIONS : VIEW_ACTIONS}>
          {/* The slot's ID, so it works before the map loads. Phones: its own line under the
            map. Wider: the status sits left of the button in a box as wide as "Copied.", so a
            press never moves the button or squeezes the map. */}
          <CopyButton
            key={copyKey}
            onClickCapture={onCopy}
            text={String(slot.beatmapId)}
            label="Copy ID"
            aria-label={`Copy ID ${slot.beatmapId}`}
            failedMessage={`Couldn't copy. The beatmap ID is ${slot.beatmapId}.`}
            className="whitespace-nowrap"
            wrapperClassName="w-full shrink-0 gap-2 sm:w-auto sm:flex-row-reverse sm:[&>output]:min-w-[4.5rem] sm:[&>output]:text-right"
          />
          {onMove && moveTargets ? (
            <div className="flex items-center gap-1">
              <select
                aria-label={`Move ${title} to`}
                value={target}
                onChange={(event) => setPicked(event.target.value)}
                className={fieldClasses("w-auto text-sm")}
              >
                <option value="" disabled>
                  Move to…
                </option>
                {moveTargets.map((option) => (
                  <option
                    key={option.value ?? NO_SLOT_VALUE}
                    value={option.value ?? NO_SLOT_VALUE}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                aria-label={`Move ${title}`}
                disabled={target === ""}
                onClick={() => {
                  onMove(target === NO_SLOT_VALUE ? null : target);
                  setPicked("");
                }}
              >
                Move
              </Button>
            </div>
          ) : null}
          {onRemove ? (
            <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${title}`}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
