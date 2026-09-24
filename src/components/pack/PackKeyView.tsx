/**
 * @file src/components/pack/PackKeyView.tsx
 * @desc /k: decode the key in location.hash, show the Download card at the top, then the pool
 *       with live metadata, star ratings with mods and the other archive pools each map was used
 *       in; offer "Edit a copy" and saving to an account.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import {
  decodePackKey,
  encodePackKey,
  extractPackKey,
  PACK_KEY_ERROR_MESSAGES,
  PackKeyError,
} from "@haruhimemoe/pool";
import { Button, Card, PageHeader } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { ExportPanel } from "@/components/export/ExportPanel";
import { KeyPasteForm } from "@/components/pack/KeyPasteForm";
import { PackKeyField } from "@/components/pack/PackKeyField";
import { PackStats } from "@/components/pack/PackStats";
import { PoolTable } from "@/components/pack/PoolTable";
import { SavePackButton } from "@/components/pack/SavePackButton";
import { useBeatmapMeta } from "@/hooks/useBeatmapMeta";
import { type MapUsageFetcher, useMapUsage } from "@/hooks/useMapUsage";
import { usePoolStarRatings } from "@/hooks/useModdedStarRatings";
import { saveDraft } from "@/lib/storage/drafts";
import type { Pool } from "@/schemas/pack";

type ViewState =
  | { status: "reading" }
  | { status: "ok"; pack: Pool; key: string }
  | { status: "error"; message: string };

/** Stand-in pool while the key is read or broken, so hooks run in the same order every render. */
const NO_POOL: Pool = { name: "", slots: [] };

const readHash = (): ViewState => {
  try {
    const raw = decodeURIComponent(window.location.hash.slice(1));
    const pack = decodePackKey(extractPackKey(raw) ?? raw);
    return { status: "ok", pack, key: encodePackKey(pack) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof PackKeyError ? error.message : PACK_KEY_ERROR_MESSAGES.malformed,
    };
  }
};

export function PackKeyView({
  fetchUsage,
}: {
  /** Test seam. Default: our map usage route. */
  fetchUsage?: MapUsageFetcher;
} = {}) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "reading" });
  const [saving, setSaving] = useState(false);
  const mapsHeadingId = useId();

  useEffect(() => {
    const update = () => setState(readHash());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const pack = state.status === "ok" ? state.pack : null;
  const ids = useMemo(() => pack?.slots.map((s) => s.beatmapId) ?? [], [pack]);
  const meta = useBeatmapMeta(ids);
  const stars = usePoolStarRatings(pack ?? NO_POOL, meta.get);
  // A key of an archive pool is that pool: its entries are left out by fingerprint.
  const usageOf = useMapUsage(ids, {
    ...(pack ? { pool: pack } : {}),
    ...(fetchUsage ? { fetchUsage } : {}),
  });

  if (state.status === "reading") {
    return <PageHeader title="Opening pack…" />;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Couldn't open that pack" lead={state.message} />
        <Card title="Open a pack">
          <KeyPasteForm />
        </Card>
      </div>
    );
  }

  const editCopy = async () => {
    setSaving(true);
    // Storage may be unavailable; the builder then simply starts empty.
    await saveDraft(state.pack).catch(() => undefined);
    router.push("/new");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={state.pack.name}
        meta={`${state.pack.slots.length} ${state.pack.slots.length === 1 ? "map" : "maps"}`}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button onClick={editCopy} disabled={saving}>
              Edit a copy
            </Button>
            <p className="text-c4 text-xs">Replaces the draft in this browser.</p>
          </div>
        }
      />
      <ExportPanel
        pack={state.pack}
        packKey={state.key}
        getMeta={meta.get}
        onRetryMeta={meta.retry}
      />
      <section aria-labelledby={mapsHeadingId} className="flex flex-col gap-6">
        <h2 id={mapsHeadingId} className="sr-only">
          Maps
        </h2>
        <PackStats slots={state.pack.slots} getState={meta.get} starsOf={stars.starsOf} />
        <PoolTable
          slots={state.pack.slots}
          buckets={state.pack.buckets}
          getState={meta.get}
          modsBySlot={stars.modsBySlot}
          ratings={stars.ratings}
          usageOf={usageOf}
        />
      </section>
      <Card title="Save">
        <SavePackButton
          pack={state.pack}
          signInNext="/new"
          beforeSignIn={() => saveDraft(state.pack)}
          signInNote="Signing in opens this pack in the builder (replacing the draft in this browser), where you can save it."
        />
      </Card>
      <Card title="Share">
        <PackKeyField packKey={state.key} />
      </Card>
    </div>
  );
}
