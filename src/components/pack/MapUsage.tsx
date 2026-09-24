/**
 * @file src/components/pack/MapUsage.tsx
 * @desc "Used in N pools" in a map row's stats line (pool archive spec, part 2): a disclosure
 *       button that opens the list of archive pools the map was used in (tournament and round,
 *       then year and slot), each linking its archive pack. Nothing at all when no other pool
 *       used the map. Its wrapper takes no box of its own, so the button sits in the flex-wrap
 *       line it's put in and the open list takes a full line under it. Escape inside the list
 *       closes it and puts focus back on the button.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import Link from "next/link";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import type { MapUsageEntry } from "@/schemas/map-usage";
import { usageEntryText, usageLabel, usagePoolCount } from "@/utils/map-usage";

type MapUsageProps = {
  beatmapId: number;
  /** The map's entries from other archive pools, most recent year first. */
  entries: readonly MapUsageEntry[];
};

export function MapUsage({ beatmapId, entries }: MapUsageProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pools = usagePoolCount(entries);
  if (pools === 0) return null;

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    // Only catches Escape bubbling up from the button and the links inside.
    // biome-ignore lint/a11y/noStaticElementInteractions: the button and links are the controls
    <div className="contents" onKeyDown={closeOnEscape}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-c3 text-sm transition-colors hover:text-c1 focus-visible:outline-2 focus-visible:outline-h1 focus-visible:outline-offset-2"
      >
        {usageLabel(pools)}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <ul
        id={listId}
        hidden={!open}
        aria-label={`Pools that used beatmap ${beatmapId}`}
        className="flex basis-full flex-col gap-1 rounded-md bg-b5 px-3 py-2 text-sm"
      >
        {entries.map((entry) => {
          const { pool, details } = usageEntryText(entry);
          return (
            <li
              key={`${entry.slug}:${entry.slot}`}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <Link
                href={`/p/${entry.slug}`}
                className="font-bold text-c1 transition-colors hover:text-h1 hover:underline"
              >
                {pool}
              </Link>
              <span className="text-c4 text-xs">{details}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
