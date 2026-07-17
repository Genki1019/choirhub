import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddBoxPopover, AddMemberPopover } from "../Popovers";
import type { AssignmentDetail } from "@/lib/concerts-api";

describe("AddBoxPopover", () => {
  it("入力してEnterキーでonCreateBoxが呼ばれる", async () => {
    const onCreateBox = vi.fn();
    const user = userEvent.setup();
    render(<AddBoxPopover onCreateBox={onCreateBox} />);

    await user.type(screen.getByPlaceholderText("枠の名前"), "ソロ{Enter}");
    expect(onCreateBox).toHaveBeenCalledWith("ソロ");
  });

  it("入力してボタンクリックでもonCreateBoxが呼ばれる", async () => {
    const onCreateBox = vi.fn();
    const user = userEvent.setup();
    render(<AddBoxPopover onCreateBox={onCreateBox} />);

    await user.type(screen.getByPlaceholderText("枠の名前"), "ソロ");
    await user.click(screen.getByText("作成"));
    expect(onCreateBox).toHaveBeenCalledWith("ソロ");
  });

  it("空文字の場合はonCreateBoxが呼ばれない", async () => {
    const onCreateBox = vi.fn();
    const user = userEvent.setup();
    render(<AddBoxPopover onCreateBox={onCreateBox} />);

    await user.click(screen.getByText("作成"));
    expect(onCreateBox).not.toHaveBeenCalled();
  });
});

const boxes = [
  { key: "box-c", title: "指揮" },
  { key: "box-p", title: "ピアノ" },
];

function makeMember(overrides: Partial<AssignmentDetail> = {}): AssignmentDetail {
  return {
    memberId: "m1",
    nameJa: "山田太郎",
    partId: "p1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    stageId: "stage-1",
    status: "on",
    ...overrides,
  };
}

describe("AddMemberPopover（団員モード）", () => {
  it("検索語で絞り込み、選択でonPlaceMemberが選択中の枠付きで呼ばれる", async () => {
    const onPlaceMember = vi.fn();
    const user = userEvent.setup();
    render(
      <AddMemberPopover
        boxes={boxes}
        onConfirmedMembers={[makeMember(), makeMember({ memberId: "m2", nameJa: "鈴木花子" })]}
        getExistingMemberIds={() => new Set()}
        onPlaceMember={onPlaceMember}
        onPlaceGuest={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("団員名で検索"), "山田");
    expect(screen.queryByText("鈴木花子")).not.toBeInTheDocument();

    await user.click(screen.getByText("山田太郎"));
    expect(onPlaceMember).toHaveBeenCalledWith(
      "box-c",
      expect.objectContaining({ memberId: "m1" }),
    );
  });

  it("既に配置済みのメンバーは候補から除外される", () => {
    render(
      <AddMemberPopover
        boxes={boxes}
        onConfirmedMembers={[makeMember()]}
        getExistingMemberIds={() => new Set(["m1"])}
        onPlaceMember={vi.fn()}
        onPlaceGuest={vi.fn()}
      />,
    );

    expect(screen.getByText("該当するメンバーがいません")).toBeInTheDocument();
  });

  it("枠を切り替えるとgetExistingMemberIdsが新しい枠キーで呼ばれる", async () => {
    const getExistingMemberIds = vi.fn().mockReturnValue(new Set());
    const user = userEvent.setup();
    render(
      <AddMemberPopover
        boxes={boxes}
        onConfirmedMembers={[makeMember()]}
        getExistingMemberIds={getExistingMemberIds}
        onPlaceMember={vi.fn()}
        onPlaceGuest={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByDisplayValue("指揮"), "box-p");
    expect(getExistingMemberIds).toHaveBeenCalledWith("box-p");
  });
});

describe("AddMemberPopover（客演モード）", () => {
  it("客演タブに切り替えて名前を入力し追加するとonPlaceGuestが呼ばれる", async () => {
    const onPlaceGuest = vi.fn();
    const user = userEvent.setup();
    render(
      <AddMemberPopover
        boxes={boxes}
        onConfirmedMembers={[]}
        getExistingMemberIds={() => new Set()}
        onPlaceMember={vi.fn()}
        onPlaceGuest={onPlaceGuest}
      />,
    );

    await user.click(screen.getByText("客演"));
    await user.type(screen.getByPlaceholderText("客演者の名前"), "客演太郎{Enter}");

    expect(onPlaceGuest).toHaveBeenCalledWith("box-c", "客演太郎");
  });
});
