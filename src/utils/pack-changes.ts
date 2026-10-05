/**
 * @file src/utils/pack-changes.ts
 * @desc A pack revision's changes as lines people read ("Added 2015 to NM3", "Moved 2015 from
 *       NM3 to HD1"), built from @haruhimemoe/vcs's structured diff and the two snapshots it
 *       compares. Slots are keyed by pack-snapshot.ts's per-pack key, so a map's slot change shows
 *       once even when the same map sits in two slots. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { Change, Segment } from "@haruhimemoe/vcs";
import type { PackSnapshot, SnapshotSlot } from "@/utils/pack-snapshot";

/** One line of a change view; `beatmapId` links the map when there is one. */
export type ChangeLine = {
  kind: "added" | "removed" | "moved" | "changed";
  text: string;
  beatmapId?: number;
};

const slotLabel = ({ mod, index }: Pick<SnapshotSlot, "mod" | "index">): string =>
  mod === null ? "no slot" : `${mod}${index}`;

const keyOf = (segment: Segment | undefined): string | null =>
  typeof segment === "object" && segment !== null ? segment.key : null;

const bucketLine = (change: Change): ChangeLine => {
  if (change.op === "add") return { kind: "added", text: `Added slot ${change.key}` };
  if (change.op === "remove") return { kind: "removed", text: `Removed slot ${change.key}` };
  if (change.op === "move") return { kind: "changed", text: "Reordered slots" };
  const code = keyOf(change.segments[1]) ?? "";
  const field = change.segments[2];
  if (field === "mods") return { kind: "changed", text: `Changed the mods on ${code}` };
  return { kind: "changed", text: `Changed slot ${code}` };
};

/**
 * @function packChangeLines
 * @param changes {readonly Change[]} diffValue(before, after, PACK_CODEC)
 * @param before {PackSnapshot} the older snapshot
 * @param after {PackSnapshot} the newer snapshot
 * @returns {ChangeLine[]} what changed, in document order
 */
export const packChangeLines = (
  changes: readonly Change[],
  before: PackSnapshot,
  after: PackSnapshot,
): ChangeLine[] => {
  const was = new Map(before.slots.map((slot) => [slot.key, slot]));
  const now = new Map(after.slots.map((slot) => [slot.key, slot]));
  const seen = new Set<string>();
  const lines: ChangeLine[] = [];

  for (const change of changes) {
    const [top, item, field] = change.segments;
    if (top === "slots" && change.segments.length === 1) {
      if (change.op === "add" || change.op === "remove") {
        const slot = change.value as SnapshotSlot;
        const added = change.op === "add";
        lines.push({
          kind: added ? "added" : "removed",
          text: `${added ? "Added" : "Removed"} ${slot.beatmapId} ${added ? "to" : "from"} ${slotLabel(slot)}`,
          beatmapId: slot.beatmapId,
        });
      } else if (change.op === "move" && !seen.has(change.key)) {
        seen.add(change.key);
        const from = was.get(change.key);
        const to = now.get(change.key);
        if (!from || !to) continue;
        const moved = slotLabel(from) !== slotLabel(to);
        lines.push({
          kind: "moved",
          text: moved
            ? `Moved ${to.beatmapId} from ${slotLabel(from)} to ${slotLabel(to)}`
            : `Reordered ${to.beatmapId} in ${slotLabel(to)}`,
          beatmapId: to.beatmapId,
        });
      }
    } else if (top === "slots" && (field === "mod" || field === "index")) {
      const key = keyOf(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const from = was.get(key);
      const to = now.get(key);
      if (from && to)
        lines.push({
          kind: "moved",
          text: `Moved ${to.beatmapId} from ${slotLabel(from)} to ${slotLabel(to)}`,
          beatmapId: to.beatmapId,
        });
    } else if (top === "buckets") {
      lines.push(bucketLine(change));
    } else if (top === "name" && change.op === "set") {
      lines.push({ kind: "changed", text: `Renamed to ${String(change.to ?? "untitled")}` });
    } else if (top === "description" && change.op === "set") {
      lines.push({ kind: "changed", text: "Changed the description" });
    }
  }
  return lines;
};
