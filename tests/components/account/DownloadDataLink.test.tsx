/**
 * @file tests/components/account/DownloadDataLink.test.tsx
 * @desc "Download my data" is a plain download link to the export route, styled as a button.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ACCOUNT_EXPORT_PATH, DownloadDataLink } from "@/components/account/DownloadDataLink";

describe("DownloadDataLink", () => {
  it("downloads the export with a normal browser download", () => {
    render(<DownloadDataLink />);
    const link = screen.getByRole("link", { name: "Download my data" });
    expect(ACCOUNT_EXPORT_PATH).toBe("/api/me/export");
    expect(link).toHaveAttribute("href", "/api/me/export");
    expect(link).toHaveAttribute("download");
  });
});
