/**
 * @file src/components/admin/AdminPackTable.tsx
 * @desc /admin table of public and unlisted packs with Hide / Unhide, Pin / Unpin (public packs
 *       that aren't hidden: the "Pinned" row on /packs) and Delete (confirmed inline). Refreshes
 *       the server page after each action. The host links to their osu! profile, except the
 *       archive's system account, which has none.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";
import { PacksApiError, packsApi } from "@/lib/packs-api";
import type { AdminPackRow } from "@/schemas/public-pack";
import { formatShortDate } from "@/utils/date";
import { isPinnable } from "@/utils/pins";

type AdminApi = Pick<typeof packsApi, "setHidden" | "adminRemove" | "pin" | "unpin">;

type AdminPackTableProps = {
  rows: readonly AdminPackRow[];
  api?: AdminApi;
};

export function AdminPackTable({ rows, api = packsApi }: AdminPackTableProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  // Rows act independently: one slow action doesn't lock the others.
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  // A new object per delete, so a second pack with the same name still refocuses.
  const [deleted, setDeleted] = useState<{ name: string } | null>(null);
  const deletedRef = useRef<HTMLParagraphElement>(null);

  // The deleted row disappears with focus inside it; land focus on the confirmation instead.
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

  const run = async (slug: string, action: () => Promise<unknown>, onDone?: () => void) => {
    setRowBusy(slug, true);
    setError(null);
    setDeleted(null);
    try {
      await action();
      setConfirming((current) => (current === slug ? null : current));
      onDone?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
    } finally {
      setRowBusy(slug, false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
      {deleted !== null ? (
        <p ref={deletedRef} tabIndex={-1} role="status" className="text-c3 text-sm outline-none">
          Deleted {deleted.name}.
        </p>
      ) : null}
      {rows.length === 0 ? <p className="text-c3">No packs here.</p> : null}
      {/* relative: the header's sr-only text is absolute and would widen the page on phones. */}
      <div className="relative overflow-x-auto" hidden={rows.length === 0}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-c4">
            <tr>
              <th className="py-2 pr-3 font-bold">Pack</th>
              <th className="py-2 pr-3 font-bold">Host</th>
              <th className="py-2 pr-3 font-bold">Visibility</th>
              <th className="py-2 pr-3 font-bold">Maps</th>
              <th className="py-2 pr-3 font-bold">Updated</th>
              <th className="py-2 pr-3 font-bold">Status</th>
              <th className="py-2 font-bold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-b3 border-t align-top">
                <td className="py-2 pr-3">
                  <Link
                    href={`/p/${row.slug}`}
                    className="wrap-anywhere font-bold text-c1 hover:text-h1"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  {row.ownerOsuId === null ? (
                    // A system account (the archive) has no osu! profile to link.
                    <span className="text-c2">{row.ownerName}</span>
                  ) : (
                    <a
                      href={`https://osu.ppy.sh/users/${row.ownerOsuId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-c2 hover:underline"
                    >
                      {row.ownerName}
                    </a>
                  )}
                </td>
                <td className="py-2 pr-3 text-c2">{VISIBILITY_OPTIONS[row.visibility].label}</td>
                <td className="py-2 pr-3 text-c2">{row.slotCount}</td>
                <td className="py-2 pr-3 text-c2">{formatShortDate(row.updatedAt)}</td>
                <td className="py-2 pr-3">
                  {row.hiddenAt ? (
                    <span className="text-amber-200">Hidden {formatShortDate(row.hiddenAt)}</span>
                  ) : row.pinnedAt ? (
                    <span className="text-h1">Pinned</span>
                  ) : null}
                </td>
                <td className="py-2">
                  {confirming === row.slug ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-c3">Delete {row.name} for good?</span>
                      <Button
                        variant="ghost"
                        onClick={() => setConfirming(null)}
                        disabled={busy.has(row.slug)}
                      >
                        Keep it
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          run(
                            row.slug,
                            () => api.adminRemove(row.slug),
                            () => setDeleted({ name: row.name }),
                          )
                        }
                        disabled={busy.has(row.slug)}
                      >
                        Yes, delete it
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        aria-label={`${row.hiddenAt ? "Unhide" : "Hide"} ${row.name}`}
                        onClick={() =>
                          run(row.slug, () => api.setHidden(row.slug, row.hiddenAt === null))
                        }
                        disabled={busy.has(row.slug)}
                      >
                        {row.hiddenAt ? "Unhide" : "Hide"}
                      </Button>
                      {row.pinnedAt ? (
                        <Button
                          variant="secondary"
                          aria-label={`Unpin ${row.name}`}
                          onClick={() => run(row.slug, () => api.unpin(row.slug))}
                          disabled={busy.has(row.slug)}
                        >
                          Unpin
                        </Button>
                      ) : isPinnable({
                          visibility: row.visibility,
                          hidden: row.hiddenAt !== null,
                        }) ? (
                        <Button
                          variant="secondary"
                          aria-label={`Pin ${row.name}`}
                          onClick={() => run(row.slug, () => api.pin(row.slug))}
                          disabled={busy.has(row.slug)}
                        >
                          Pin
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${row.name}`}
                        onClick={() => setConfirming(row.slug)}
                        disabled={busy.has(row.slug)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
