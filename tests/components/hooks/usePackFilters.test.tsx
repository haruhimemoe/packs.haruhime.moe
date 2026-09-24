/**
 * @file tests/components/hooks/usePackFilters.test.tsx
 * @desc usePackFilters: hydrating the cached HTML it starts without filters and reads the URL
 *       right after; any other mount (coming back to /packs) has the URL's filters on its first
 *       render, so the page never flashes the unfiltered list.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { usePackFilters } from "@/hooks/usePackFilters";
import { EMPTY_FILTERS, type PackFilters } from "@/utils/pack-filters";

/** Renders the hook and records the filters of every render. */
const recorder = () => {
  const renders: PackFilters[] = [];
  function Probe() {
    const { filters } = usePackFilters();
    renders.push(filters);
    return <p>{filters.mods.join(",") || "none"}</p>;
  }
  return { renders, Probe };
};

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("usePackFilters", () => {
  it("has the URL's filters on the first render of a mount that isn't hydrating", () => {
    window.history.replaceState(null, "", "/packs?mods=DT&sort=name");
    const { renders, Probe } = recorder();
    render(<Probe />);
    expect(renders[0]).toMatchObject({ mods: ["DT"], sort: "name" });
  });

  it("matches the cached HTML while hydrating, then reads the URL", async () => {
    window.history.replaceState(null, "", "/packs?mods=DT");
    const server = recorder();
    const html = renderToString(<server.Probe />);
    expect(server.renders[0]).toEqual(EMPTY_FILTERS);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const client = recorder();
    render(<client.Probe />, { container, hydrate: true });

    expect(client.renders[0]).toEqual(EMPTY_FILTERS);
    await waitFor(() => expect(container).toHaveTextContent("DT"));
  });
});
