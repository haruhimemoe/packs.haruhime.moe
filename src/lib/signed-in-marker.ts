/**
 * @file src/lib/signed-in-marker.ts
 * @desc A readable "this browser may be signed in" cookie. It holds no secret; it only tells the
 *       page whether asking the server for the session is worth a request. The server sets it with
 *       the session and clears it on sign-out or a missing session (src/lib/auth.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export const SIGNED_IN_COOKIE = "packs-signed-in";

/**
 * @function markerMaxAge
 * @param expiresAt {Date | string} when the session expires
 * @param now {number} current time in ms (tests)
 * @returns {number} whole seconds until then, at least 0
 */
export const markerMaxAge = (expiresAt: Date | string, now: number = Date.now()): number =>
  Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));

/**
 * @function hasSignedInMarker
 * @param cookieHeader {string} document.cookie or a Cookie header
 * @returns {boolean} true when the marker is present and set
 */
export const hasSignedInMarker = (cookieHeader: string): boolean =>
  cookieHeader.split(/;\s*/).includes(`${SIGNED_IN_COOKIE}=1`);

/**
 * @function clearSignedInMarker
 * @param target {{ cookie: string }} the document (tests pass a stand-in)
 */
export const clearSignedInMarker = (target: { cookie: string } = document): void => {
  target.cookie = `${SIGNED_IN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};
