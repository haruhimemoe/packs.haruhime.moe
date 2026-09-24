/**
 * @file src/components/pack/SlotRow.tsx
 * @desc One pool slot: badge, cover, title/difficulty/mapper, stars + stats, stars with mods,
 *       optional remove.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { beatmapUrl, coverUrl } from "@haruhimemoe/osu/shapes";
import { type SlotMods, slotTitle } from "@haruhimemoe/pool";
import Image from "next/image";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import { BeatmapStats } from "@/components/beatmap/BeatmapStats";
import { StarRating } from "@/components/beatmap/StarRating";
import { ModBadge } from "@/components/pack/ModBadge";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/fieldStyles";
import { NO_SLOT_VALUE } from "@/constants/mods";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { BucketEntry, PoolSlot, SlotBucket } from "@/schemas/pack";
import { type ModdedRating, slotStars } from "@/utils/slot-stars";

export type MoveTarget = { value: SlotBucket; label: string; disabled: boolean };

type SlotRowProps = {
  slot: PoolSlot;
  entry: BucketEntry | null;
  state: MetaState;
  onRemove?: () => void;
  moveTargets?: readonly MoveTarget[];
  onMove?: (to: SlotBucket) => void;
  /** What this slot plays with (qol spec §5.3). Absent: shown without mods. */
  slotMods?: SlotMods;
  /** Ratings with mods: absent while calculating, empty when they couldn't be calculated. */
  ratings?: readonly ModdedRating[];
};

const body = (
  slot: PoolSlot,
  state: MetaState,
  slotMods: SlotMods | undefined,
  ratings: readonly ModdedRating[] | undefined,
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
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[10px] bg-b4 p-3 sm:flex-nowrap">
      <ModBadge entry={entry} index={slot.index} />
      {body(slot, state, slotMods, ratings)}
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
    </li>
  );
}
