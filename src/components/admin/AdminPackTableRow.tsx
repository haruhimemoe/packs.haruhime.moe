/**
 * @file src/components/admin/AdminPackTableRow.tsx
 * @desc One /admin pack row: name, host (an osu! profile link unless it's a system account),
 *       visibility, maps, updated, a Hidden or Pinned badge, and Hide/Unhide, Pin/Unpin and a
 *       Delete that asks in a dialog (@haruhimemoe/ui's ConfirmDialog); a deleted row leaves at
 *       once, focus going to the table's "Deleted" line.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { userUrl } from "@haruhimemoe/osu/shapes";
import { Badge, Button, ConfirmDialog, Td, TextLink } from "@haruhimemoe/ui";
import { useState } from "react";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";
import type { packsApi } from "@/lib/packs-api";
import type { AdminPackRow } from "@/schemas/public-pack";
import { formatShortDate } from "@/utils/date";
import { isPinnable } from "@/utils/pins";

export type AdminApi = Pick<typeof packsApi, "setHidden" | "adminRemove" | "pin" | "unpin">;

/** Runs one of this row's actions; resolves false when it failed (the table shows why). */
export type RowRunner = (action: () => Promise<unknown>, onDone?: () => void) => Promise<boolean>;

type AdminPackTableRowProps = {
  row: AdminPackRow;
  api: AdminApi;
  /** An action on this row is running: its buttons wait. */
  busy: boolean;
  run: RowRunner;
  onDeleted: () => void;
};

/**
 * @function AdminPackTableRow
 * @param props {AdminPackTableRowProps} the pack, the admin API, whether it's busy, and how to run
 *        an action and report a delete
 * @returns {JSX.Element} the table row
 */
export function AdminPackTableRow({ row, api, busy, run, onDeleted }: AdminPackTableRowProps) {
  const hidden = row.hiddenAt !== null;
  const pinnable = isPinnable({ visibility: row.visibility, hidden });
  // Leaves at once on a delete, so the dialog hands focus to the table's "Deleted" line.
  const [gone, setGone] = useState(false);
  const remove = async () => {
    const done = () => {
      setGone(true);
      onDeleted();
    };
    // Throwing keeps the dialog open; the table shows the error.
    if (!(await run(() => api.adminRemove(row.slug), done))) throw new Error("not deleted");
  };
  if (gone) return null;
  return (
    <tr className="align-top">
      <Td>
        <TextLink href={`/p/${row.slug}`} variant="plain" className="wrap-anywhere">
          {row.name}
        </TextLink>
      </Td>
      <Td>
        {row.ownerOsuId === null ? (
          // A system account (haruhime pools) has no osu! profile to link.
          <span className="text-c2">{row.ownerName}</span>
        ) : (
          <TextLink variant="plain" href={userUrl(row.ownerOsuId)} target="_blank">
            {row.ownerName}
          </TextLink>
        )}
      </Td>
      <Td className="text-c2">{VISIBILITY_OPTIONS[row.visibility].label}</Td>
      <Td numeric className="text-c2">
        {row.slotCount}
      </Td>
      <Td className="text-c2">{formatShortDate(row.updatedAt)}</Td>
      <Td>
        {row.hiddenAt ? (
          <Badge tone="warning">Hidden {formatShortDate(row.hiddenAt)}</Badge>
        ) : row.pinnedAt ? (
          <Badge tone="accent">Pinned</Badge>
        ) : null}
      </Td>
      <Td>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-label={`${hidden ? "Unhide" : "Hide"} ${row.name}`}
            onClick={() => run(() => api.setHidden(row.slug, !hidden))}
            disabled={busy}
          >
            {hidden ? "Unhide" : "Hide"}
          </Button>
          {row.pinnedAt || pinnable ? (
            <Button
              variant="secondary"
              aria-label={`${row.pinnedAt ? "Unpin" : "Pin"} ${row.name}`}
              onClick={() => run(() => (row.pinnedAt ? api.unpin(row.slug) : api.pin(row.slug)))}
              disabled={busy}
            >
              {row.pinnedAt ? "Unpin" : "Pin"}
            </Button>
          ) : null}
          <ConfirmDialog
            trigger="Delete"
            triggerProps={{ variant: "ghost", "aria-label": `Delete ${row.name}`, disabled: busy }}
            title={`Delete ${row.name} for good?`}
            description="It goes for its host too, and its short link stops working for everyone."
            tone="destructive"
            cancelLabel="Keep it"
            confirmLabel="Yes, delete it"
            failedMessage="Couldn't delete it. The reason is above the table."
            returnFocus={() => document.querySelector<HTMLElement>("[data-admin-deleted]")}
            onConfirm={remove}
          />
        </div>
      </Td>
    </tr>
  );
}
