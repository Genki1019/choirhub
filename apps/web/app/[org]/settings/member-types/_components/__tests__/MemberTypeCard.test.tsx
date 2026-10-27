import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberTypeCard } from "../MemberTypeCard";
import { settingsApi, type MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { dragAndDrop, mockPointerCapture } from "@/test-utils/dnd";

vi.mock("@/lib/settings-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings-api")>("@/lib/settings-api");
  return {
    ...actual,
    settingsApi: {
      createMemberType: vi.fn(),
      updateMemberType: vi.fn(),
      deleteMemberType: vi.fn(),
    },
  };
});

function makeTypes(): MemberType[] {
  return [
    { id: "type-1", name: "社会人", defaultFeeAmount: 3000, sortOrder: 1 },
    { id: "type-2", name: "学生", defaultFeeAmount: null, sortOrder: 2 },
  ];
}

function renderCard(canEdit: boolean, overrides: Partial<Record<string, unknown>> = {}) {
  return render(
    <MemberTypeCard
      types={makeTypes()}
      org="o"
      canEdit={canEdit}
      onUpdated={vi.fn()}
      onDeleted={vi.fn()}
      onCreated={vi.fn()}
      onReordered={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPointerCapture();
});

describe("MemberTypeCard（表示）", () => {
  it("区分名・デフォルト会費を表示する（未設定はハイフン）", () => {
    renderCard(true);
    expect(screen.getByText("社会人")).toBeInTheDocument();
    expect(screen.getByText("¥3,000")).toBeInTheDocument();
    expect(screen.getByText("学生")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("0件の場合は案内メッセージを表示する", () => {
    render(
      <MemberTypeCard
        types={[]}
        org="o"
        canEdit={true}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
        onReordered={vi.fn()}
      />,
    );
    expect(screen.getByText("区分がまだありません")).toBeInTheDocument();
  });
});

describe("MemberTypeCard（canEdit: true）", () => {
  it("✏️で編集し保存でupdateMemberTypeが呼ばれる", async () => {
    vi.mocked(settingsApi.updateMemberType).mockResolvedValue({
      id: "type-1",
      name: "社会人",
      defaultFeeAmount: 3500,
      sortOrder: 1,
    });
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を編集"));
    const amountInput = screen.getByDisplayValue("3000");
    await user.clear(amountInput);
    await user.type(amountInput, "3500");
    await user.click(screen.getByRole("button", { name: "メンバー区分を保存" }));

    expect(settingsApi.updateMemberType).toHaveBeenCalledWith("o", "type-1", {
      name: "社会人",
      defaultFeeAmount: 3500,
    });
  });

  it("会費欄で Enter を押しても保存する。会費を空にすると未設定（null）で送る", async () => {
    vi.mocked(settingsApi.updateMemberType).mockResolvedValue({
      id: "type-1",
      name: "社会人",
      defaultFeeAmount: null,
      sortOrder: 1,
    });
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を編集"));
    await user.clear(screen.getByRole("textbox", { name: "デフォルト会費" }));
    await user.keyboard("{Enter}");

    expect(settingsApi.updateMemberType).toHaveBeenCalledWith("o", "type-1", {
      name: "社会人",
      defaultFeeAmount: null,
    });
  });

  it("会費が整数でなければ（「-」「1e3」など）理由を出して保存しない", async () => {
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を編集"));
    await user.clear(screen.getByRole("textbox", { name: "デフォルト会費" }));
    await user.type(screen.getByRole("textbox", { name: "デフォルト会費" }), "-{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("会費は0以上の整数で入力してください");
    expect(settingsApi.updateMemberType).not.toHaveBeenCalled();
  });

  it("会費を 03000 のように同じ額で書き直しただけなら、保存せずに閉じる", async () => {
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を編集"));
    await user.clear(screen.getByRole("textbox", { name: "デフォルト会費" }));
    await user.type(screen.getByRole("textbox", { name: "デフォルト会費" }), "03000{Enter}");

    expect(settingsApi.updateMemberType).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "デフォルト会費" })).not.toBeInTheDocument();
  });

  it("区分名を空にすると理由を出して保存しない", async () => {
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を編集"));
    await user.clear(screen.getByRole("textbox", { name: "区分名" }));
    await user.click(screen.getByRole("button", { name: "メンバー区分を保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent("区分名を入力してください");
    expect(settingsApi.updateMemberType).not.toHaveBeenCalled();
  });

  it("🗑️で削除し409エラー時はAPIのメッセージを確認ダイアログの中に表示する", async () => {
    vi.mocked(settingsApi.deleteMemberType).mockRejectedValue(
      new ApiClientError("CONFLICT", "3名が使用中のため削除できません", 409),
    );
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByLabelText("社会人を削除"));
    await user.click(
      within(screen.getByRole("alertdialog", { name: "団員種別を削除しますか？" })).getByRole(
        "button",
        {
          name: "削除する",
        },
      ),
    );

    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "3名が使用中のため削除できません",
    );
  });

  it("同じ名前で追加すると、409の理由をカードの中に読み上げ、もう一度追加を始めると消える", async () => {
    vi.mocked(settingsApi.createMemberType)
      .mockRejectedValueOnce(new ApiClientError("CONFLICT", "同じ名前の区分がすでにあります", 409))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("区分名（例: 社会人）"), "客演");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("同じ名前の区分がすでにあります");

    await user.click(addButtons[addButtons.length - 1]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("追加の失敗が5xxなら代わりの文言を出す", async () => {
    vi.mocked(settingsApi.createMemberType).mockRejectedValue(
      new ApiClientError("UNKNOWN", "", 500),
    );
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("区分名（例: 社会人）"), "客演");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メンバー区分の追加に失敗しました。もう一度お試しください。",
    );
  });

  it("「追加」で区分名・会費を入力するとcreateMemberTypeが呼ばれる", async () => {
    vi.mocked(settingsApi.createMemberType).mockResolvedValue({
      id: "type-3",
      name: "客演",
      defaultFeeAmount: 1000,
      sortOrder: 3,
    });
    const user = userEvent.setup();
    renderCard(true);

    await user.click(screen.getByText("追加"));
    await user.type(screen.getByPlaceholderText("区分名（例: 社会人）"), "客演");
    await user.type(screen.getByPlaceholderText("会費（円）"), "1000");
    const addButtons = screen.getAllByRole("button", { name: "追加" });
    await user.click(addButtons[addButtons.length - 1]);

    expect(settingsApi.createMemberType).toHaveBeenCalledWith("o", {
      name: "客演",
      defaultFeeAmount: 1000,
    });
  });
});

describe("MemberTypeCard（canEdit: false）", () => {
  it("追加ボタン・並び替え・編集・削除ボタンを一切表示しない", () => {
    renderCard(false);

    expect(screen.queryByText("追加")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("社会人をドラッグして並び替え")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("社会人を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("社会人を削除")).not.toBeInTheDocument();
    expect(screen.getByText("社会人")).toBeInTheDocument();
  });
});

describe("MemberTypeCard（並び替え）", () => {
  it("ドラッグで並び替えるとupdateMemberTypeが変更された2件だけ呼ばれる", async () => {
    vi.mocked(settingsApi.updateMemberType).mockResolvedValue(makeTypes()[0]);
    renderCard(true);

    dragAndDrop(
      screen.getByLabelText("学生をドラッグして並び替え"),
      screen.getByLabelText("社会人をドラッグして並び替え"),
    );

    expect(settingsApi.updateMemberType).toHaveBeenCalledWith("o", "type-2", { sortOrder: 1 });
    expect(settingsApi.updateMemberType).toHaveBeenCalledWith("o", "type-1", { sortOrder: 2 });
  });

  it("並び替えに失敗したら元の順序にロールバックし、理由を読み上げる", async () => {
    vi.mocked(settingsApi.updateMemberType).mockRejectedValue(new Error("network error"));
    renderCard(true);

    dragAndDrop(
      screen.getByLabelText("学生をドラッグして並び替え"),
      screen.getByLabelText("社会人をドラッグして並び替え"),
    );

    await vi.waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "並び替えに失敗しました。もう一度お試しください。",
      );
    });
  });
});
