/**
 * @file src/components/admin/AdminPackTable.tsx
 * @desc /admin pack table (@haruhimemoe/ui's Table): one AdminPackTableRow per pack. Rows act
 *       independently; errors show above the table, and a delete moves focus to a "Deleted"
 *       status so it isn't lost with the row.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Notice, Table, TBody, Text, THead, Th } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  type AdminApi,
  AdminPackTableRow,
  type RowRunner,
} from "@/components/admin/AdminPackTableRow";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { AdminPackRow } from "@/schemas/public-pack";

type AdminPackTableProps = {
  rows: readonly AdminPackRow[];
  api?: AdminApi;
};

const COLUMNS = ["Pack", "Host", "Visibility", "Maps", "Updated", "Status"] as const;

/**
 * @function AdminPackTable
 * @param props {AdminPackTableProps} the packs on this page, and the admin API (a test seam)
 * @returns {JSX.Element} the table, or a line saying there's nothing to show
 */
export function AdminPackTable({ rows, api = packsApi }: AdminPackTableProps) {
  const router = useRouter();
  // Rows act independently: one slow action doesn't lock the others.
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  // A new object per delete, so a second pack with the same name still refocuses.
  const [deleted, setDeleted] = useState<{ name: string } | null>(null);
  const deletedRef = useRef<HTMLParagraphElement>(null);

  // The deleted row disappears with focus inside it; land focus on the confirmation instead.
  // This parent effect runs after the confirm's own, which would put focus back on its trigger.
  useEffect(() => {
    if (deleted !== null) deletedRef.current?.focus();
  }, [deleted]);

  const setRowBusy = (slug: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });

  const runFor =
    (slug: string): RowRunner =>
    async (action, onDone) => {
      setRowBusy(slug, true);
      setError(null);
      setDeleted(null);
      try {
        await action();
        onDone?.();
        router.refresh();
        return true;
      } catch (cause) {
        setError(
          cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.",
        );
        return false;
      } finally {
        setRowBusy(slug, false);
      }
    };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}
      {deleted !== null ? (
        <Text
          ref={deletedRef}
          tabIndex={-1}
          role="status"
          tone="muted"
          className="outline-none"
          data-admin-deleted=""
        >
          Deleted {deleted.name}.
        </Text>
      ) : null}
      {rows.length === 0 ? <p className="text-c3">No packs here.</p> : null}
      {/* relative: the header's sr-only text is absolute and would widen the page on phones. */}
      <div className="relative" hidden={rows.length === 0}>
        <Table className="min-w-[40rem]">
          <THead>
            <tr>
              {COLUMNS.map((column) => (
                <Th key={column}>{column}</Th>
              ))}
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <AdminPackTableRow
                key={row.slug}
                row={row}
                api={api}
                busy={busy.has(row.slug)}
                run={runFor(row.slug)}
                onDeleted={() => setDeleted({ name: row.name })}
              />
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
