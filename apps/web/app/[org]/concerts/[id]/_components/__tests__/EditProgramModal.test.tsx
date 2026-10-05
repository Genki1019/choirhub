import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProgramModal } from "../EditProgramModal";
import { concertsApi, type ProgramDetail } from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      updateProgram: vi.fn(),
    },
  };
});

const program: ProgramDetail = {
  id: "program-1",
  title: "男声合唱のための〇〇",
  sortOrder: 0,
  score: { id: "score-1", composer: "△△", arranger: "□□" },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EditProgramModal", () => {
  it("既存の曲名・作曲者・編曲者を初期値として表示する", () => {
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("男声合唱のための〇〇")).toBeInTheDocument();
    expect(screen.getByDisplayValue("△△")).toBeInTheDocument();
    expect(screen.getByDisplayValue("□□")).toBeInTheDocument();
  });

  it("曲名を空にして送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.clear(screen.getByDisplayValue("男声合唱のための〇〇"));
    await user.click(screen.getByText("保存する"));

    expect(await screen.findByText("曲名を入力してください")).toBeInTheDocument();
    expect(concertsApi.updateProgram).not.toHaveBeenCalled();
  });

  it("送信成功でconcertsApi.updateProgramが呼ばれonSavedが呼ばれる", async () => {
    vi.mocked(concertsApi.updateProgram).mockResolvedValue({
      ...program,
      title: "改題後",
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    const titleInput = screen.getByDisplayValue("男声合唱のための〇〇");
    await user.clear(titleInput);
    await user.type(titleInput, "改題後");
    await user.click(screen.getByText("保存する"));

    expect(concertsApi.updateProgram).toHaveBeenCalledWith("o", "concert-1", "program-1", {
      title: "改題後",
      composer: "△△",
      arranger: "□□",
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: "改題後" }));
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.updateProgram).mockRejectedValue(
      new ApiClientError("NOT_FOUND", "曲目が見つかりません", 404),
    );
    const user = userEvent.setup();
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByRole("alert")).toHaveTextContent("曲目が見つかりません");
  });

  it("閉じるボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  function renderModal(onClose = vi.fn()) {
    render(
      <EditProgramModal
        orgSlug="o"
        concertId="concert-1"
        program={program}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );
    return { onClose };
  }

  it("「曲目を編集」という名前のダイアログとして開き、曲名欄にフォーカスが当たる", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "曲目を編集" })).toBeInTheDocument();
    expect(screen.getByLabelText(/曲名/)).toHaveFocus();
  });

  it("すべての入力欄がラベルの名前で見つかる", () => {
    renderModal();

    expect(screen.getByLabelText("作曲者")).toHaveValue("△△");
    expect(screen.getByLabelText("編曲者")).toHaveValue("□□");
  });

  it("入力欄でEnterを押すと送信する", async () => {
    vi.mocked(concertsApi.updateProgram).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("作曲者"), "{Enter}");

    await waitFor(() => expect(concertsApi.updateProgram).toHaveBeenCalledTimes(1));
  });

  it("保存中はEscで閉じず、×・キャンセルも押せない", async () => {
    vi.mocked(concertsApi.updateProgram).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByText("保存する"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("閉じる")).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});
