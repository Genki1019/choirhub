import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CreatorLine, formatCreators } from "../CreatorLine";

describe("formatCreators", () => {
  it.each([
    ["作曲者", "編曲者", "作曲者 作曲 / 編曲者 編曲"],
    ["作曲者", null, "作曲者 作曲"],
    [null, "編曲者", "編曲者 編曲"],
    [null, null, null],
  ])("作曲者=%s・編曲者=%s のとき %s を返す", (composer, arranger, expected) => {
    expect(formatCreators(composer, arranger)).toBe(expected);
  });
});

describe("CreatorLine", () => {
  it("作曲者も編曲者もなければ何も表示しない", () => {
    const { container } = render(<CreatorLine composer={null} arranger={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
