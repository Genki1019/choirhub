import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateSurveyModal } from "../CreateSurveyModal";
import { concertsApi } from "@/lib/concerts-api";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      createSurvey: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CreateSurveyModal（デフォルトタイトル）", () => {
  it.each([
    [0, "一次調査"],
    [1, "二次調査"],
    [4, "五次調査"],
    [5, "第6次調査"],
  ])("surveyCount: %iの場合デフォルトタイトルは「%s」", (count, expected) => {
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={count}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
  });
});

describe("CreateSurveyModal（バリデーション・送信）", () => {
  it("タイトルを空にして送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.clear(screen.getByDisplayValue("一次調査"));
    await user.click(screen.getByText("開設する"));

    expect(await screen.findByText("タイトルを入力してください")).toBeInTheDocument();
    expect(concertsApi.createSurvey).not.toHaveBeenCalled();
  });

  it("締切日未入力の場合はcloseAt: nullで送信される", async () => {
    vi.mocked(concertsApi.createSurvey).mockResolvedValue({
      id: "survey-new",
      title: "一次調査",
      isOpen: true,
      openAt: "2026-08-01T00:00:00+09:00",
      closeAt: null,
      responseCount: 0,
    });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={0}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.click(screen.getByText("開設する"));

    expect(concertsApi.createSurvey).toHaveBeenCalledWith("o", "concert-1", {
      title: "一次調査",
      closeAt: null,
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "survey-new" }));
  });

  it("締切日入力時は23:59:00+09:00のISO文字列に変換して送信される", async () => {
    vi.mocked(concertsApi.createSurvey).mockResolvedValue({
      id: "survey-new",
      title: "一次調査",
      isOpen: true,
      openAt: "2026-08-01T00:00:00+09:00",
      closeAt: "2026-08-31T23:59:00+09:00",
      responseCount: 0,
    });
    const user = userEvent.setup();
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("回答締切日（任意）"), "2026-08-31");
    await user.click(screen.getByText("開設する"));

    expect(concertsApi.createSurvey).toHaveBeenCalledWith("o", "concert-1", {
      title: "一次調査",
      closeAt: "2026-08-31T23:59:00+09:00",
    });
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(concertsApi.createSurvey).mockRejectedValue(new Error("作成に失敗しました"));
    const user = userEvent.setup();
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={0}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("開設する"));
    expect(await screen.findByText("作成に失敗しました")).toBeInTheDocument();
  });
});

describe("CreateSurveyModal（閉じる）", () => {
  it("閉じるボタン・キャンセルボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateSurveyModal
        orgSlug="o"
        concertId="concert-1"
        surveyCount={0}
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
