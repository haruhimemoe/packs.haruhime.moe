/**
 * @file tests/unit/lib/mirror.test.ts
 * @desc mirrorErrorText: plain words for every HinaiError code, never the error's own message,
 *       status codes or millisecond counts; the caller's fallback for anything else.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { HinaiError, mirrorErrorText } from "@/lib/mirror";

/** A message that must never reach the UI. */
const RAW = "raw 503 after 10000 ms (upstream_relay_shed)";

describe("mirrorErrorText", () => {
  it.each([
    ["network", false, "Couldn't reach the beatmap mirror. Check your connection and try again."],
    ["timeout", true, "The beatmap mirror didn't answer in time. Try again."],
    ["not_found", false, "This beatmapset isn't on the mirror."],
    ["http_error", true, "The beatmap mirror had a problem. Try again in a minute."],
    ["http_error", false, "The beatmap mirror had a problem. Try again in a minute."],
    ["bad_response", true, "The beatmap mirror had a problem. Try again in a minute."],
    ["upstream_relay_shed", true, "The beatmap mirror is busy. Try again in a minute."],
    ["too_many_ids", false, "The beatmap mirror couldn't do that right now."],
  ])("says %s (retryable: %s) in plain words", (code, retryable, text) => {
    const error = new HinaiError(code, RAW, { status: 503, retryable, retryAfterMs: 10_000 });
    const shown = mirrorErrorText(error);
    expect(shown).toBe(text);
    expect(shown).not.toMatch(/\d/);
  });

  it("uses the generic text for anything that isn't a HinaiError", () => {
    expect(mirrorErrorText(new TypeError(RAW))).toBe("Something went wrong. Try again.");
    expect(mirrorErrorText("nope")).toBe("Something went wrong. Try again.");
  });

  it("uses the caller's own generic text when given one", () => {
    expect(mirrorErrorText(new TypeError(RAW), "Something went wrong loading beatmaps.")).toBe(
      "Something went wrong loading beatmaps.",
    );
  });
});
