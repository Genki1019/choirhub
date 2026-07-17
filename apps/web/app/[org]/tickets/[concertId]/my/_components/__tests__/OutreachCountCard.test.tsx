import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutreachCountCard } from "../OutreachCountCard";
import { ticketsApi } from "@/lib/tickets-api";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      updateAllocation: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OutreachCountCard（表示）", () => {
  it("初期回数を表示する", () => {
    render(
      <OutreachCountCard orgSlug="o" allocationId="alloc-1" initialCount={2} isClosed={false} />,
    );

    expect(screen.getByLabelText("情宣に行った回数")).toHaveValue(2);
  });

  it("初期値から変更していない場合は保存ボタンが無効", () => {
    render(
      <OutreachCountCard orgSlug="o" allocationId="alloc-1" initialCount={2} isClosed={false} />,
    );

    expect(screen.getByText("情宣回数を保存")).toBeDisabled();
  });
});

describe("OutreachCountCard（保存操作）", () => {
  it("回数を変更して保存するとticketsApi.updateAllocationが呼ばれる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue({} as never);
    const user = userEvent.setup();
    render(
      <OutreachCountCard orgSlug="o" allocationId="alloc-1" initialCount={2} isClosed={false} />,
    );

    await user.click(screen.getByLabelText("情宣回数を増やす"));
    await user.click(screen.getByText("情宣回数を保存"));

    expect(ticketsApi.updateAllocation).toHaveBeenCalledWith("o", "alloc-1", {
      outreachCount: 3,
    });
    expect(await screen.findByText("保存しました")).toBeInTheDocument();
  });

  it("isClosed: trueの場合は操作ボタンが無効", () => {
    render(
      <OutreachCountCard orgSlug="o" allocationId="alloc-1" initialCount={2} isClosed={true} />,
    );

    expect(screen.getByLabelText("情宣回数を増やす")).toBeDisabled();
    expect(screen.getByLabelText("情宣回数を減らす")).toBeDisabled();
    expect(screen.getByText("情宣回数を保存")).toBeDisabled();
  });
});
