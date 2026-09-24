/**
 * @file tests/helpers/requests.ts
 * @desc Builds Requests for calling route handlers directly in tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

export const TEST_ORIGIN = "http://localhost:3000";

type RequestOptions = {
  method?: string;
  cookie?: string;
  body?: unknown;
  contentType?: string;
  /** Extra request headers (Authorization, x-real-ip, ...). */
  headers?: Record<string, string>;
};

/**
 * @function apiRequest
 * @param path {string} path under the test origin
 * @param options {RequestOptions} method, session cookie, JSON body (strings are sent raw), headers
 * @returns {Request}
 */
export const apiRequest = (
  path: string,
  {
    method = "GET",
    cookie,
    body,
    contentType = "application/json",
    headers: extra = {},
  }: RequestOptions = {},
): Request => {
  const headers = new Headers(extra);
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", contentType);
  return new Request(`${TEST_ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
};

/**
 * @function slugContext
 * @param slug {string} route param
 * @returns {{ params: Promise<{ slug: string }> }} the second argument Next passes to handlers
 */
export const slugContext = (slug: string): { params: Promise<{ slug: string }> } => ({
  params: Promise.resolve({ slug }),
});

/** The second argument Next passes to handlers of routes without params. */
export const noContext = { params: Promise.resolve({}) };
