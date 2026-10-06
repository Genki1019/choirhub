import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("情宣に行った回数")).toHaveValue(2);
  });

  it("初期値から変更していない場合は保存ボタンが無効", () => {
    render(
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("情宣回数を保存")).toBeDisabled();
  });
});

describe("OutreachCountCard（保存操作）", () => {
  it("回数を変更して保存するとticketsApi.updateAllocationが呼ばれる", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValue({} as never);
    const user = userEvent.setup();
    render(
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={vi.fn()}
      />,
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
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={true}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("情宣回数を増やす")).toBeDisabled();
    expect(screen.getByLabelText("情宣回数を減らす")).toBeDisabled();
    expect(screen.getByText("情宣回数を保存")).toBeDisabled();
  });
});

describe("OutreachCountCard（保存の失敗）", () => {
  it("保存に失敗したらエラーを表示し、「保存しました」は出さない", async () => {
    vi.mocked(ticketsApi.updateAllocation).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("情宣回数を増やす"));
    await user.click(screen.getByText("情宣回数を保存"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "情宣回数の保存に失敗しました。もう一度お試しください。",
    );
    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
    expect(screen.getByLabelText("情宣に行った回数")).toHaveValue(3);
  });
});

describe("OutreachCountCard（保存後の反映）", () => {
  it("保存に成功したら新しい回数を親に渡し、失敗したら渡さない", async () => {
    const onSaved = vi.fn();
    vi.mocked(ticketsApi.updateAllocation).mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    render(
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={onSaved}
      />,
    );

    await user.click(screen.getByLabelText("情宣回数を増やす"));
    await user.click(screen.getByText("情宣回数を保存"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(3));

    vi.mocked(ticketsApi.updateAllocation).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await user.click(screen.getByLabelText("情宣回数を増やす"));
    await user.click(screen.getByRole("button", { name: /情宣回数を保存|保存しました/ }));
    await screen.findByRole("alert");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});

describe("OutreachCountCard（配色）", () => {
  it("入力のフォーカス枠と保存ボタンはブランドカラーを使う", () => {
    render(
      <OutreachCountCard
        orgSlug="o"
        allocationId="alloc-1"
        initialCount={2}
        isClosed={false}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("情宣に行った回数")).toHaveClass("focus:ring-brand-400");
    expect(screen.getByRole("button", { name: "情宣回数を保存" })).toHaveClass("bg-brand-600");
  });
});
