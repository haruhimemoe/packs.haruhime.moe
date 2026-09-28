/**
 * @file src/constants/visibility.ts
 * @desc How each saved-pack visibility is described to people.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PackVisibility } from "@haruhimemoe/pool/service";

export const VISIBILITY_OPTIONS: Record<PackVisibility, { label: string; description: string }> = {
  private: { label: "Private", description: "Only you can open it." },
  unlisted: { label: "Unlisted", description: "Anyone with the link can open it." },
  public: {
    label: "Public",
    description: "Anyone with the link can open it, and it's listed on the public packs page.",
  },
};
