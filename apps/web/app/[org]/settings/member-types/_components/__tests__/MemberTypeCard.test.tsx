import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberTypeCard } from "../MemberTypeCard";
import { settingsApi, type MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";

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
      onToast={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
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
        onToast={vi.fn()}
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
    await user.click(screen.getByLabelText("保存"));

    expect(settingsApi.updateMemberType).toHaveBeenCalledWith("o", "type-1", {
      name: "社会人",
      defaultFeeAmount: 3500,
    });
  });

  it("🗑️で削除し409エラー時はAPIのメッセージをトーストする", async () => {
    vi.mocked(settingsApi.deleteMemberType).mockRejectedValue(
      new ApiClientError("CONFLICT", "団員が使用中です", 409),
    );
    const onToast = vi.fn();
    const user = userEvent.setup();
    renderCard(true, { onToast });

    await user.click(screen.getByLabelText("社会人を削除"));
    expect(onToast).toHaveBeenCalledWith("団員が使用中です");
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
  it("追加ボタン・編集・削除ボタンを一切表示しない", () => {
    renderCard(false);

    expect(screen.queryByText("追加")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("社会人を編集")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("社会人を削除")).not.toBeInTheDocument();
    expect(screen.getByText("社会人")).toBeInTheDocument();
  });
});
