import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddStageModal } from "../AddStageModal";
import { concertsApi } from "@/lib/concerts-api";

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

    expect(await screen.findByText("ステージ名を入力してください")).toBeInTheDocument();
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

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.addStage).mockRejectedValue(new Error("登録に失敗しました"));
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
    expect(await screen.findByText("登録に失敗しました")).toBeInTheDocument();
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
});
