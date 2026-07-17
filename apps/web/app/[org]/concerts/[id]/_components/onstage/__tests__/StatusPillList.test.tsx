import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPillList } from "../StatusPillList";
import type { AssignmentDetail } from "@/lib/concerts-api";
import type { PartColor } from "../types";

function makeAssignment(overrides: Partial<AssignmentDetail> = {}): AssignmentDetail {
  return {
    memberId: "m1",
    nameJa: "山田太郎",
    partId: "p1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    stageId: "stage-1",
    status: "off",
    ...overrides,
  };
}

describe("StatusPillList", () => {
  it("0件の場合は何も表示しない", () => {
    const { container } = render(
      <StatusPillList title="オフステ" members={[]} partColorMap={new Map<string, PartColor>()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("タイトル・人数・メンバーチップを表示する", () => {
    render(
      <StatusPillList
        title="オフステ"
        members={[makeAssignment(), makeAssignment({ memberId: "m2", nameJa: "鈴木花子" })]}
        partColorMap={new Map<string, PartColor>()}
      />,
    );

    expect(screen.getByText("オフステ")).toBeInTheDocument();
    expect(screen.getByText("2名")).toBeInTheDocument();
    expect(screen.getByTitle("山田太郎")).toBeInTheDocument();
    expect(screen.getByTitle("鈴木花子")).toBeInTheDocument();
  });
});
