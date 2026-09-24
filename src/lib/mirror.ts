/**
 * @file src/lib/mirror.ts
 * @desc The hinai mirror client packs uses in the browser (metadata, availability, downloads), and
 *       the plain words a person sees when it fails (keyed by HinaiError.code, never its message).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { createHinaiClient, type HinaiClient, HinaiError } from "@haruhimemoe/hinai";

export { backoffDelayMs, HinaiError, OSZ_MIME, setDownloadUrl } from "@haruhimemoe/hinai";

/** One client for the app. Browsers send no User-Agent (it would force a CORS preflight). */
export const mirror: HinaiClient = createHinaiClient();

const UNREACHABLE = "Couldn't reach the beatmap mirror. Check your connection and try again.";
const TIMED_OUT = "The beatmap mirror didn't answer in time. Try again.";
const NOT_ON_MIRROR = "This beatmapset isn't on the mirror.";
const HAD_A_PROBLEM = "The beatmap mirror had a problem. Try again in a minute.";
const BUSY = "The beatmap mirror is busy. Try again in a minute.";
const REFUSED = "The beatmap mirror couldn't do that right now.";
const GENERIC = "Something went wrong. Try again.";

/**
 * @function mirrorErrorText
 * @param error {unknown} whatever a mirror call rejected with
 * @param fallback {string} the caller's own text for anything that isn't a HinaiError
 * @returns {string} plain words keyed by the error's code: no status codes, millisecond counts or
 *          internal codes. The mirror's own codes read as busy (retryable) or refused (not).
 */
export const mirrorErrorText = (error: unknown, fallback: string = GENERIC): string => {
  if (!(error instanceof HinaiError)) return fallback;
  switch (error.code) {
    case "network":
      return UNREACHABLE;
    case "timeout":
      return TIMED_OUT;
    case "not_found":
      return NOT_ON_MIRROR;
    case "http_error":
    case "bad_response":
      return HAD_A_PROBLEM;
    default:
      return error.retryable ? BUSY : REFUSED;
  }
};
