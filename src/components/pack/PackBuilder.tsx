/**
 * @file src/components/pack/PackBuilder.tsx
 * @desc The /new experience: name, add one / paste many, live pool, pack key. Anonymous; the draft
 *       autosaves to IndexedDB. Offers saving to an account.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { encodePackKey } from "@haruhimemoe/pool";
import { Card } from "@haruhimemoe/ui";
import { useMemo } from "react";
import { ExportPanel } from "@/components/export/ExportPanel";
import { PackEditor } from "@/components/pack/PackEditor";
import { PackKeyField } from "@/components/pack/PackKeyField";
import { SavePackButton } from "@/components/pack/SavePackButton";
import { DEFAULT_PACK_NAME } from "@/constants/pack";
import { useBeatmapMeta } from "@/hooks/useBeatmapMeta";
import { usePackDraft } from "@/hooks/usePackDraft";
import { saveDraft } from "@/lib/storage/drafts";

export function PackBuilder() {
  const { pack, hydrated, dispatch } = usePackDraft();
  const ids = useMemo(() => pack.slots.map((s) => s.beatmapId), [pack.slots]);
  const meta = useBeatmapMeta(ids);

  const packKey =
    pack.slots.length > 0
      ? encodePackKey({ ...pack, name: pack.name.trim() || DEFAULT_PACK_NAME })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PackEditor pack={pack} dispatch={dispatch} ready={hydrated} meta={meta} />

      {packKey ? (
        <Card title="Save">
          <SavePackButton
            pack={pack}
            signInNext="/new"
            // The autosave is debounced; write now so the last edit survives the redirect.
            beforeSignIn={() => saveDraft(pack)}
          />
        </Card>
      ) : null}

      {packKey ? (
        <ExportPanel pack={pack} packKey={packKey} getMeta={meta.get} onRetryMeta={meta.retry} />
      ) : null}

      {packKey ? (
        <Card title="Share">
          <PackKeyField packKey={packKey} />
        </Card>
      ) : null}
    </div>
  );
}
