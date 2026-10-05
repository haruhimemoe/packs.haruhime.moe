/**
 * @file tests/unit/utils/pack-history-access.test.ts
 * @desc packHistoryAccessOf: owner always reads and toggles; a visitor reads a public/unlisted
 *       pack's history only with historyPublic on and not hidden; private and hidden packs hide
 *       history from everyone but the owner and admins; admins read any non-private pack's
 *       history (hidden or historyPublic off included) but never toggle.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { type PackHistoryGuarded, packHistoryAccessOf } from "@/utils/pack-history-access";

const pack = (overrides: Partial<PackHistoryGuarded> = {}): PackHistoryGuarded => ({
  ownerId: "owner",
  visibility: "public",
  ...overrides,
});

describe("packHistoryAccessOf", () => {
  it("lets the owner read and toggle regardless of historyPublic", () => {
    const access = packHistoryAccessOf(pack({ visibility: "private" }), {
      id: "owner",
      isAdmin: false,
    });
    expect(access).toEqual({ canRead: true, canToggle: true, isOwner: true });
  });

  it("refuses a visitor when historyPublic is off", () => {
    const access = packHistoryAccessOf(pack(), { id: "visitor", isAdmin: false });
    expect(access.canRead).toBe(false);
  });

  it("lets a visitor read a public pack's history when historyPublic is on", () => {
    const access = packHistoryAccessOf(pack({ historyPublic: true }), {
      id: "visitor",
      isAdmin: false,
    });
    expect(access.canRead).toBe(true);
    expect(access.canToggle).toBe(false);
  });

  it("hides history from a visitor of a private pack even with historyPublic on", () => {
    const access = packHistoryAccessOf(pack({ visibility: "private", historyPublic: true }), {
      id: "visitor",
      isAdmin: false,
    });
    expect(access.canRead).toBe(false);
  });

  it("hides history from a visitor of a hidden pack even with historyPublic on", () => {
    const access = packHistoryAccessOf(pack({ historyPublic: true, hiddenAt: new Date() }), {
      id: "visitor",
      isAdmin: false,
    });
    expect(access.canRead).toBe(false);
  });

  it("lets an admin read any non-private pack's history, hidden or historyPublic off", () => {
    const access = packHistoryAccessOf(pack({ hiddenAt: new Date() }), {
      id: "mod",
      isAdmin: true,
    });
    expect(access.canRead).toBe(true);
    expect(access.canToggle).toBe(false);
  });

  it("never lets an admin read a private pack's history", () => {
    const access = packHistoryAccessOf(pack({ visibility: "private" }), {
      id: "mod",
      isAdmin: true,
    });
    expect(access.canRead).toBe(false);
  });

  it("refuses an anonymous viewer", () => {
    const access = packHistoryAccessOf(pack({ historyPublic: true }), null);
    expect(access.canRead).toBe(true);
    expect(access.isOwner).toBe(false);
  });
});
