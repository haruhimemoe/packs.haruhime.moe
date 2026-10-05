/**
 * @file src/components/pack/PackNotFoundFallback.tsx
 * @desc /p/[slug] not-found page. The cached answer for private, hidden, and missing packs is
 *       "Pack not found"; a signed-in owner (or an admin, for hidden packs) gets the pack loaded
 *       here in the browser instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Text } from "@haruhimemoe/ui";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { PackNotFound } from "@/components/pack/PackNotFound";
import { type PackViewApi, SavedPackView } from "@/components/pack/SavedPackView";
import { SITE } from "@/constants/site";
import { usePackAccess } from "@/hooks/usePackAccess";
import { packsApi } from "@/lib/packs-api";

type PackNotFoundFallbackProps = {
  /** Test seams. Defaults: the route's slug, our API, document.cookie. */
  slug?: string;
  api?: PackViewApi;
  readCookie?: () => string;
};

/**
 * @function PackNotFoundFallback
 * @param props {PackNotFoundFallbackProps} slug, api, readCookie
 * @returns {JSX.Element} /p/[slug] not-found page
 */
export function PackNotFoundFallback({
  slug,
  api = packsApi,
  readCookie,
}: PackNotFoundFallbackProps) {
  const params = useParams<{ slug?: string }>();
  const target = slug ?? params?.slug ?? null;
  const access = usePackAccess(target, { get: api.get, ...(readCookie ? { readCookie } : {}) });

  // The cached page's title says "Pack not found"; the owner should see the pack's name.
  const foundName = access.status === "found" ? access.pack.name : null;
  useEffect(() => {
    if (foundName !== null) document.title = `${foundName} · ${SITE.title}`;
  }, [foundName]);

  if (access.status === "checking") {
    return <Text tone="muted">Loading pack…</Text>;
  }
  if (access.status === "found") {
    return (
      <SavedPackView
        pack={access.pack}
        isOwner={access.isOwner}
        isAdmin={access.isAdmin}
        pinned={access.pinned}
        api={api}
      />
    );
  }
  return <PackNotFound />;
}
