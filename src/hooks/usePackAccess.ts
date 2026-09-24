/**
 * @file src/hooks/usePackAccess.ts
 * @desc What this browser's viewer may see of a saved pack (and whether they own it or are an
 *       admin), asked once through our API, and only when the signed-in marker is present: cached
 *       pack pages carry no per-viewer data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { useEffect, useState } from "react";
import { hasSignedInMarker } from "@/lib/signed-in-marker";
import type { SavedPack } from "@/schemas/saved-pack";

export type PackAccess =
  | { status: "anonymous" }
  | { status: "checking" }
  | { status: "none" }
  | { status: "found"; pack: SavedPack; isOwner: boolean; isAdmin: boolean };

export type PackAccessDeps = {
  get: (slug: string) => Promise<{ pack: SavedPack; isOwner: boolean; isAdmin?: boolean } | null>;
  readCookie?: () => string;
};

const readDocumentCookie = () => document.cookie;

/**
 * @function usePackAccess
 * @param slug {string | null} the pack (null: nothing to check)
 * @param deps {PackAccessDeps} API get, cookie reader (tests)
 * @returns {PackAccess} "anonymous" without the marker (no request)
 */
export const usePackAccess = (
  slug: string | null,
  { get, readCookie = readDocumentCookie }: PackAccessDeps,
): PackAccess => {
  // "anonymous" first, so the cached server render never says "Loading".
  const [access, setAccess] = useState<PackAccess>({ status: "anonymous" });
  useEffect(() => {
    if (slug === null || !hasSignedInMarker(readCookie())) {
      setAccess({ status: "anonymous" });
      return;
    }
    let live = true;
    setAccess({ status: "checking" });
    get(slug).then(
      (found) => {
        if (live) {
          setAccess(
            found
              ? { status: "found", ...found, isAdmin: found.isAdmin ?? false }
              : { status: "none" },
          );
        }
      },
      () => {
        if (live) setAccess({ status: "none" });
      },
    );
    return () => {
      live = false;
    };
  }, [slug, get, readCookie]);
  return access;
};
