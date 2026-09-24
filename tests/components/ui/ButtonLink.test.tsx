/**
 * @file tests/components/ui/ButtonLink.test.tsx
 * @desc Component tests for ButtonLink: renders a link styled like a button.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink } from "@/components/ui/ButtonLink";

describe("ButtonLink", () => {
  it("renders an anchor with the href and button styling", () => {
    render(
      <ButtonLink href="/new" size="lg">
        New pack
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "New pack" });
    expect(link).toHaveAttribute("href", "/new");
    expect(link).toHaveClass("bg-h2", "h-11", "focus-visible:outline-2");
  });

  it("still gets hover colors (a link is never :disabled)", () => {
    render(<ButtonLink href="/new">New</ButtonLink>);
    expect(screen.getByRole("link")).toHaveClass("not-disabled:hover:bg-h1");
  });
});
