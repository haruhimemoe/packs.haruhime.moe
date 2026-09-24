/**
 * @file src/components/packs/SearchParamsWatcher.tsx
 * @desc Tells /packs when the router's query string changes: a link to the page with other
 *       filters (the header's Packs link, say) keeps the page mounted, and only the router knows.
 *       Renders nothing. It reads useSearchParams, so render it inside <Suspense>: on the cached
 *       page it then runs in the browser only, and the rest still prerenders.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type SearchParamsWatcherProps = {
  /** Called with the router's query string after the first render and after each change. */
  onChange: (search: string) => void;
};

export function SearchParamsWatcher({ onChange }: SearchParamsWatcherProps) {
  const search = useSearchParams()?.toString() ?? "";
  useEffect(() => {
    onChange(search);
  }, [search, onChange]);
  return null;
}
