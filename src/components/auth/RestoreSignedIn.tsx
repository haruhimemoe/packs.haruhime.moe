/**
 * @file src/components/auth/RestoreSignedIn.tsx
 * @desc For pages that know on the server that the visitor is signed in (/signin with a session,
 *       /me, /admin): if this browser has no signed-in marker (a session from before the marker
 *       existed, or a cleared cookie), ask for the session once, which sets the marker and fixes
 *       the header. With `next`, /signin then continues there.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { accountStore } from "@/hooks/useAccount";
import { hasSignedInMarker } from "@/lib/signed-in-marker";

type RestoreSignedInProps = {
  /** Where to go once the session is restored (the sign-in page's `next`). */
  next?: string;
  /** Test seams. Defaults: the page-wide account store, document.cookie. */
  store?: { recheck: () => Promise<void> };
  readCookie?: () => string;
};

const readDocumentCookie = () => document.cookie;

export function RestoreSignedIn({
  next,
  store = accountStore,
  readCookie = readDocumentCookie,
}: RestoreSignedInProps) {
  const router = useRouter();

  useEffect(() => {
    if (next === undefined && hasSignedInMarker(readCookie())) return;
    let live = true;
    store.recheck().then(() => {
      if (live && next !== undefined) router.replace(next);
    });
    return () => {
      live = false;
    };
  }, [next, store, readCookie, router]);

  return next === undefined ? null : <p className="text-c3 text-sm">Signing you in…</p>;
}
