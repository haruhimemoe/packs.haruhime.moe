/**
 * @file src/components/pack/SavedPackEditor.tsx
 * @desc /p/[slug]/edit: edit a saved pack in memory (no IndexedDB draft), then save or delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import type { PackInputBody, PackVisibility } from "@haruhimemoe/pool/service";
import { Button, ButtonLink, Card, InlineConfirm, Notice, PageHeader, Text } from "@haruhimemoe/ui";
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
import type { SavedPack } from "@/schemas/saved-pack";

type SavedPackEditorProps = {
  pack: SavedPack;
  update?: (slug: string, input: PackInputBody) => Promise<SavedPack>;
  remove?: (slug: string) => Promise<void>;
};

type Phase = "idle" | "saving" | "deleting";

/**
 * @function SavedPackEditor
 * @param props {SavedPackEditorProps} pack, update, remove
 * @returns {JSX.Element} the /p/[slug]/edit editor
 */
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
  const [visibility, setVisibility] = useState<PackVisibility>(saved.visibility);
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
    } catch (cause) {
      fail(cause);
      // Keeps the confirm open, with the error above it.
      throw cause;
    }
    router.push("/me");
    router.refresh();
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
        <Text tone="muted">
          Changing the name, maps, or slots removes this pack's magnet links.
        </Text>
      ) : null}

      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={saveChanges} disabled={busy || pack.slots.length === 0}>
          {phase === "saving" ? "Saving…" : "Save changes"}
        </Button>
        <InlineConfirm
          trigger="Delete pack"
          triggerProps={{ variant: "ghost", disabled: phase === "saving" }}
          question={`Delete this pack for good? Its short link (/p/${saved.slug}) stops working for everyone. Pack keys you've shared still open the pool.`}
          cancelLabel="Keep it"
          confirmLabel="Yes, delete it"
          pendingLabel="Deleting…"
          onConfirm={deleteNow}
        />
      </div>
    </div>
  );
}
