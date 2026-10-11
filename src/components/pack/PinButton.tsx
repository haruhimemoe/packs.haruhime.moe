/**
 * @file src/components/pack/PinButton.tsx
 * @desc Admins only, on a public pack's page: Pin puts the pack in the "Pinned" row at the top of
 *       /packs, Unpin takes it out. Says where the pack stands, and shows the server's message
 *       when a pin is refused (the limit, or a pack that stopped being public). The button stays
 *       focusable while it works, so focus isn't lost.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { Button, Notice } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PacksApiError } from "@/lib/packs-api";
import type { PinnedPack } from "@/schemas/public-pack";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

export type PinApi = {
  pin: (slug: string) => Promise<PinnedPack[]>;
  unpin: (slug: string) => Promise<PinnedPack[]>;
};

type PinButtonProps = {
  slug: string;
  /** Whether the pack is pinned when the button appears. */
  pinned: boolean;
  api: PinApi;
};

const PINNED = (t: T) => t("pinnedToTheTop");

/**
 * @function PinButton
 * @param props {PinButtonProps} slug, pinned, api
 * @returns {JSX.Element} the Pin or Unpin button admins see on a public pack's page
 */
export function PinButton({ slug, pinned: initial, api }: PinButtonProps) {
  const t = useTranslations("packs.pinButton");
  const [pinned, setPinned] = useState(initial);
  const [status, setStatus] = useState(initial ? PINNED(t) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const pins = await (pinned ? api.unpin(slug) : api.pin(slug));
      const now = pins.some((pin) => pin.slug === slug);
      setPinned(now);
      setStatus(now ? PINNED(t) : t("unpinnedFromPacks"));
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : t("somethingWentWrongTry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={toggle} aria-disabled={busy || undefined}>
          {pinned ? "Unpin" : "Pin"}
        </Button>
        <Notice live>{status}</Notice>
      </div>
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
