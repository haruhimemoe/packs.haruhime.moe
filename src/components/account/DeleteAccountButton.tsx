/**
 * @file src/components/account/DeleteAccountButton.tsx
 * @desc Deletes the account after a confirm, then leaves with a full reload so no page keeps
 *       showing the old session.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";
import { markSignedOut } from "@/hooks/useAccount";
import { PacksApiError, packsApi } from "@/lib/packs-api";

type DeleteAccountButtonProps = {
  packCount: number;
  deleteAccount?: () => Promise<void>;
  onDeleted?: () => void;
};

const goHome = () => window.location.assign("/");

export function DeleteAccountButton({
  packCount,
  deleteAccount = packsApi.deleteAccount,
  onDeleted = goHome,
}: DeleteAccountButtonProps) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPhase("deleting");
    setError(null);
    try {
      await deleteAccount();
      markSignedOut();
      onDeleted();
    } catch (cause) {
      setError(
        cause instanceof PacksApiError ? cause.message : "Couldn't delete your account. Try again.",
      );
      setPhase("confirm");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {phase === "idle" ? (
        <Button variant="secondary" className="self-start" onClick={() => setPhase("confirm")}>
          Delete account
        </Button>
      ) : (
        <>
          <p className="text-c2 text-sm">
            This deletes your account and {packCount} saved {packCount === 1 ? "pack" : "packs"}.
            Their short links stop working. Pack keys you've shared still open.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => setPhase("idle")}
              disabled={phase === "deleting"}
            >
              Cancel
            </Button>
            <Button variant="secondary" onClick={run} disabled={phase === "deleting"}>
              {phase === "deleting" ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
