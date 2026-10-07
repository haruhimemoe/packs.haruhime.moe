/**
 * @file src/utils/signout-cookies.ts
 * @desc What POST /api/signout sends and clears, pure: the hub's session cookie picked out of a
 *       Cookie header (only it is forwarded to the hub, never packs' other cookies), and the
 *       Set-Cookie lines that clear better-auth's session cookies (bare and __Secure-, with
 *       session_data) and the shared signed-in marker, on the shared domain when the request
 *       came in under it (host-only otherwise, as on localhost).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** better-auth's session cookies, before any __Secure- prefix. */
const SESSION_COOKIES = ["better-auth.session_token", "better-auth.session_data"] as const;

/** The prefix better-auth adds on https. */
const SECURE_PREFIX = "__Secure-";

/**
 * @function sessionCookieHeader
 * @param cookieHeader {string | null} the request's Cookie header
 * @returns {string | null} only its session_token cookies (bare and __Secure-), as a Cookie
 *          header, or null when there are none
 */
export const sessionCookieHeader = (cookieHeader: string | null): string | null => {
  if (!cookieHeader) return null;
  const names = new Set([SESSION_COOKIES[0], `${SECURE_PREFIX}${SESSION_COOKIES[0]}`]);
  const kept = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => names.has(part.slice(0, part.indexOf("="))));
  return kept.length > 0 ? kept.join("; ") : null;
};

/**
 * @function cookieDomainFor
 * @param host {string} the request's hostname
 * @param sharedDomain {string} the hub's cookie domain, like ".haruhime.moe"
 * @returns {string | null} sharedDomain when host is under it, else null (host-only cookies)
 */
export const cookieDomainFor = (host: string, sharedDomain: string): string | null => {
  const bare = sharedDomain.replace(/^\./, "");
  return host === bare || host.endsWith(`.${bare}`) ? sharedDomain : null;
};

/**
 * @function clearingCookies
 * @param options {{ marker: string; domain: string | null; secure: boolean }} the signed-in
 *        marker's name, the Domain to clear on (null: none) and whether the site is https
 * @returns {string[]} one expired Set-Cookie per session cookie (bare and __Secure-) and the marker
 */
export const clearingCookies = ({
  marker,
  domain,
  secure,
}: {
  marker: string;
  domain: string | null;
  secure: boolean;
}): string[] => {
  const tail = `; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
  const names = [
    ...SESSION_COOKIES.map((name) => ({ name, secure })),
    // A __Secure- cookie can only be set (or cleared) with Secure.
    ...SESSION_COOKIES.map((name) => ({ name: `${SECURE_PREFIX}${name}`, secure: true })),
    { name: marker, secure },
  ];
  return names.map(({ name, secure: s }) => `${name}=${tail}${s ? "; Secure" : ""}`);
};
