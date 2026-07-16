import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPanel } from "../AdminPanel";
import type { MemberProfile, PartSummary } from "@/lib/api-types";
import type { MemberType } from "@/lib/settings-api";

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: "ヤマダタロウ",
    nameEn: null,
    avatarUrl: null,
    part: { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: "2020-04-01",
    phone: null,
    adminMemo: null,
    ...overrides,
  };
}

const parts: PartSummary[] = [
  { id: "part-1", name: "Tenor I", voiceType: "tenor", sortOrder: 1 },
  { id: "part-2", name: "Bass", voiceType: "bass", sortOrder: 2 },
];

const memberTypes: MemberType[] = [
  { id: "type-1", name: "正団員", defaultFeeAmount: 3000, sortOrder: 0 },
  { id: "type-2", name: "OB", defaultFeeAmount: null, sortOrder: 1 },
];

describe("AdminPanel（表示）", () => {
  it("ロール・パート・ステータス・メンバー区分・管理者メモの初期値を表示する", () => {
    render(
      <AdminPanel
        member={makeMember({
          roles: ["member", "tech"],
          part: parts[0],
          status: "active",
          memberType: { id: "type-1", name: "正団員", defaultFeeAmount: 3000 },
          adminMemo: "要注意",
        })}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "技術系" })).toHaveClass("bg-brand-600");
    expect(screen.getByLabelText("パート")).toHaveValue("part-1");
    expect(screen.getByLabelText("ステータス")).toHaveValue("active");
    expect(screen.getByLabelText("メンバー区分")).toHaveValue("type-1");
    expect(screen.getByLabelText("管理者メモ")).toHaveValue("要注意");
  });

  it("メンバー区分にdefaultFeeAmountが無い場合は金額を併記しない", () => {
    render(
      <AdminPanel
        member={makeMember({ memberType: { id: "type-2", name: "OB", defaultFeeAmount: null } })}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("メンバー区分")).toHaveValue("type-2");
    expect(screen.getByText("OB")).toBeInTheDocument();
  });

  it("memberロールのチップは表示されない", () => {
    render(
      <AdminPanel
        member={makeMember()}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "一般" })).not.toBeInTheDocument();
  });
});

describe("AdminPanel（操作）", () => {
  it("ロールチップをクリックすると選択状態が切り替わる", async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember()}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const techChip = screen.getByRole("button", { name: "技術系" });
    expect(techChip).not.toHaveClass("bg-brand-600");

    await user.click(techChip);
    expect(techChip).toHaveClass("bg-brand-600");

    await user.click(techChip);
    expect(techChip).not.toHaveClass("bg-brand-600");
  });

  it("「変更を保存」クリックで、roleにmemberを先頭付与したペイロードでonUpdateが呼ばれる", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember({ roles: ["member"], part: null, memberType: null, adminMemo: null })}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "技術系" }));
    await user.selectOptions(screen.getByLabelText("パート"), "part-1");
    await user.click(screen.getByText("変更を保存"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        roles: ["member", "tech"],
        partId: "part-1",
        memberTypeId: null,
        status: "active",
        phone: null,
        adminMemo: null,
      });
    });
  });

  it("パート・メンバー区分を未設定に戻すとnullで送信される", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember({
          part: parts[0],
          memberType: { id: "type-1", name: "正団員", defaultFeeAmount: 3000 },
        })}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("パート"), "");
    await user.selectOptions(screen.getByLabelText("メンバー区分"), "");
    await user.click(screen.getByText("変更を保存"));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ partId: null, memberTypeId: null }),
      );
    });
  });

  it("保存中は保存・退団処理ボタンが両方disabledになる", async () => {
    let resolveUpdate: () => void;
    const onUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember()}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText("変更を保存"));

    expect(screen.getByText("変更を保存").closest("button")).toBeDisabled();
    expect(screen.getByText("退団処理").closest("button")).toBeDisabled();

    resolveUpdate!();
    await waitFor(() => {
      expect(screen.getByText("変更を保存").closest("button")).toBeEnabled();
    });
  });

  it("「退団処理」クリックでonDeleteが呼ばれる", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember()}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("退団処理"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("退団処理中は保存・退団処理ボタンが両方disabledになる", async () => {
    let resolveDelete: () => void;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <AdminPanel
        member={makeMember()}
        parts={parts}
        memberTypes={memberTypes}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("退団処理"));

    expect(screen.getByText("変更を保存").closest("button")).toBeDisabled();
    expect(screen.getByText("退団処理").closest("button")).toBeDisabled();

    resolveDelete!();
    await waitFor(() => {
      expect(screen.getByText("退団処理").closest("button")).toBeEnabled();
    });
  });
});
