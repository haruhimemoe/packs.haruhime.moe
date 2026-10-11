/**
 * @file src/components/account/DeletePacksDataButton.tsx
 * @desc /me "Delete my packs data": a dialog (@haruhimemoe/ui's ConfirmDialog) that says how many
 *       packs go and asks for the osu! username, then DELETE /api/me and a reload of /me, still
 *       signed in: the haruhime account itself lives on haruhime.moe. A failure stays in the
 *       dialog with the server's message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { ConfirmDialog } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import { countOf } from "@/utils/text";

type DeletePacksDataButtonProps = {
  /** The signed-in osu! username, typed to confirm. */
  username: string;
  packCount: number;
  deletePacksData?: () => Promise<void>;
  onDeleted?: () => void;
};

const reload = () => window.location.reload();

/**
 * @function DeletePacksDataButton
 * @param props {DeletePacksDataButtonProps} the osu! username, how many saved packs go, and test
 *        seams
 * @returns {JSX.Element} the Delete my packs data button and its dialog
 */
export function DeletePacksDataButton({
  username,
  packCount,
  deletePacksData = packsApi.deletePacksData,
  onDeleted = reload,
}: DeletePacksDataButtonProps) {
  const t = useTranslations("packs.deletePacksDataButton");
  const run = async () => {
    await deletePacksData();
    onDeleted();
  };
  return (
    <ConfirmDialog
      trigger={t("deleteMyPacksData")}
      triggerProps={{ variant: "danger" }}
      title={t("deleteYourPacksData")}
      description={t("thisDeletesYourApi", { pack: countOf(packCount, "saved pack") })}
      tone="destructive"
      typeToConfirm={username}
      confirmLabel={t("deleteForGood")}
      pendingLabel={t("deleting")}
      failedMessage={(cause) =>
        cause instanceof PacksApiError ? cause.message : t("couldnTDeleteYour")
      }
      onConfirm={run}
    />
  );
}
