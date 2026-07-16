import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TargetAudienceSection } from "../TargetAudienceSection";
import { ROLE_OPTIONS } from "@/lib/roles";
import type { PartSummary } from "@/lib/members-api";

const parts: PartSummary[] = [
  { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
  { id: "part-2", name: "Bass", voiceType: "bass", sortOrder: 2 },
];

describe("TargetAudienceSection（表示）", () => {
  it("lib/roles.tsのROLE_OPTIONSと同じ全ロールのチップを表示する", () => {
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={[]}
        targetPartIds={[]}
        onRolesChange={vi.fn()}
        onPartIdsChange={vi.fn()}
      />,
    );
    expect(ROLE_OPTIONS.length).toBe(9);
    for (const { label } of ROLE_OPTIONS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("partsが空の場合: 「パートが登録されていません」を表示する", () => {
    render(
      <TargetAudienceSection
        parts={[]}
        targetRoles={[]}
        targetPartIds={[]}
        onRolesChange={vi.fn()}
        onPartIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("パートが登録されていません")).toBeInTheDocument();
  });

  it("未選択の場合: 「対象:」の要約テキストを表示しない", () => {
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={[]}
        targetPartIds={[]}
        onRolesChange={vi.fn()}
        onPartIdsChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("対象:")).not.toBeInTheDocument();
  });

  it("選択済みの場合: 「対象:」の要約テキストを表示する", () => {
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={["tech"]}
        targetPartIds={["part-1"]}
        onRolesChange={vi.fn()}
        onPartIdsChange={vi.fn()}
      />,
    );
    expect(screen.getByText("対象:")).toBeInTheDocument();
    expect(screen.getByText("役職（技術系） AND パート（Tenor I）")).toBeInTheDocument();
  });
});

describe("TargetAudienceSection（操作）", () => {
  it("ロールチップをクリックするとonRolesChangeが呼ばれる", async () => {
    const onRolesChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={[]}
        targetPartIds={[]}
        onRolesChange={onRolesChange}
        onPartIdsChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("技術系"));
    expect(onRolesChange).toHaveBeenCalledWith(["tech"]);
  });

  it("選択済みロールチップをクリックすると解除される", async () => {
    const onRolesChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={["tech"]}
        targetPartIds={[]}
        onRolesChange={onRolesChange}
        onPartIdsChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("技術系"));
    expect(onRolesChange).toHaveBeenCalledWith([]);
  });

  it("パートチップをクリックするとonPartIdsChangeが呼ばれる", async () => {
    const onPartIdsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={[]}
        targetPartIds={[]}
        onRolesChange={vi.fn()}
        onPartIdsChange={onPartIdsChange}
      />,
    );
    await user.click(screen.getByText("Tenor I"));
    expect(onPartIdsChange).toHaveBeenCalledWith(["part-1"]);
  });

  it("「クリア」クリックでonRolesChange([])・onPartIdsChange([])が両方呼ばれる", async () => {
    const onRolesChange = vi.fn();
    const onPartIdsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TargetAudienceSection
        parts={parts}
        targetRoles={["tech"]}
        targetPartIds={["part-1"]}
        onRolesChange={onRolesChange}
        onPartIdsChange={onPartIdsChange}
      />,
    );
    await user.click(screen.getByText("クリア"));
    expect(onRolesChange).toHaveBeenCalledWith([]);
    expect(onPartIdsChange).toHaveBeenCalledWith([]);
  });
});
