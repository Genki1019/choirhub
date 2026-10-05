import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddStageModal } from "../AddStageModal";
import { concertsApi } from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      addStage: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AddStageModal", () => {
  it("ステージ名の初期値は「第N+1ステージ」になる", () => {
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={2}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("第3ステージ")).toBeInTheDocument();
  });

  it("ステージ名が空の場合はエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.clear(screen.getByDisplayValue("第1ステージ"));
    await user.click(screen.getByText("追加する"));

    expect(await screen.findByRole("alert")).toHaveTextContent("ステージ名を入力してください");
    expect(concertsApi.addStage).not.toHaveBeenCalled();
  });

  it("送信成功でconcertsApi.addStageが呼ばれonCreatedが呼ばれる", async () => {
    vi.mocked(concertsApi.addStage).mockResolvedValue({
      id: "stage-new",
      name: "第1ステージ",
      sortOrder: 0,
      programs: [],
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.click(screen.getByText("追加する"));

    expect(concertsApi.addStage).toHaveBeenCalledWith("o", "concert-1", { name: "第1ステージ" });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "stage-new" }));
  });

  it("4xxの送信失敗時はサーバーのメッセージを表示する", async () => {
    vi.mocked(concertsApi.addStage).mockRejectedValue(
      new ApiClientError("NOT_FOUND", "演奏会が見つかりません", 404),
    );
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("追加する"));
    expect(await screen.findByRole("alert")).toHaveTextContent("演奏会が見つかりません");
  });

  it("通信エラー時は代わりの文言を表示する", async () => {
    vi.mocked(concertsApi.addStage).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("追加する"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ステージの追加に失敗しました。もう一度お試しください。",
    );
  });

  it("閉じるボタン・キャンセルボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("「ステージを追加」という名前のダイアログとして開き、ステージ名欄にフォーカスが当たる", () => {
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "ステージを追加" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByLabelText(/ステージ名/)).toHaveFocus();
  });

  it("ステージ名欄でEnterを押すと送信する", async () => {
    vi.mocked(concertsApi.addStage).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/ステージ名/), "{Enter}");

    await waitFor(() => expect(concertsApi.addStage).toHaveBeenCalledTimes(1));
  });

  it("保存中はEscで閉じず、×・キャンセルも押せない", async () => {
    vi.mocked(concertsApi.addStage).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("追加する"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("閉じる")).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });

  it("フッターはキャンセル → 追加するの順に並ぶ", () => {
    render(
      <AddStageModal
        orgSlug="o"
        concertId="concert-1"
        stageCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: /キャンセル|追加する/ });
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["キャンセル", "追加する"]);
  });
});
