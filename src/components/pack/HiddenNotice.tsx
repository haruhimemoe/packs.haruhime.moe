/**
 * @file src/components/pack/HiddenNotice.tsx
 * @desc Shown to a hidden pack's owner (and admins): what hiding does and who to ask.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { SITE } from "@/constants/site";

export function HiddenNotice() {
  return (
    <p
      role="status"
      className="rounded-[10px] border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-amber-200 text-sm"
    >
      A moderator hid this pack. It's off the public list, and its link shows “Pack not found” to
      everyone else. Questions: {SITE.contactEmail}
    </p>
  );
}
