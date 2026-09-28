/**
 * @file src/components/account/DeleteAccountButton.tsx
 * @desc /me danger zone: deletes the account and its saved packs after an inline confirm
 *       (@haruhimemoe/ui's InlineConfirm) that says how many packs go with it, then signs out and
 *       goes home. A failure stays in the confirm with the server's message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { InlineConfirm, Notice } from "@haruhimemoe/ui";
import { useState } from "react";
import { markSignedOut } from "@/lib/account";
import { PacksApiError, packsApi } from "@/lib/packs-api";

type DeleteAccountButtonProps = {
  packCount: number;
  deleteAccount?: () => Promise<void>;
  onDeleted?: () => void;
};

const goHome = () => window.location.assign("/");

/**
 * @function DeleteAccountButton
 * @param props {DeleteAccountButtonProps} how many saved packs go with the account, and test seams
 * @returns {JSX.Element} the Delete account confirm and any error
 */
export function DeleteAccountButton({
  packCount,
  deleteAccount = packsApi.deleteAccount,
  onDeleted = goHome,
}: DeleteAccountButtonProps) {
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      await deleteAccount();
    } catch (cause) {
      setError(
        cause instanceof PacksApiError ? cause.message : "Couldn't delete your account. Try again.",
      );
      throw cause;
    }
    markSignedOut();
    onDeleted();
  };

  return (
    <div className="flex flex-col gap-3">
      <InlineConfirm
        trigger="Delete account"
        question={`This deletes your account and ${packCount} saved ${packCount === 1 ? "pack" : "packs"}. Their short links stop working. Pack keys you've shared still open.`}
        confirmLabel="Delete my account"
        pendingLabel="Deleting…"
        onConfirm={run}
      />
      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
