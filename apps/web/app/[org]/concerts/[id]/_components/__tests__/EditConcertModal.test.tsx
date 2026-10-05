import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditConcertModal } from "../EditConcertModal";
import { concertsApi, type ConcertDetail } from "@/lib/concerts-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/concerts-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/concerts-api")>("@/lib/concerts-api");
  return {
    ...actual,
    concertsApi: {
      update: vi.fn(),
    },
  };
});

const concert: ConcertDetail = {
  id: "concert-1",
  title: "第20回定期演奏会",
  heldOn: "2026-11-23T14:00:00+09:00",
  venue: "○○ホール",
  status: "draft",
  linkedEventId: null,
  stages: [],
  surveys: [],
  appliedSurveyId: null,
  assignments: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("EditConcertModal（表示）", () => {
  it("既存の演奏会名・開催日・会場・ステータスを初期値として表示する", () => {
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByDisplayValue("第20回定期演奏会")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-11-23")).toBeInTheDocument();
    expect(screen.getByDisplayValue("○○ホール")).toBeInTheDocument();
    expect(screen.getByDisplayValue("準備中")).toBeInTheDocument();
  });

  it("JST0〜9時開始の演奏会でも、開催日の初期値はJSTの日付になる", () => {
    render(
      <EditConcertModal
        concert={{ ...concert, heldOn: "2026-11-22T23:00:00.000Z" }}
        orgSlug="o"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("2026-11-23")).toBeInTheDocument();
  });

  it("ステータスの選択肢はdraft/confirmed/pastのみでsurvey_openは含まれない", () => {
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["準備中", "確定済み", "終了"]);
  });
});

describe("EditConcertModal（バリデーション）", () => {
  it("演奏会名を空にして送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.clear(screen.getByDisplayValue("第20回定期演奏会"));
    await user.click(screen.getByText("保存する"));

    expect(await screen.findByText("演奏会名を入力してください")).toBeInTheDocument();
    expect(concertsApi.update).not.toHaveBeenCalled();
  });

  it("開催日を空にして送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.clear(screen.getByDisplayValue("2026-11-23"));
    await user.click(screen.getByText("保存する"));

    expect(await screen.findByText("日付を入力してください")).toBeInTheDocument();
    expect(concertsApi.update).not.toHaveBeenCalled();
  });
});

describe("EditConcertModal（送信）", () => {
  it("送信成功でconcertsApi.updateが呼ばれonSaved・oncloseが呼ばれる", async () => {
    vi.mocked(concertsApi.update).mockResolvedValue({
      id: "concert-1",
      title: "第20回定期演奏会",
      heldOn: "2026-11-23T14:00:00+09:00",
      venue: "○○ホール",
      status: "draft",
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={onClose} onSaved={onSaved} />);

    await user.click(screen.getByText("保存する"));

    expect(concertsApi.update).toHaveBeenCalledWith(
      "o",
      "concert-1",
      expect.objectContaining({ title: "第20回定期演奏会", venue: "○○ホール" }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("4xxの送信失敗時はサーバーのメッセージを表示する", async () => {
    vi.mocked(concertsApi.update).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "入力値が不正です", 400),
    );
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByRole("alert")).toHaveTextContent("入力値が不正です");
  });

  it("通信エラー時は代わりの文言を表示する", async () => {
    vi.mocked(concertsApi.update).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByText("保存する"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "演奏会情報の保存に失敗しました。もう一度お試しください。",
    );
  });
});

describe("EditConcertModal（閉じる）", () => {
  it("閉じるボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("「演奏会情報を編集」という名前のダイアログとして開き、演奏会名欄にフォーカスが当たる", () => {
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "演奏会情報を編集" })).toBeInTheDocument();
    expect(screen.getByLabelText(/演奏会名/)).toHaveFocus();
  });

  it("すべての入力欄がラベルの名前で見つかる", () => {
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/開催日/)).toHaveValue("2026-11-23");
    expect(screen.getByLabelText("会場")).toHaveValue("○○ホール");
    expect(screen.getByLabelText("ステータス")).toHaveValue("draft");
  });

  it("演奏会名欄でEnterを押すと送信する", async () => {
    vi.mocked(concertsApi.update).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/演奏会名/), "{Enter}");

    await waitFor(() => expect(concertsApi.update).toHaveBeenCalledTimes(1));
  });

  it("保存中はEscで閉じず、×・キャンセルも押せない", async () => {
    vi.mocked(concertsApi.update).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditConcertModal concert={concert} orgSlug="o" onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByText("保存する"));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("閉じる")).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});
