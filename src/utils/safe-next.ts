/**
 * @file src/utils/safe-next.ts
 * @desc Where to go after sign-in. Only same-site absolute paths pass; anything else (other
 *       hosts, protocol-relative, backslashes, control characters) becomes /me.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export const DEFAULT_AFTER_SIGN_IN = "/me";
const MAX_NEXT_LENGTH = 512;

const hasControlCharacter = (value: string): boolean =>
  [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

/**
 * @function safeNextPath
 * @param raw {string | null | undefined} untrusted ?next= value
 * @returns {string} a same-site path, or DEFAULT_AFTER_SIGN_IN
 */
export const safeNextPath = (raw: string | null | undefined): string => {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return DEFAULT_AFTER_SIGN_IN;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_AFTER_SIGN_IN;
  if (raw.includes("\\") || hasControlCharacter(raw)) return DEFAULT_AFTER_SIGN_IN;
  return raw;
};

/**
 * @function signInHref
 * @param next {string} where to land after signing in
 * @returns {string} /signin link carrying it
 */
export const signInHref = (next: string): string => `/signin?next=${encodeURIComponent(next)}`;
