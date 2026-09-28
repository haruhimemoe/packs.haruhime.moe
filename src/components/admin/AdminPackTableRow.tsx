/**
 * @file src/components/admin/AdminPackTableRow.tsx
 * @desc One /admin pack row: name, host (an osu! profile link unless it's a system account),
 *       visibility, maps, updated, a Hidden or Pinned badge, and Hide/Unhide, Pin/Unpin and a
 *       Delete that asks first (@haruhimemoe/ui's InlineConfirm).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { userUrl } from "@haruhimemoe/osu/shapes";
import { Badge, Button, InlineConfirm, Td, TextLink } from "@haruhimemoe/ui";
import Link from "next/link";
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
  const remove = async () => {
    // Throwing keeps the confirm open; the table shows the error.
    if (!(await run(() => api.adminRemove(row.slug), onDeleted))) throw new Error("not deleted");
  };
  return (
    <tr className="align-top">
      <Td>
        <Link href={`/p/${row.slug}`} className="wrap-anywhere font-bold text-c1 hover:text-h1">
          {row.name}
        </Link>
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
          <InlineConfirm
            trigger="Delete"
            triggerProps={{ variant: "ghost", "aria-label": `Delete ${row.name}`, disabled: busy }}
            question={`Delete ${row.name} for good?`}
            cancelLabel="Keep it"
            confirmLabel="Yes, delete it"
            onConfirm={remove}
          />
        </div>
      </Td>
    </tr>
  );
}
