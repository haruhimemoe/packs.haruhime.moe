/**
 * @file src/components/history/HistoryTable.tsx
 * @desc A pack's version list: when, who, what kind of save, and a link to its changes. The
 *       selected row is marked current for assistive tech. Server-safe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { LinkRow, Table, Td, TextLink, Th } from "@haruhimemoe/ui";
import type { RevisionMeta } from "@haruhimemoe/vcs";
import { REVISION_LABELS } from "@/constants/history";
import { formatShortDate } from "@/utils/date";

type HistoryTableProps = {
  /** The pack's slug (links to ?rev=). */
  slug: string;
  revisions: readonly RevisionMeta[];
  /** The revision shown in ChangeList, if any. */
  selected?: string | undefined;
  /** The oldest shown revision's seq, for an "Older versions" link; null when there's no more. */
  older: number | null;
};

/**
 * @function HistoryTable
 * @param props {HistoryTableProps} slug, revisions, selected, older
 * @returns {JSX.Element} the versions table, with an "Older versions" link when there's a next page
 */
export function HistoryTable({ slug, revisions, selected, older }: HistoryTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <Table caption="Versions">
        <thead>
          <tr>
            <Th scope="col">When</Th>
            <Th scope="col">Who</Th>
            <Th scope="col">What</Th>
            <Th scope="col">
              <span className="sr-only">Changes</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((revision) => {
            const current = revision.id === selected;
            return (
              <tr key={revision.id}>
                <Td>{formatShortDate(revision.createdAt)}</Td>
                <Td>{revision.authorName || "the owner"}</Td>
                <Td>
                  {REVISION_LABELS[revision.kind]}
                  {revision.message ? `: ${revision.message}` : ""}
                </Td>
                <Td>
                  <TextLink
                    href={`/p/${slug}/history?rev=${encodeURIComponent(revision.id)}`}
                    aria-current={current ? "true" : undefined}
                  >
                    Changes
                  </TextLink>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {older !== null ? (
        <LinkRow
          items={[{ href: `/p/${slug}/history?before=${older}`, label: "Older versions" }]}
        />
      ) : null}
    </div>
  );
}
