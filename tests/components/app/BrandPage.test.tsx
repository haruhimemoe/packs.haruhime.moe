/**
 * @file tests/components/app/BrandPage.test.tsx
 * @desc /brand: name rules, downloadable logos, swatches with hex, trademark notice, Organization data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrandPage from "@/app/(public)/brand/page";
import { BRAND_ASSETS, BRAND_COLORS } from "@/constants/brand";
import { SITE } from "@/constants/site";

describe("/brand", () => {
  it("covers name, logos, colors, type, and usage", () => {
    const { container } = render(<BrandPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Brand" })).toBeInTheDocument();
    expect(screen.getByText(/written “packs” in lower case/)).toBeInTheDocument();
    for (const asset of BRAND_ASSETS) {
      expect(screen.getByRole("link", { name: `Download ${asset.label}` })).toHaveAttribute(
        "href",
        `/${asset.href}`,
      );
    }
    for (const color of BRAND_COLORS) {
      expect(screen.getByText(color.hex)).toBeInTheDocument();
    }
    expect(screen.getByText(/Nunito/)).toBeInTheDocument();
    expect(screen.getByText(SITE.trademarkNotice)).toBeInTheDocument();
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(ld?.textContent ?? "{}")).toMatchObject({
      "@type": "Organization",
      url: SITE.url,
      email: SITE.contactEmail,
    });
  });

  it("links the contact email", () => {
    render(<BrandPage />);
    expect(screen.getByRole("link", { name: "contact@haruhime.moe" })).toHaveAttribute(
      "href",
      "mailto:contact@haruhime.moe",
    );
  });
});
