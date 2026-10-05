/**
 * @file src/components/account/DeleteAccountButton.tsx
 * @desc /me danger zone: deletes the account and its saved packs after a dialog
 *       (@haruhimemoe/ui's ConfirmDialog) that says how many packs go with it and asks for the
 *       osu! username, then signs out and goes home. A failure stays in the dialog with the
 *       server's message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { ConfirmDialog } from "@haruhimemoe/ui";
import { markSignedOut } from "@/lib/account";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import { countOf } from "@/utils/text";

type DeleteAccountButtonProps = {
  /** The signed-in osu! username, typed to confirm. */
  username: string;
  packCount: number;
  deleteAccount?: () => Promise<void>;
  onDeleted?: () => void;
};

const goHome = () => window.location.assign("/");

/**
 * @function DeleteAccountButton
 * @param props {DeleteAccountButtonProps} the osu! username, how many saved packs go with the
 *        account, and test seams
 * @returns {JSX.Element} the Delete account button and its dialog
 */
export function DeleteAccountButton({
  username,
  packCount,
  deleteAccount = packsApi.deleteAccount,
  onDeleted = goHome,
}: DeleteAccountButtonProps) {
  const run = async () => {
    await deleteAccount();
    markSignedOut();
    onDeleted();
  };
  return (
    <ConfirmDialog
      trigger="Delete account"
      triggerProps={{ variant: "danger" }}
      title="Delete your account?"
      description={`This deletes your account and ${countOf(packCount, "saved pack")}. Their short links stop working. Pack keys you've shared still open.`}
      tone="destructive"
      typeToConfirm={username}
      confirmLabel="Delete my account"
      pendingLabel="Deleting…"
      failedMessage={(cause) =>
        cause instanceof PacksApiError ? cause.message : "Couldn't delete your account. Try again."
      }
      onConfirm={run}
    />
  );
}
