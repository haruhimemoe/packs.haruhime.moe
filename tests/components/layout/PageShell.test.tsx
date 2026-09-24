/**
 * @file tests/components/layout/PageShell.test.tsx
 * @desc PageShell: skip link first, children inside the #main landmark, header + footer present.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageShell } from "@/components/layout/PageShell";

vi.mock("@/hooks/useAccount", () => ({ useAccount: () => ({ status: "signed-out" }) }));

describe("PageShell", () => {
  it("starts with a skip link that targets the main landmark", () => {
    const { container } = render(<PageShell>content</PageShell>);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main");
    expect(container.querySelector("a")).toBe(skip);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("renders children inside main with header and footer around it", () => {
    render(<PageShell>hello pack</PageShell>);
    expect(screen.getByRole("main")).toHaveTextContent("hello pack");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
