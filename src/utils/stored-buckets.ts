/**
 * @file src/utils/stored-buckets.ts
 * @desc A pack document's bucket list as zod expects it: Mongoose can leave built-in entries with
 *       a null color and custom ones with null mods, and an empty list means "the default". Shared
 *       by the pack DTO and the stats job, which both read stored documents. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/**
 * @function storedBuckets
 * @param value {unknown} a stored document's `buckets`
 * @returns {unknown} undefined for a missing or empty list; otherwise each entry as { code } when
 *          it has no color (a built-in), or { code, color } plus mods when it has some. Still
 *          unvalidated: parse it with the pool schema.
 */
export const storedBuckets = (value: unknown): unknown =>
  Array.isArray(value) && value.length > 0
    ? value.map((entry: { code?: unknown; color?: unknown; mods?: unknown }) =>
        entry.color === undefined || entry.color === null
          ? { code: entry.code }
          : {
              code: entry.code,
              color: entry.color,
              ...(entry.mods === undefined || entry.mods === null ? {} : { mods: entry.mods }),
            },
      )
    : undefined;
