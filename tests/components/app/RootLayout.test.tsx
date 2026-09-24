/**
 * @file tests/components/app/RootLayout.test.tsx
 * @desc Root layout frame: the Nunito variable on <html>, then a skip link first, the packs
 *       header, the page inside the #main landmark, and the packs footer, in that order.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Nunito: () => ({ variable: "font-nunito" }) }));
vi.mock("@/hooks/useAccount", () => ({ useAccount: () => ({ status: "signed-out" }) }));

const { default: RootLayout } = await import("@/app/layout");

// <html> can't render inside a test container: render the markup and make it the page. The
// swap replaces <body>, so queries go through the returned helpers.
const renderLayout = () => {
  const markup = renderToStaticMarkup(<RootLayout>hello pack</RootLayout>);
  const parsed = new DOMParser().parseFromString(`<!doctype html>${markup}`, "text/html");
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement,
  );
  return within(document.body);
};

describe("RootLayout", () => {
  it("puts the Nunito variable and the dark body on the page", () => {
    renderLayout();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveClass("font-nunito");
    expect(document.body).toHaveClass("bg-b5", "font-sans", "text-c2");
  });

  it("starts with a skip link that targets the main landmark", () => {
    const page = renderLayout();
    const skip = page.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main");
    expect(document.body.querySelector("a")).toBe(skip);
    expect(page.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("renders the page inside main, between the packs header and footer", () => {
    const page = renderLayout();
    const header = page.getByRole("banner");
    const main = page.getByRole("main");
    const footer = page.getByRole("contentinfo");
    expect(main).toHaveTextContent("hello pack");
    expect(within(header).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin",
    );
    expect(within(footer).getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
