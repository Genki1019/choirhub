import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationRowComponent } from "../AllocationRow";
import { ticketsApi, type AllocationRow } from "@/lib/tickets-api";

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
    <AllocationRowComponent
      row={makeRow()}
      canEdit={true}
      canEditAllocation={true}
      isAdmin={true}
      orgSlug="o"
      onUpdated={vi.fn()}
      {...overrides}
    />,
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

  it("requestedCountがallocatedCountと異なる場合は申請バッジを表示する", () => {
    renderRow({ row: makeRow({ requestedCount: 15 }) });
    expect(screen.getByText("申請15")).toBeInTheDocument();
  });

  it("canEdit: falseの場合は販売状況の編集ボタンを表示しない", () => {
    renderRow({ canEdit: false });
    expect(screen.queryByLabelText("山田太郎の販売状況を編集")).not.toBeInTheDocument();
  });

  it("canEditAllocation: falseの場合は配布数の編集ボタンを表示しない", () => {
    renderRow({ canEditAllocation: false });
    expect(screen.queryByLabelText("山田太郎の配布数を編集")).not.toBeInTheDocument();
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
    await user.click(screen.getByLabelText("配布数を保存"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      allocatedCount: 12,
    });
    expect(onUpdated).toHaveBeenCalledWith({ allocatedCount: 12, requestedCount: null });
  });

  it("配布数編集のキャンセルで元の値に戻る", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByLabelText("山田太郎の配布数を編集"));
    await user.click(screen.getByLabelText("配布数の編集をキャンセル"));

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
    await user.click(screen.getByText("保存"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      soldAdult: 6,
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
    await user.click(screen.getByLabelText("編集をキャンセル"));

    expect(screen.queryByText("保存")).not.toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("isAdmin: falseの場合は編集中でも集金チェックボックスを表示しない", async () => {
    const user = userEvent.setup();
    renderRow({ isAdmin: false });

    await user.click(screen.getByLabelText("山田太郎の販売状況を編集"));
    expect(screen.queryByLabelText("山田太郎の集金済み")).not.toBeInTheDocument();
  });

  it("isAdmin: trueの場合は編集中に集金チェックボックスを操作できる", async () => {
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
