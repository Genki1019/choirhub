import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationRowComponent } from "../AllocationRow";
import { ticketsApi, type AllocationRow } from "@/lib/tickets-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      updateAllocation: vi.fn(),
    },
  };
});

function makeRow(overrides: Partial<AllocationRow> = {}): AllocationRow {
  return {
    id: "alloc-1",
    batchId: "batch-1",
    memberId: "member-1",
    requestedCount: null,
    nameJa: "山田太郎",
    partId: "part-1",
    partName: "テノール1",
    partSortOrder: 1,
    partVoiceType: "tenor1",
    allocatedCount: 10,
    soldAdult: 6,
    soldStudent: 1,
    soldOther: 0,
    returnedCount: 3,
    outreachCount: 0,
    isOutreachExpensePaid: false,
    outreachExpensePaidAt: null,
    isCollected: true,
    reportedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

function renderRow(overrides: Partial<Parameters<typeof AllocationRowComponent>[0]> = {}) {
  return render(
    <AllocationRowComponent row={makeRow()} orgSlug="o" onUpdated={vi.fn()} {...overrides} />,
  );
}

describe("AllocationRowComponent（表示）", () => {
  it("名前・パート・配布数・残数・集金状況を表示する", () => {
    renderRow();

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("テノール1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("残数がマイナスの場合は赤字表示になる", () => {
    renderRow({ row: makeRow({ allocatedCount: 5 }) }); // 5-7-3=-5
    expect(screen.getByText("-5")).toHaveClass("text-red-500");
  });

  it("配布数の編集ボタンは、マウスを乗せなくても常に見える", () => {
    renderRow();
    expect(screen.getByLabelText("山田太郎の配布数を編集")).not.toHaveClass("opacity-0");
  });

  it("requestedCountがallocatedCountと異なる場合は申請バッジを表示する", () => {
    renderRow({ row: makeRow({ requestedCount: 15 }) });
    expect(screen.getByText("申請15")).toBeInTheDocument();
  });
});

describe("AllocationRowComponent（配布数の単独編集）", () => {
  it("編集ボタンクリックで入力欄に切り替わり、保存でallocatedCountのみ更新される", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderRow({ onUpdated });

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    const input = screen.getByLabelText("山田太郎の配布数");
    await user.clear(input);
    await user.type(input, "12");
    await user.click(screen.getByLabelText(/の配布数を保存$/));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      allocatedCount: 12,
    });
    expect(onUpdated).toHaveBeenCalledWith({ allocatedCount: 12, requestedCount: null });
  });

  it("配布数編集のキャンセルで元の値に戻る", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.click(screen.getByLabelText(/の配布数の編集をキャンセル$/));

    expect(screen.queryByLabelText("山田太郎の配布数")).not.toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });
});

describe("AllocationRowComponent（販売状況の編集）", () => {
  it("編集ボタンクリックで入力欄に切り替わり保存でupdateAllocationが呼ばれる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderRow({ onUpdated });

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の大人販売数"));
    await user.type(screen.getByLabelText("山田太郎の大人販売数"), "7");
    await user.click(screen.getByRole("button", { name: "山田太郎の販売状況を保存" }));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      soldAdult: 7,
      soldStudent: 1,
      soldOther: 0,
      returnedCount: 3,
      isCollected: true,
    });
    expect(onUpdated).toHaveBeenCalled();
  });

  it("入力値を変更してキャンセルすると編集前の状態に戻る", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    const adultInput = screen.getByLabelText("山田太郎の大人販売数");
    await user.clear(adultInput);
    await user.type(adultInput, "99");
    await user.click(screen.getByLabelText(/の販売状況の編集をキャンセル$/));

    expect(screen.queryByText("保存")).not.toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("編集中に集金チェックボックスを操作できる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderRow({ onUpdated, row: makeRow({ isCollected: false }) });

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.click(screen.getByLabelText("山田太郎の集金済み"));
    await user.click(screen.getByText("保存"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith(
      "o",
      "alloc-1",
      expect.objectContaining({ isCollected: true }),
    );
  });
});

describe("AllocationRowComponent（保存の失敗）", () => {
  it("販売状況の保存に失敗したらエラーを表示し、編集中の入力を残す", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockRejectedValue(new TypeError("Failed to fetch"));
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderRow({ onUpdated });

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の大人販売数"));
    await user.type(screen.getByLabelText("山田太郎の大人販売数"), "7");
    await user.click(screen.getByText("保存"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "販売状況の保存に失敗しました。もう一度お試しください。",
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  it("配布数の保存に失敗したらサーバーの理由を表示する", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "配布枚数の変更はチケット担当者のみ可能です", 403),
    );
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.type(screen.getByLabelText("山田太郎の配布数"), "1");
    await user.click(screen.getByLabelText(/の配布数を保存$/));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "配布枚数の変更はチケット担当者のみ可能です",
    );
    expect(screen.getByLabelText("山田太郎の配布数")).toBeInTheDocument();
  });
});

