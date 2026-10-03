import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("条件付きのクラスを結合し、偽値は除外する", () => {
    expect(cn("px-3", false && "hidden", undefined, "text-sm")).toBe("px-3 text-sm");
  });

  it("競合するTailwindクラスは後勝ちにする", () => {
    expect(cn("px-3 py-2", "px-6")).toBe("py-2 px-6");
    expect(cn("bg-red-50", "bg-brand-600")).toBe("bg-brand-600");
  });
});
