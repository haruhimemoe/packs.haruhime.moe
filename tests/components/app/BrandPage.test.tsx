/**
 * @file tests/components/app/BrandPage.test.tsx
 * @desc /brand: the header, every file and color from brandPageData("packs"), the contact, and
 *       the Organization and breadcrumbs JSON-LD.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { brandPageData } from "@haruhimemoe/brand/products";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrandRoute from "@/app/(public)/brand/page";

const DATA = brandPageData("packs");

describe("/brand", () => {
  it("renders brandPageData: every file, color and the contact", () => {
    const { container } = render(<BrandRoute />);
    expect(screen.getByRole("heading", { level: 1, name: "Brand" })).toBeInTheDocument();
    expect(screen.getByText(DATA.writing)).toBeInTheDocument();
    for (const asset of DATA.assets) {
      expect(screen.getByRole("link", { name: asset.label })).toHaveAttribute("href", asset.href);
    }
    for (const hex of Object.values(DATA.palette)) {
      expect(screen.getAllByText(hex).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("link", { name: DATA.contact })).toHaveAttribute(
      "href",
      `mailto:${DATA.contact}`,
    );
    const ld = container.querySelector('script[type="application/ld+json"]');
    const [org, crumbs] = JSON.parse(ld?.textContent ?? "{}")["@graph"];
    expect(org).toMatchObject({ "@type": "Organization" });
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" });
  });
});
