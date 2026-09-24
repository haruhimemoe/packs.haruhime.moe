/**
 * @file src/components/admin/PinnedPacks.tsx
 * @desc /admin "Pinned packs" panel: the packs in the "Pinned" row on /packs, in order, with Move
 *       up / Move down (each sends the whole new order) and Unpin. Shows the server's answer at
 *       once, then refreshes the page so the table's pin buttons follow; a refreshed page with
 *       other pins replaces the list. Focus stays with a moved pack, and lands on the
 *       confirmation after an unpin, so it isn't lost with the row.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button, Card, Notice } from "@haruhimemoe/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { PinnedPack } from "@/schemas/public-pack";
import { movePin } from "@/utils/pins";

type PinnedPacksProps = {
  pins: readonly PinnedPack[];
  api?: Pick<typeof packsApi, "unpin" | "reorderPins">;
};

type Direction = "up" | "down";

/** The button to focus after a move: the same one, or the other when the pack reached an end. */
type FocusTarget = { slug: string; direction: Direction };

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
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfter = useRef<FocusTarget | null>(null);

  useEffect(() => {
    if (unpinned !== null) unpinnedRef.current?.focus();
  }, [unpinned]);

  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) return;
    focusAfter.current = null;
    const other: Direction = target.direction === "up" ? "down" : "up";
    (
      buttons.current.get(`${target.slug}:${target.direction}`) ??
      buttons.current.get(`${target.slug}:${other}`)
    )?.focus();
  });

  const run = async (action: () => Promise<PinnedPack[]>, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    setUnpinned(null);
    try {
      setPins(await action());
      onDone?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const move = (pin: PinnedPack, direction: Direction) =>
    run(
      () =>
        api.reorderPins(
          movePin(
            pins.map((p) => p.slug),
            pin.slug,
            direction === "up" ? -1 : 1,
          ),
        ),
      () => {
        focusAfter.current = { slug: pin.slug, direction };
      },
    );

  const moveButton = (pin: PinnedPack, direction: Direction) => (
    <Button
      ref={(element) => {
        const key = `${pin.slug}:${direction}`;
        if (element) buttons.current.set(key, element);
        else buttons.current.delete(key);
      }}
      variant="ghost"
      aria-label={`Move ${pin.name} ${direction}`}
      onClick={() => move(pin, direction)}
      disabled={busy}
    >
      {direction === "up" ? "Up" : "Down"}
    </Button>
  );

  return (
    <Card title="Pinned packs" className="flex flex-col gap-3">
      <p className="text-c3 text-sm">
        Up to {MAX_PINNED_PACKS} public packs show above the list on /packs, in this order, until
        someone searches or filters.
      </p>
      {pins.length === 0 ? (
        <p className="text-c3 text-sm">
          Nothing is pinned. Pin a public pack from the table above or from its page.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-b3">
          {pins.map((pin, index) => (
            <li key={pin.slug} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <span className="w-5 text-c4 text-sm tabular-nums">{index + 1}.</span>
              {/* At least 10rem for the name: narrower, the buttons wrap under it. */}
              <span className="min-w-0 flex-1 basis-40">
                <Link
                  href={`/p/${pin.slug}`}
                  className="wrap-anywhere font-bold text-c1 hover:text-h1"
                >
                  {pin.name}
                </Link>
                <span className="text-c3 text-sm"> by {pin.ownerName}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                {index > 0 ? moveButton(pin, "up") : null}
                {index < pins.length - 1 ? moveButton(pin, "down") : null}
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
            </li>
          ))}
        </ol>
      )}
      {unpinned !== null ? (
        <p ref={unpinnedRef} tabIndex={-1} role="status" className="text-c3 text-sm outline-none">
          Unpinned {unpinned.name}.
        </p>
      ) : null}
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </Card>
  );
}
