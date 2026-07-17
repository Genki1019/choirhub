import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProgramModal } from "../EditProgramModal";
import { concertsApi, type ProgramDetail } from "@/lib/concerts-api";

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
    vi.mocked(concertsApi.updateProgram).mockRejectedValue(new Error("更新に失敗しました"));
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
    expect(await screen.findByText("更新に失敗しました")).toBeInTheDocument();
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
});
