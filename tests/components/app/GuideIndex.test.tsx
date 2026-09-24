/**
 * @file tests/components/app/GuideIndex.test.tsx
 * @desc /guide lists every guide with its description and last update.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GuideIndexPage from "@/app/(public)/guide/page";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";

describe("/guide", () => {
  it("lists every guide", () => {
    render(<GuideIndexPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Guides" })).toBeInTheDocument();
    for (const slug of GUIDE_SLUGS) {
      expect(screen.getByRole("link", { name: GUIDE_DOCS[slug].title })).toHaveAttribute(
        "href",
        `/guide/${slug}`,
      );
      expect(screen.getByText(GUIDE_DOCS[slug].description)).toBeInTheDocument();
    }
  });

  it("titles each guide card with a heading", () => {
    render(<GuideIndexPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: "How to make an osu! mappool pack" }),
    ).toBeInTheDocument();
  });
});
