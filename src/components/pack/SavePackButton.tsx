/**
 * @file src/components/pack/SavePackButton.tsx
 * @desc Save the current pack to the signed-in account, or detour through sign-in (after
 *       beforeSignIn has put the pack somewhere it will survive the redirect).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DEFAULT_PACK_NAME } from "@/constants/pack";
import { useAccount } from "@/hooks/useAccount";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { Pool } from "@/schemas/pack";
import type { PackInputBody, SavedPack } from "@/schemas/saved-pack";
import { signInHref } from "@/utils/safe-next";

type SavePackButtonProps = {
  pack: Pool;
  /** Where to come back to after signing in. */
  signInNext: string;
  /** Runs before leaving for sign-in (e.g. write the draft). Failures are ignored. */
  beforeSignIn?: () => Promise<void>;
  /** Shown to signed-out visitors under the button. */
  signInNote?: string;
  save?: (input: PackInputBody) => Promise<SavedPack>;
};

export function SavePackButton({
  pack,
  signInNext,
  beforeSignIn,
  signInNote,
  save = packsApi.create,
}: SavePackButtonProps) {
  const account = useAccount();
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State updates land after the next render; a ref blocks the second click of a double click.
  const busy = useRef(false);

  const begin = (): boolean => {
    if (busy.current) return false;
    busy.current = true;
    setWorking(true);
    setError(null);
    return true;
  };

  const goSignIn = async () => {
    if (!begin()) return;
    await beforeSignIn?.().catch(() => undefined);
    router.push(signInHref(signInNext));
  };

  const saveNow = async () => {
    if (!begin()) return;
    try {
      const saved = await save({
        name: pack.name.trim() || DEFAULT_PACK_NAME,
        slots: pack.slots,
        ...(pack.buckets ? { buckets: pack.buckets } : {}),
      });
      router.push(`/p/${saved.slug}`);
    } catch (cause) {
      setError(
        cause instanceof PacksApiError ? cause.message : "Couldn't save the pack. Try again.",
      );
      busy.current = false;
      setWorking(false);
    }
  };

  const signedIn = account.status === "signed-in";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-c3 text-sm">
        {signedIn
          ? "Save this pack to your account for a short link you can edit later."
          : "Sign in with osu! to save this pack and get a short link you can edit later."}
      </p>
      <div>
        {signedIn ? (
          <Button onClick={saveNow} disabled={working || pack.slots.length === 0}>
            {working ? "Saving…" : "Save to account"}
          </Button>
        ) : (
          <Button onClick={goSignIn} disabled={working || account.status === "loading"}>
            Sign in to save
          </Button>
        )}
      </div>
      {!signedIn && signInNote ? <p className="text-c4 text-xs">{signInNote}</p> : null}
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