describe("AllocationRowComponent（共通の編集の標準）", () => {
  it("値を変えずに保存すると、API を呼ばずに閉じる", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.keyboard("{Enter}");
    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.keyboard("{Enter}");

    expect(ticketsApi.updateAllocation).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("山田太郎の配布数")).not.toBeInTheDocument();
    expect(screen.queryByText("保存")).not.toBeInTheDocument();
  });

  it("販売状況の入力欄で Enter を押すと保存し、Esc で取り消して鉛筆にフォーカスを戻す", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.type(screen.getByLabelText("山田太郎の返却数"), "{Escape}");
    expect(screen.getByLabelText("山田太郎の販売状況を編集")).toHaveFocus();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の返却数"));
    await user.type(screen.getByLabelText("山田太郎の返却数"), "4{Enter}");
    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith(
      "o",
      "alloc-1",
      expect.objectContaining({ returnedCount: 4 }),
    );
  });

  it("配布数にマイナスを入れると理由を出して保存しない", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    fireEvent.change(screen.getByLabelText("山田太郎の配布数"), { target: { value: "-1" } });
    await user.keyboard("{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("配布数は0以上の整数で入力してください");
    expect(ticketsApi.updateAllocation).not.toHaveBeenCalled();
  });

  it.each(["-", "", "1e3", "3枚"])(
    "配布数「%s」は保存せず理由を出し、入力を残す",
    async (input) => {
      const user = userEvent.setup();
      renderRow();

      await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
      await user.clear(screen.getByLabelText("山田太郎の配布数"));
      await user.type(screen.getByLabelText("山田太郎の配布数"), `${input}{Enter}`);

      expect(screen.getByRole("alert")).toHaveTextContent("配布数は0以上の整数で入力してください");
      expect(screen.getByLabelText("山田太郎の配布数")).toHaveValue(input);
      expect(ticketsApi.updateAllocation).not.toHaveBeenCalled();
    },
  );

  it("販売数に整数以外を入れると理由を出して保存しない", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の学生販売数"));
    await user.type(screen.getByLabelText("山田太郎の学生販売数"), "-{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent("枚数は0以上の整数で入力してください");
    expect(ticketsApi.updateAllocation).not.toHaveBeenCalled();
  });

  it("配布数を 010 のように同じ数で書き直しただけなら、保存せずに閉じる", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.clear(screen.getByLabelText("山田太郎の配布数"));
    await user.type(screen.getByLabelText("山田太郎の配布数"), "010{Enter}");

    expect(ticketsApi.updateAllocation).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("山田太郎の配布数")).not.toBeInTheDocument();
  });

  it("数の入力欄は、スマホで数字のキーボードを出す", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));

    for (const label of ["大人販売数", "学生販売数", "他販売数", "返却数"]) {
      expect(screen.getByLabelText(`山田太郎の${label}`)).toHaveAttribute("inputmode", "numeric");
    }
  });
});

describe("AllocationRowComponent（エラーの後始末）", () => {
  it("配布数の編集を取り消すとエラーが消える", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.type(screen.getByLabelText("山田太郎の配布数"), "1");
    await user.click(screen.getByLabelText(/の配布数を保存$/));
    await screen.findByRole("alert");
    await user.click(screen.getByLabelText(/の配布数の編集をキャンセル$/));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("販売状況の保存中は取り消しボタンを押せない", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の大人販売数"));
    await user.type(screen.getByLabelText("山田太郎の大人販売数"), "7");
    await user.click(screen.getByText("保存"));

    expect(screen.getByLabelText(/の販売状況の編集をキャンセル$/)).toBeDisabled();
  });

  it("販売状況のエラーは、配布数の編集を取り消しても消えない", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.clear(screen.getByLabelText("山田太郎の大人販売数"));
    await user.type(screen.getByLabelText("山田太郎の大人販売数"), "7");
    await user.click(screen.getByText("保存"));
    await screen.findByRole("alert");
    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.click(screen.getByLabelText(/の配布数の編集をキャンセル$/));

    expect(screen.getByRole("alert")).toHaveTextContent("販売状況の保存に失敗しました。");
  });
});

describe("AllocationRowComponent（編集の開始）", () => {
  it("取り直しで行の値が新しくなったあとに編集を開くと、新しい値から始まる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeRow());
    const user = userEvent.setup();
    const { rerender } = renderRow();

    rerender(
      <AllocationRowComponent row={makeRow({ soldAdult: 9 })} orgSlug="o" onUpdated={vi.fn()} />,
    );
    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    await user.type(screen.getByLabelText("山田太郎の返却数"), "0");
    await user.click(screen.getByText("保存"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith(
      "o",
      "alloc-1",
      expect.objectContaining({ soldAdult: 9 }),
    );
  });
});
