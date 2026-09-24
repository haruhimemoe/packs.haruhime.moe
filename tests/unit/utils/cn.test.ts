/**
 * @file tests/unit/utils/cn.test.ts
 * @desc Unit tests for the cn() class-name combiner.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { cn } from "@/utils/cn";

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false, undefined, null, "c")).toBe("a c");
  });

  it("lets a later conflicting Tailwind utility win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("treats osu! palette tokens as conflicting colors", () => {
    expect(cn("bg-b1", "bg-b2")).toBe("bg-b2");
    expect(cn("text-c1", "text-c3")).toBe("text-c3");
  });

  it("keeps a text color and a text size together", () => {
    expect(cn("text-c1", "text-sm")).toBe("text-c1 text-sm");
  });
});
