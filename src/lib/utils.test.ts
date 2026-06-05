import { describe, expect, it } from "vitest";
import { cn, formatCurrency } from "@/lib/utils";

describe("utils", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-2", "px-4")).toContain("px-4");
  });

  it("formats currency", () => {
    expect(formatCurrency(10)).toContain("10");
  });
});
