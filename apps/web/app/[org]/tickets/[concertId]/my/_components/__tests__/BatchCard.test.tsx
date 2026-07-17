import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchCard } from "../BatchCard";
import { ticketsApi, type MyAllocationBatch } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      allocate: vi.fn(),
      updateAllocation: vi.fn(),
    },
  };
});

function makeBatch(overrides: Partial<MyAllocationBatch> = {}): MyAllocationBatch {
  return {
    allocationId: "alloc-1",
    batchId: "batch-1",
    batchName: "一般",
    price: 2000,
    priceStudent: 1000,
    allocatedCount: 10,
    requestedCount: null,
    soldAdult: 6,
    soldStudent: 0,
    soldOther: 0,
    returnedCount: 0,
    outreachCount: 0,
    reportedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("BatchCard（表示）", () => {
  it("券種名・単価・預かり枚数・販売済み・手元残を表示する", () => {
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("一般")).toBeInTheDocument();
    expect(screen.getByText(/一般¥2,000/)).toBeInTheDocument();
    expect(screen.getAllByText("10枚").length).toBeGreaterThan(0); // 預かり／現在の配布枚数
    expect(screen.getByText("6枚")).toBeInTheDocument();
    expect(screen.getByText("4枚")).toBeInTheDocument(); // 手元残 10-6-0
  });

  it("requestedCountがallocatedCountと異なる場合は申請中バッジを表示する", () => {
    render(
      <BatchCard
        batch={makeBatch({ requestedCount: 15 })}
        orgSlug="o"
        concertId="concert-1"
        isClosed={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/申請中: 15枚/)).toBeInTheDocument();
  });
});

describe("BatchCard（希望枚数の変更申請）", () => {
  it("枚数を変更していない場合は申請ボタンが無効", () => {
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("変更を申請する")).toBeDisabled();
  });

  it("希望枚数を増やして申請するとticketsApi.allocateが呼ばれonChangeが呼ばれる", async () => {
    vi.mocked(ticketsApi.allocate).mockResolvedValue({
      id: "alloc-1",
      batchId: "batch-1",
      memberId: "member-1",
      allocatedCount: 10,
      requestedCount: 11,
    });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={false}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("希望枚数を増やす"));
    await user.click(screen.getByText("変更を申請する"));

    expect(ticketsApi.allocate).toHaveBeenCalledWith("o", "concert-1", {
      batchId: "batch-1",
      allocatedCount: 11,
    });
    expect(onChange).toHaveBeenCalledWith({ requestedCount: 11 });
  });

  it("isClosed: trueの場合は希望枚数の操作ボタンが無効", () => {
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={true}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("希望枚数を増やす")).toBeDisabled();
    expect(screen.getByText("変更を申請する")).toBeDisabled();
  });
});

describe("BatchCard（販売状況の報告）", () => {
  it("Stepperで枚数を変更し確定するとticketsApi.updateAllocationが呼ばれる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue(makeBatch() as never);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={false}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("大人を増やす"));
    await user.click(screen.getByText("販売状況を確定"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      soldAdult: 7,
      soldStudent: 0,
      returnedCount: 0,
      soldOther: 0,
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ soldAdult: 7, soldOther: 0 }));
  });

  it("isClosed: trueの場合は販売状況の確定ボタンが無効", () => {
    render(
      <BatchCard
        batch={makeBatch()}
        orgSlug="o"
        concertId="concert-1"
        isClosed={true}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("大人を増やす")).toBeDisabled();
    expect(screen.getByText("販売状況を確定")).toBeDisabled();
  });
});
