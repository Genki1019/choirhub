import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionModal } from "../CollectionModal";
import { accountingApi } from "@/lib/accounting-api";
import { ApiClientError } from "@/lib/api-client";
import type { MemberType } from "@/lib/settings-api";

vi.mock("@/lib/accounting-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/accounting-api")>("@/lib/accounting-api");
  return {
    ...actual,
    accountingApi: {
      createCollection: vi.fn(),
    },
  };
});

function makeMemberTypes(): MemberType[] {
  return [
    { id: "type-1", name: "社会人", defaultFeeAmount: 3000, sortOrder: 1 },
    { id: "type-2", name: "学生", defaultFeeAmount: 1500, sortOrder: 2 },
  ];
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CollectionModal（全員共通モード）", () => {
  it("金額が0以下の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "合宿費");
    // 金額欄はrequiredのHTML5制約でクリック送信がブロックされるため、submitイベントを直接発火してJS側のバリデーションを検証する
    fireEvent.submit(document.querySelector("form")!);

    expect(await screen.findByText("金額を正の整数で入力してください")).toBeInTheDocument();
  });

  it("入力して作成するとcreateCollectionが呼ばれる（区分ごとの金額は送信しない）", async () => {
    vi.mocked(accountingApi.createCollection).mockResolvedValue({
      id: "col-new",
      title: "合宿費",
      amount: 15000,
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <CollectionModal
        org="o"
        memberTypes={makeMemberTypes()}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "合宿費");
    await user.type(screen.getByPlaceholderText("3000"), "15000");
    await user.click(screen.getByText("作成する"));

    expect(accountingApi.createCollection).toHaveBeenCalledWith("o", {
      title: "合宿費",
      amount: 15000,
      yearMonth: null,
      note: null,
      scoreId: null,
      memberTypeAmounts: undefined,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("対象年月を入力すると送信データに含まれる", async () => {
    vi.mocked(accountingApi.createCollection).mockResolvedValue({
      id: "col-new",
      title: "合宿費",
      amount: 15000,
    });
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "合宿費");
    await user.type(screen.getByPlaceholderText("3000"), "15000");
    const monthInput = screen.getByLabelText("対象年月（任意）");
    await user.type(monthInput, "2026-07");
    await user.click(screen.getByText("作成する"));

    expect(accountingApi.createCollection).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ yearMonth: "2026-07" }),
    );
  });

  it("作成に失敗した場合はエラーメッセージを表示する", async () => {
    vi.mocked(accountingApi.createCollection).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "合宿費");
    await user.type(screen.getByPlaceholderText("3000"), "15000");
    await user.click(screen.getByText("作成する"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "徴収の作成に失敗しました。もう一度お試しください。",
    );
  });

  it("キャンセル・×ボタンでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("CollectionModal（区分ごとに指定モード）", () => {
  it("切り替えるとメンバー区分ごとの金額欄と区分未設定欄が表示される", async () => {
    const user = userEvent.setup();
    render(
      <CollectionModal
        org="o"
        memberTypes={makeMemberTypes()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("区分ごとに指定"));

    expect(screen.getByText("社会人")).toBeInTheDocument();
    expect(screen.getByText("学生")).toBeInTheDocument();
    expect(screen.getByText("区分未設定")).toBeInTheDocument();
  });

  it("区分の金額が未入力の場合は区分名を含むエラーを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CollectionModal
        org="o"
        memberTypes={makeMemberTypes()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "合宿費");
    await user.click(screen.getByLabelText("区分ごとに指定"));
    await user.clear(screen.getByLabelText("社会人の金額"));
    await user.type(screen.getByLabelText("区分未設定の金額"), "3000");
    // 空欄の金額欄がrequiredのHTML5制約でクリック送信をブロックするため、submitイベントを直接発火する
    fireEvent.submit(document.querySelector("form")!);

    expect(
      await screen.findByText("「社会人」の金額を正の整数で入力してください"),
    ).toBeInTheDocument();
  });

  it("区分ごとに金額を入力して作成するとmemberTypeAmountsが送信される", async () => {
    vi.mocked(accountingApi.createCollection).mockResolvedValue({
      id: "col-new",
      title: "月会費",
      amount: 1000,
    });
    const user = userEvent.setup();
    render(
      <CollectionModal
        org="o"
        memberTypes={makeMemberTypes()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 7月合宿費"), "月会費");
    await user.click(screen.getByLabelText("区分ごとに指定"));
    await user.type(screen.getByLabelText("区分未設定の金額"), "1000");
    await user.click(screen.getByText("作成する"));

    expect(accountingApi.createCollection).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        memberTypeAmounts: { "type-1": 3000, "type-2": 1500 },
        amount: 1000,
      }),
    );
  });
});

describe("CollectionModal（共通モーダル）", () => {
  it("見出しを名前に持つダイアログで開き、件名欄にフォーカスが入る", () => {
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "徴収を作成" })).toBeInTheDocument();
    expect(screen.getByLabelText("件名")).toHaveFocus();
  });

  it("金額設定はグループとして読み上げられ、全員共通の金額欄に名前がある", () => {
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("group", { name: "金額設定" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "金額（円）" })).toBeInTheDocument();
  });

  it("Esc で閉じ、作成中は閉じない", async () => {
    vi.mocked(accountingApi.createCollection).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={onClose} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("件名"), "合宿費");
    await user.type(screen.getByRole("spinbutton", { name: "金額（円）" }), "3000{Enter}");
    await user.keyboard("{Escape}");
    expect(accountingApi.createCollection).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("4xx の失敗は API の理由を出す", async () => {
    vi.mocked(accountingApi.createCollection).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "会計以上の権限が必要です", 403),
    );
    const user = userEvent.setup();
    render(<CollectionModal org="o" memberTypes={[]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("件名"), "合宿費");
    await user.type(screen.getByRole("spinbutton", { name: "金額（円）" }), "3000{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("会計以上の権限が必要です");
  });
});
