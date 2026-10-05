/**
 * @file src/components/admin/PinnedPacks.tsx
 * @desc /admin "Pinned packs" panel: the packs in the "Pinned" row on /packs, reordered by
 *       dragging a handle or with Up and Down (ui's SortableList; each move sends the whole new
 *       order) and Unpin. Shows the server's answer at once, then refreshes the page so the
 *       table's pin buttons follow; a refreshed page with other pins replaces the list. Focus
 *       stays with a moved pack, and lands on the confirmation after an unpin, so it isn't lost
 *       with the row.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import {
  Button,
  Card,
  moveItem,
  Notice,
  SortableList,
  type SortableMove,
  Text,
  TextLink,
} from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { PinnedPack } from "@/schemas/public-pack";

type PinnedPacksProps = {
  pins: readonly PinnedPack[];
  api?: Pick<typeof packsApi, "unpin" | "reorderPins">;
};

/**
 * @function PinnedPacks
 * @param props {PinnedPacksProps} pins, api
 * @returns {JSX.Element} /admin "Pinned packs" panel
 */
export function PinnedPacks({ pins: initial, api = packsApi }: PinnedPacksProps) {
  const router = useRouter();
  const [pins, setPins] = useState(initial);
  // A refreshed page brings the server's pins; they replace what this panel showed.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setPins(initial);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new object per unpin, so unpinning a second pack with the same name still refocuses.
  const [unpinned, setUnpinned] = useState<{ name: string } | null>(null);
  const unpinnedRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (unpinned !== null) unpinnedRef.current?.focus();
  }, [unpinned]);

  /** One server change: shows its answer, refreshes the page; false (with the message shown) when refused. */
  const run = async (
    action: () => Promise<PinnedPack[]>,
    onDone?: () => void,
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setUnpinned(null);
    try {
      setPins(await action());
      onDone?.();
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** A drag or Up/Down: the whole new order goes to the server. */
  const reorder = ({ from, to }: SortableMove) =>
    run(() =>
      api.reorderPins(
        moveItem(
          pins.map((pin) => pin.slug),
          from.index,
          to.index,
        ),
      ),
    );

  return (
    <Card title="Pinned packs" className="flex flex-col gap-3">
      <Text tone="muted">
        Up to {MAX_PINNED_PACKS} public packs show above the list on /packs, in this order, until
        someone searches or filters. Drag a pack by its handle, or use Up and Down.
      </Text>
      {pins.length === 0 ? (
        <Text tone="muted">
          Nothing is pinned. Pin a public pack from the table above or from its page.
        </Text>
      ) : (
        <SortableList
          items={pins}
          getId={(pin) => pin.slug}
          getLabel={(pin) => pin.name}
          label="Pinned packs"
          disabled={busy}
          onMove={reorder}
          className="divide-y divide-b3"
          itemClassName="flex flex-wrap items-center gap-x-3 gap-y-2 py-2"
        >
          {(pin, { index, handle, moveButtons }) => (
            <>
              {handle}
              <span className="w-5 text-c4 text-sm tabular-nums">{index + 1}.</span>
              {/* At least 10rem for the name: narrower, the buttons wrap under it. */}
              <span className="min-w-0 flex-1 basis-40">
                <TextLink href={`/p/${pin.slug}`} variant="plain" className="wrap-anywhere">
                  {pin.name}
                </TextLink>
                <Text as="span" tone="muted">
                  {" "}
                  by {pin.ownerName}
                </Text>
              </span>
              <span className="flex flex-wrap gap-2">
                {moveButtons}
                <Button
                  variant="secondary"
                  aria-label={`Unpin ${pin.name}`}
                  onClick={() =>
                    run(
                      () => api.unpin(pin.slug),
                      () => setUnpinned({ name: pin.name }),
                    )
                  }
                  disabled={busy}
                >
                  Unpin
                </Button>
              </span>
            </>
          )}
        </SortableList>
      )}
      {unpinned !== null ? (
        <Text ref={unpinnedRef} tabIndex={-1} role="status" tone="muted" className="outline-none">
          Unpinned {unpinned.name}.
        </Text>
      ) : null}
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}
