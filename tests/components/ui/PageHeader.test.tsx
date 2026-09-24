/**
 * @file tests/components/ui/PageHeader.test.tsx
 * @desc PageHeader: one h1 at the shared scale, optional lead, meta line, and actions.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/ui/PageHeader";

describe("PageHeader", () => {
  it("renders the title at the shared scale", () => {
    render(<PageHeader title="Public packs" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Public packs" });
    expect(h1).toHaveClass("font-extrabold", "text-3xl", "sm:text-4xl", "tracking-tight");
  });

  it("adds lead, meta, and actions only when given", () => {
    const { rerender } = render(<PageHeader title="T" />);
    expect(screen.queryByText("Lead")).not.toBeInTheDocument();
    rerender(
      <PageHeader
        title="T"
        lead="Lead"
        meta="Last updated today"
        actions={<button type="button">Go</button>}
      />,
    );
    expect(screen.getByText("Lead")).toHaveClass("text-c3");
    expect(screen.getByText("Last updated today")).toHaveClass("text-sm", "text-c4");
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});
