/**
 * @file tests/components/layout/Footer.test.tsx
 * @desc Footer: legal links, source link, trademark notice, no-hosting statement, the other
 *       haruhime tools, and the haruhime.moe wordmark, Discord icon and GitHub org links.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { CONTENT } from "@/constants/content";
import { SITE } from "@/constants/site";

describe("Footer", () => {
  it("has three labelled link columns", () => {
    render(<Footer />);
    const packs = screen.getByRole("region", { name: "Packs" });
    expect(within(packs).getByRole("link", { name: "New pack" })).toHaveAttribute("href", "/new");
    expect(within(packs).getByRole("link", { name: "Public packs" })).toHaveAttribute(
      "href",
      "/packs",
    );
    expect(within(packs).getByRole("link", { name: "Open a key" })).toHaveAttribute("href", "/k");
    expect(within(packs).getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/guides");
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByRole("link", { name: "Brand" })).toHaveAttribute("href", "/brand");
    expect(within(about).getByRole("link", { name: "API" })).toHaveAttribute("href", "/docs/api");
    expect(within(about).getByRole("link", { name: SITE.contactEmail })).toHaveAttribute(
      "href",
      `mailto:${SITE.contactEmail}`,
    );
    const legal = screen.getByRole("region", { name: "Legal" });
    for (const { slug, title } of CONTENT.entries.legal) {
      expect(within(legal).getByRole("link", { name: title })).toHaveAttribute(
        "href",
        `/legal/${slug}`,
      );
    }
  });

  it("links to the source on GitHub", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "Source on GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/haruhimemoe/packs.haruhime.moe");
  });

  it("links the parent brand with the haruhime.moe wordmark", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "haruhime.moe" });
    expect(link).toHaveAttribute("href", "https://www.haruhime.moe");
    expect(link).toHaveAttribute("href", SITE.parentUrl);
    // The wordmark is drawn inline and hidden from screen readers; the link's label names it.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(link).queryByRole("img")).not.toBeInTheDocument();
  });

  it("links the haruhimemoe GitHub org with a decorative GitHub mark", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "haruhimemoe on GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/haruhimemoe");
    expect(link).toHaveAttribute("href", SITE.githubOrg);
    const svg = link.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  });

  it("links our Discord server with a decorative Discord icon before the GitHub mark", () => {
    render(<Footer />);
    const link = screen.getByRole("link", { name: "Discord" });
    expect(link).toHaveAttribute("href", "https://haruhime.moe/discord");
    expect(link).toHaveAttribute("href", SITE.discordUrl);
    // Same tab, like every other footer link.
    expect(link).not.toHaveAttribute("target");
    // An icon only: no visible text, and the link's label names it.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link).toHaveTextContent("");
    // Beside the GitHub mark in the bottom row, Discord first.
    const github = screen.getByRole("link", { name: "haruhimemoe on GitHub" });
    expect(link.parentElement).toBe(github.parentElement);
    expect(link.nextElementSibling).toBe(github);
  });

  it("keeps Discord out of the link columns", () => {
    render(<Footer />);
    expect(screen.getAllByRole("link", { name: "Discord" })).toHaveLength(1);
    const about = screen.getByRole("region", { name: "About" });
    const labels = within(about)
      .getAllByRole("link")
      .map((l) => l.textContent);
    expect(labels).toEqual(["Brand", "API", "Source on GitHub", SITE.contactEmail]);
  });

  it("keeps one line of fine print with the mirror note and the trademark notice", () => {
    render(<Footer />);
    const fine = screen.getByText(/never stores them/);
    expect(fine).toHaveTextContent(
      "Beatmap files come from mirror.hinamizawa.ai straight to your browser; this site never stores them.",
    );
    expect(fine).toHaveTextContent(SITE.trademarkNotice);
    expect(screen.getByRole("button", { name: "Clear local data" })).toBeInTheDocument();
  });

  it("links the other haruhime tools after the Packs column, not packs itself", () => {
    render(<Footer />);
    // One Footer nav (ui 0.7.0); each column is a region named by its heading.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    const nav = screen.getByRole("navigation", { name: "Footer" });
    const names = within(nav)
      .getAllByRole("region")
      .map((column) => document.getElementById(column.getAttribute("aria-labelledby") ?? ""))
      .map((heading) => heading?.textContent);
    expect(names.slice(0, 2)).toEqual(["Packs", "haruhime tools"]);
    const tools = screen.getByRole("region", { name: "haruhime tools" });
    expect(within(tools).getByRole("link", { name: /^pools/ })).toHaveAttribute(
      "href",
      "https://pools.haruhime.moe",
    );
    expect(within(tools).getByRole("link", { name: /^bb/ })).toHaveAttribute(
      "href",
      "https://bb.haruhime.moe",
    );
    expect(within(tools).queryByRole("link", { name: /^packs/ })).toBeNull();
  });
});
