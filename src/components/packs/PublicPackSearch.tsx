/**
 * @file src/components/packs/PublicPackSearch.tsx
 * @desc Search box over the public list. Loads /packs/index.json the first time someone focuses
 *       or types (never on page load) and filters it in the browser; while the box is empty, or
 *       if the index can't load, the server-rendered list (children) shows instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { fieldClasses } from "@/components/ui/fieldStyles";
import { fetchSearchIndex, indexEntryToCard } from "@/lib/search-index";
import type { SearchIndex } from "@/schemas/public-pack";
import { prepareSearchIndex, searchPrepared } from "@/utils/search";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; index: SearchIndex }
  | { status: "error" };

type PublicPackSearchProps = {
  children: ReactNode;
  loadIndex?: () => Promise<SearchIndex>;
};

export function PublicPackSearch({
  children,
  loadIndex = () => fetchSearchIndex(),
}: PublicPackSearchProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const started = useRef(false);
  const inputId = useId();

  const load = () => {
    if (started.current) return;
    started.current = true;
    setState({ status: "loading" });
    loadIndex().then(
      (index) => setState({ status: "ready", index }),
      () => {
        // Let the next focus or keystroke try again.
        started.current = false;
        setState({ status: "error" });
      },
    );
  };

  // Fold the whole index once when it arrives, not on every keystroke.
  const prepared = useMemo(
    () => (state.status === "ready" ? prepareSearchIndex(state.index.packs) : []),
    [state],
  );
  const trimmed = query.trim();
  let results: ReactNode = children;
  // Always mounted, so screen readers announce the first count too; only its text changes.
  let status = "";
  if (trimmed !== "" && state.status !== "error") {
    if (state.status === "ready") {
      const matches = searchPrepared(prepared, trimmed);
      status =
        matches.length === 0
          ? `No packs match “${trimmed}”.`
          : `${matches.length} ${matches.length === 1 ? "pack matches" : "packs match"}.`;
      results =
        matches.length > 0 ? <PublicPackList packs={matches.map(indexEntryToCard)} /> : null;
    } else {
      results = <p className="text-c4 text-sm">Loading search…</p>;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="font-bold text-c3 text-sm">
          Search public packs
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          placeholder="Pack name, host, or description"
          onFocus={load}
          onChange={(event) => {
            setQuery(event.target.value);
            load();
          }}
          className={fieldClasses()}
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-rose-300 text-sm">
          Search isn't available right now. Try again later.
        </p>
      ) : null}
      <p role="status" className="text-c3 text-sm empty:hidden">
        {status}
      </p>
      {results}
    </div>
  );
}
