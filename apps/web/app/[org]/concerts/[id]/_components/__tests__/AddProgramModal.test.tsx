import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddProgramModal } from "../AddProgramModal";
import { concertsApi } from "@/lib/concerts-api";
import { scoresApi, type ScoreListItem } from "@/lib/scores-api";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      addProgram: vi.fn(),
    },
  };
});

vi.mock("@/lib/scores-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scores-api")>("@/lib/scores-api");
  return {
    ...actual,
    scoresApi: {
      list: vi.fn(),
    },
  };
});

const scores: ScoreListItem[] = [
  { id: "score-1", title: "男声合唱のための〇〇", composer: "△△", arranger: null },
  { id: "score-2", title: "□□の詩", composer: "◇◇", arranger: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(scoresApi.list).mockResolvedValue(scores);
});

function renderModal(overrides: Partial<Parameters<typeof AddProgramModal>[0]> = {}) {
  return render(
    <AddProgramModal
      orgSlug="o"
      concertId="concert-1"
      stageId="stage-1"
      onClose={vi.fn()}
      onCreated={vi.fn()}
      {...overrides}
    />,
  );
}

describe("AddProgramModal（新しく作成）", () => {
  it("曲名未入力で送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("追加する"));
    expect(await screen.findByText("曲名を入力してください")).toBeInTheDocument();
    expect(concertsApi.addProgram).not.toHaveBeenCalled();
  });

  it("送信成功でconcertsApi.addProgramが呼ばれonCreatedが呼ばれる", async () => {
    vi.mocked(concertsApi.addProgram).mockResolvedValue({
      id: "program-new",
      title: "新曲",
      sortOrder: 0,
      score: null,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderModal({ onCreated });

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "新曲");
    await user.click(screen.getByText("追加する"));

    expect(concertsApi.addProgram).toHaveBeenCalledWith("o", "concert-1", "stage-1", {
      title: "新曲",
      composer: null,
      arranger: null,
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "program-new" }));
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.addProgram).mockRejectedValue(new Error("登録に失敗しました"));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 男声合唱のための「風と光」"), "新曲");
    await user.click(screen.getByText("追加する"));

    expect(await screen.findByText("登録に失敗しました")).toBeInTheDocument();
  });
});

describe("AddProgramModal（既存から選ぶ）", () => {
  it("タブ切替で楽譜一覧を取得して表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("既存から選ぶ"));

    expect(await screen.findByText("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByText("□□の詩")).toBeInTheDocument();
  });

  it("検索語で絞り込める", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("既存から選ぶ"));
    await screen.findByText("男声合唱のための〇〇");
    await user.type(screen.getByPlaceholderText("曲名・作曲者で検索..."), "□□");

    expect(screen.queryByText("男声合唱のための〇〇")).not.toBeInTheDocument();
    expect(screen.getByText("□□の詩")).toBeInTheDocument();
  });

  it("楽譜未選択で送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("既存から選ぶ"));
    await screen.findByText("男声合唱のための〇〇");
    await user.click(screen.getByText("追加する"));

    expect(await screen.findByText("楽譜を選択してください")).toBeInTheDocument();
  });

  it("楽譜を選択して送信するとscoreId付きでconcertsApi.addProgramが呼ばれる", async () => {
    vi.mocked(concertsApi.addProgram).mockResolvedValue({
      id: "program-new",
      title: "男声合唱のための〇〇",
      sortOrder: 0,
      score: { id: "score-1", composer: "△△", arranger: null },
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderModal({ onCreated });

    await user.click(screen.getByText("既存から選ぶ"));
    await user.click(await screen.findByText("男声合唱のための〇〇"));
    await user.click(screen.getByText("追加する"));

    expect(concertsApi.addProgram).toHaveBeenCalledWith("o", "concert-1", "stage-1", {
      scoreId: "score-1",
    });
    expect(onCreated).toHaveBeenCalled();
  });
});

describe("AddProgramModal（閉じる）", () => {
  it("閉じるボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
