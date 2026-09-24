/**
 * @file src/components/pack/PackEditor.tsx
 * @desc Editing surface shared by /new and /p/[slug]/edit: name, add maps, slots, the pool, with
 *       star ratings with mods and the other archive pools each map was used in (asked once the
 *       pool holds still, only for maps it hasn't asked about).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { bucketsOf } from "@haruhimemoe/pool";
import { Button, Card, TextInput } from "@haruhimemoe/ui";
import { type Dispatch, useId, useMemo, useState } from "react";
import { AddBeatmapForm } from "@/components/pack/AddBeatmapForm";
import { BucketManager } from "@/components/pack/BucketManager";
import { BulkPasteInput } from "@/components/pack/BulkPasteInput";
import { PackStats } from "@/components/pack/PackStats";
import { PoolTable } from "@/components/pack/PoolTable";
import { MAP_USAGE_EDITOR_DELAY_MS } from "@/constants/map-usage";
import { DEFAULT_PACK_NAME, MAX_NAME_LENGTH, MAX_SLOTS } from "@/constants/pack";
import { EDITOR_STAR_DELAY_MS } from "@/constants/star-ratings";
import type { BeatmapMetaApi } from "@/hooks/useBeatmapMeta";
import { type MapUsageFetcher, useMapUsage } from "@/hooks/useMapUsage";
import { usePoolStarRatings } from "@/hooks/useModdedStarRatings";
import type { DraftAction } from "@/hooks/usePackDraft";
import type { Pool } from "@/schemas/pack";

type PackEditorProps = {
  pack: Pool;
  dispatch: Dispatch<DraftAction>;
  /** False while hydrating or saving: inputs are disabled. */
  ready: boolean;
  meta: BeatmapMetaApi;
  /** The saved pack being edited, whose own map usage is left out. Absent on /new. */
  slug?: string;
  /** Test seams: the map usage route and how long to wait before asking it. */
  fetchUsage?: MapUsageFetcher;
  usageDelayMs?: number;
};

export function PackEditor({
  pack,
  dispatch,
  ready,
  meta,
  slug,
  fetchUsage,
  usageDelayMs = MAP_USAGE_EDITOR_DELAY_MS,
}: PackEditorProps) {
  // Armed for one pack value: any edit makes a new pack object and disarms it.
  const [armedFor, setArmedFor] = useState<Pool | null>(null);
  const confirmClear = armedFor === pack;
  const nameId = useId();
  const full = pack.slots.length >= MAX_SLOTS;
  const buckets = bucketsOf(pack);
  // Ask osu! only once the pool has settled for a moment.
  const stars = usePoolStarRatings(pack, meta.get, { delayMs: EDITOR_STAR_DELAY_MS });
  const ids = useMemo(() => pack.slots.map((slot) => slot.beatmapId), [pack.slots]);
  const usageOf = useMapUsage(ids, {
    excludeSlug: slug,
    delayMs: usageDelayMs,
    ...(fetchUsage ? { fetchUsage } : {}),
  });

  return (
    <>
      <TextInput
        id={nameId}
        label="Pack name"
        value={pack.name}
        maxLength={MAX_NAME_LENGTH}
        disabled={!ready}
        placeholder={DEFAULT_PACK_NAME}
        onChange={(event) => dispatch({ type: "rename", name: event.target.value })}
        className="font-bold text-lg"
      />

      <Card title="Add maps">
        <div className="flex flex-col gap-5">
          <AddBeatmapForm
            buckets={buckets}
            disabled={!ready || full}
            onAdd={(mod, beatmapId) => dispatch({ type: "add", mod, beatmapId })}
          />
          <BulkPasteInput
            existing={pack.slots}
            buckets={buckets}
            disabled={!ready}
            onAdd={(slots, newBuckets) => dispatch({ type: "merge", slots, newBuckets })}
          />
          {full ? (
            <p className="font-bold text-amber-300 text-sm">
              This pack is full ({MAX_SLOTS} maps).
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="Slots">
        <BucketManager
          buckets={buckets}
          slots={pack.slots}
          disabled={!ready}
          onAdd={(code, color) => dispatch({ type: "add-bucket", code, color })}
          onRename={(code, next) => dispatch({ type: "rename-bucket", code, next })}
          onRecolor={(code, color) => dispatch({ type: "recolor-bucket", code, color })}
          onMove={(code, to) => dispatch({ type: "move-bucket", code, to })}
          onRemove={(code) => dispatch({ type: "remove-bucket", code })}
          onSetMods={(code, mods) => dispatch({ type: "set-bucket-mods", code, mods })}
        />
      </Card>

      <section aria-label="Pool" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-c1 text-xl">
            Pool <span className="font-normal text-base text-c4">({pack.slots.length})</span>
          </h2>
          <div className="flex gap-2">
            {meta.hasErrors ? (
              <Button variant="secondary" onClick={meta.retry}>
                Retry loading maps
              </Button>
            ) : null}
            {pack.slots.length > 0 ? (
              confirmClear ? (
                <>
                  <Button variant="ghost" onClick={() => setArmedFor(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      dispatch({ type: "reset" });
                      setArmedFor(null);
                    }}
                  >
                    Confirm clear
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setArmedFor(pack)}>
                  Clear pack
                </Button>
              )
            ) : null}
          </div>
        </div>
        <PackStats slots={pack.slots} getState={meta.get} starsOf={stars.starsOf} />
        <PoolTable
          slots={pack.slots}
          buckets={buckets}
          getState={meta.get}
          modsBySlot={stars.modsBySlot}
          ratings={stars.ratings}
          usageOf={usageOf}
          onRemove={(slot) => dispatch({ type: "remove", mod: slot.mod, index: slot.index })}
          onMove={(slot, to) =>
            dispatch({ type: "move-slot", mod: slot.mod, index: slot.index, to })
          }
        />
      </section>
    </>
  );
}
