/**
 * @file src/components/pack/SavedPackEditor.tsx
 * @desc /p/[slug]/edit: edit a saved pack in memory (no IndexedDB draft), then save or delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useState } from "react";
import { DescriptionField } from "@/components/pack/DescriptionField";
import { HiddenNotice } from "@/components/pack/HiddenNotice";
import { PackEditor } from "@/components/pack/PackEditor";
import { VisibilityField } from "@/components/pack/VisibilityField";
import { DEFAULT_PACK_NAME } from "@/constants/pack";
import { useBeatmapMeta } from "@/hooks/useBeatmapMeta";
import { draftReducer } from "@/hooks/usePackDraft";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { PackInputBody, SavedPack, Visibility } from "@/schemas/saved-pack";

type SavedPackEditorProps = {
  pack: SavedPack;
  update?: (slug: string, input: PackInputBody) => Promise<SavedPack>;
  remove?: (slug: string) => Promise<void>;
};

type Phase = "idle" | "saving" | "confirm-delete" | "deleting";

export function SavedPackEditor({
  pack: saved,
  update = packsApi.update,
  remove = packsApi.remove,
}: SavedPackEditorProps) {
  const router = useRouter();
  const [pack, dispatch] = useReducer(
    draftReducer,
    saved.buckets
      ? { name: saved.name, slots: saved.slots, buckets: saved.buckets }
      : { name: saved.name, slots: saved.slots },
  );
  const [visibility, setVisibility] = useState<Visibility>(saved.visibility);
  const [description, setDescription] = useState(saved.description ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const ids = useMemo(() => pack.slots.map((s) => s.beatmapId), [pack.slots]);
  const meta = useBeatmapMeta(ids);
  const busy = phase === "saving" || phase === "deleting";

  const fail = (cause: unknown) => {
    setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
    setPhase("idle");
  };

  const saveChanges = async () => {
    setPhase("saving");
    setError(null);
    try {
      await update(saved.slug, {
        name: pack.name.trim() || DEFAULT_PACK_NAME,
        slots: pack.slots,
        ...(pack.buckets ? { buckets: pack.buckets } : {}),
        visibility,
        // Always sent: PUT replaces the pack, so leaving it out would clear it.
        description,
      });
      router.push(`/p/${saved.slug}`);
      router.refresh();
    } catch (cause) {
      fail(cause);
    }
  };

  const deleteNow = async () => {
    setPhase("deleting");
    setError(null);
    try {
      await remove(saved.slug);
      router.push("/me");
      router.refresh();
    } catch (cause) {
      fail(cause);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit pack"
        actions={
          <ButtonLink href={`/p/${saved.slug}`} variant="ghost">
            Cancel
          </ButtonLink>
        }
      />

      {saved.hiddenAt ? <HiddenNotice /> : null}

      <PackEditor pack={pack} dispatch={dispatch} ready={!busy} meta={meta} />

      <Card title="Visibility">
        <VisibilityField value={visibility} onChange={setVisibility} disabled={busy} />
      </Card>

      <Card title="Description">
        <DescriptionField value={description} onChange={setDescription} disabled={busy} />
      </Card>

      {(saved.exports?.length ?? 0) > 0 ? (
        <p className="text-c3 text-sm">
          Changing the name, maps, or slots removes this pack's magnet links.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={saveChanges} disabled={busy || pack.slots.length === 0}>
          {phase === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {phase === "confirm-delete" || phase === "deleting" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-c3 text-sm">
              Delete this pack for good? Its short link (/p/{saved.slug}) stops working for
              everyone. Pack keys you've shared still open the pool.
            </span>

            <Button variant="ghost" onClick={() => setPhase("idle")} disabled={busy}>
              Keep it
            </Button>
            <Button variant="secondary" onClick={deleteNow} disabled={busy}>
              {phase === "deleting" ? "Deleting…" : "Yes, delete it"}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setPhase("confirm-delete")} disabled={busy}>
            Delete pack
          </Button>
        )}
      </div>
    </div>
  );
}
