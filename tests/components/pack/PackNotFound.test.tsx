/**
 * @file tests/components/pack/PackNotFound.test.tsx
 * @desc /p/[slug] and /p/[slug]/edit 404s: say the pack may be deleted or private, offer a way on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EditNotFound from "@/app/(protected)/p/[slug]/edit/not-found";
import PackPageNotFound from "@/app/(public)/p/[slug]/not-found";

describe("pack not-found pages", () => {
  it.each([
    ["/p/[slug]", PackPageNotFound],
    ["/p/[slug]/edit", EditNotFound],
  ])("%s says the pack may have been deleted or be private", (_route, Page) => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: "Pack not found" })).toBeInTheDocument();
    expect(
      screen.getByText(/may have been deleted by its owner, or it's private/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open a pack key" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Build a pack" })).toHaveAttribute("href", "/new");
  });
});
