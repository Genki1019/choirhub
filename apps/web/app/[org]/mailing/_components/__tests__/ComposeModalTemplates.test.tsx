import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { membersApi } from "@/lib/members-api";
import { ComposeModal } from "../ComposeModal";
import { mailingApi, type MailTemplate } from "@/lib/mailing-api";
import { ApiClientError } from "@/lib/api-client";

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
      send: vi.fn(),
      recipientCount: vi.fn(),
      templates: {
        list: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

function makeTemplate(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    id: "template-1",
    name: "練習案内テンプレート",
    subject: "練習のご案内",
    body: "本文テンプレート",
    createdBy: { id: "member-1", nameJa: "幹事花子" },
    updatedAt: "2026-05-01T00:00:00+09:00",
    ...overrides,
  };
}

vi.mock("@/lib/members-api", () => ({
  membersApi: { parts: vi.fn(), list: vi.fn() },
}));

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderModal() {
  return renderWithClient(<ComposeModal orgSlug="o" onClose={vi.fn()} onSent={vi.fn()} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue([]);
});

describe("ComposeModal（テンプレートパネル）", () => {
  it("「テンプレート」ボタンクリックでパネルを開閉する", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([]);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    expect(await screen.findByText("保存済みテンプレートがありません")).toBeInTheDocument();

    await user.click(screen.getByLabelText("テンプレートパネルを閉じる"));
    expect(screen.queryByText("保存済みテンプレートがありません")).not.toBeInTheDocument();
  });

  it("読み込み中は「読み込み中...」を表示する", async () => {
    vi.mocked(mailingApi.templates.list).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    expect(await screen.findByText("読み込み中...")).toBeInTheDocument();
  });

  it("テンプレート一覧の名前・件名を表示する", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    expect(await screen.findByText("練習案内テンプレート")).toBeInTheDocument();
    expect(screen.getByText("練習のご案内")).toBeInTheDocument();
  });

  it("テンプレートをクリックすると件名・本文に反映されパネルが閉じる", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    await user.click(await screen.findByText("練習案内テンプレート"));

    expect(screen.getByDisplayValue("練習のご案内")).toBeInTheDocument();
    expect(screen.getByDisplayValue("本文テンプレート")).toBeInTheDocument();
    expect(screen.queryByText("練習案内テンプレート")).not.toBeInTheDocument();
  });

  it("🗑️クリックで削除確認を表示し、キャンセルで戻る", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    await user.click(
      await screen.findByRole("button", { name: "テンプレート「練習案内テンプレート」を削除" }),
    );
    const dialog = screen.getByRole("alertdialog", { name: "テンプレートを削除しますか？" });
    expect(dialog).toHaveTextContent("「練習案内テンプレート」を削除します");

    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("練習案内テンプレート")).toBeInTheDocument();
    expect(mailingApi.templates.delete).not.toHaveBeenCalled();
  });

  it("削除を確定するとtemplates.deleteが呼ばれ一覧から消える", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    vi.mocked(mailingApi.templates.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    await user.click(
      await screen.findByRole("button", { name: "テンプレート「練習案内テンプレート」を削除" }),
    );
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(mailingApi.templates.delete).toHaveBeenCalledWith("o", "template-1");
    expect(await screen.findByText("保存済みテンプレートがありません")).toBeInTheDocument();
  });

  it("削除に失敗したら確認ダイアログの中にエラーを表示し、一覧に残す", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    vi.mocked(mailingApi.templates.delete).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    await user.click(
      await screen.findByRole("button", { name: "テンプレート「練習案内テンプレート」を削除" }),
    );
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "テンプレートの削除に失敗しました。もう一度お試しください。",
    );
    expect(screen.getByText("練習案内テンプレート")).toBeInTheDocument();
  });

  it("削除の確認でEscを押すと確認だけが閉じ、作成中のメールは閉じない", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<ComposeModal orgSlug="o" onClose={onClose} onSent={vi.fn()} />);

    await user.click(screen.getByText("テンプレート"));
    await user.click(
      await screen.findByRole("button", { name: "テンプレート「練習案内テンプレート」を削除" }),
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ComposeModal（テンプレート保存モーダル）", () => {
  it("「保存」ボタンクリックで保存モーダルを開く", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("保存"));
    expect(screen.getByText("テンプレートとして保存")).toBeInTheDocument();
  });

  it("テンプレート名未入力の場合はエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("保存"));
    await user.click(screen.getByText("保存", { selector: "button.bg-brand-600" }));

    expect(await screen.findByText("テンプレート名を入力してください")).toBeInTheDocument();
    expect(mailingApi.templates.save).not.toHaveBeenCalled();
  });

  it("件名が空の場合はエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文のみ入力");
    await user.click(screen.getByText("保存"));
    await user.type(screen.getByPlaceholderText("例: 練習案内テンプレート"), "テンプレ名");
    await user.click(screen.getByText("保存", { selector: "button.bg-brand-600" }));

    expect(await screen.findByText("件名が空です")).toBeInTheDocument();
  });

  it("保存成功でtemplates.saveが呼ばれモーダルが閉じる", async () => {
    vi.mocked(mailingApi.templates.save).mockResolvedValue(makeTemplate());
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名テスト");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文テスト");
    await user.click(screen.getByText("保存"));
    await user.type(screen.getByPlaceholderText("例: 練習案内テンプレート"), "テンプレ名");
    await user.click(screen.getByText("保存", { selector: "button.bg-brand-600" }));

    expect(mailingApi.templates.save).toHaveBeenCalledWith("o", {
      name: "テンプレ名",
      subject: "件名テスト",
      body: "本文テスト",
    });
    await waitFor(() => {
      expect(screen.queryByText("テンプレートとして保存")).not.toBeInTheDocument();
    });
  });

  it("保存失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(mailingApi.templates.save).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名テスト");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文テスト");
    await user.click(screen.getByText("保存"));
    await user.type(screen.getByPlaceholderText("例: 練習案内テンプレート"), "テンプレ名");
    await user.click(screen.getByText("保存", { selector: "button.bg-brand-600" }));

    expect(
      await screen.findByText("テンプレートの保存に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
  });

  it("保存の失敗が4xxならAPIの理由を表示する", async () => {
    vi.mocked(mailingApi.templates.save).mockRejectedValue(
      new ApiClientError("VALIDATION_ERROR", "入力値が不正です", 400),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名テスト");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文テスト");
    await user.click(screen.getByText("保存"));
    await user.type(screen.getByLabelText(/テンプレート名/), "テンプレ名");
    await user.click(screen.getByText("保存", { selector: "button.bg-brand-600" }));

    expect(await screen.findByText("入力値が不正です")).toBeInTheDocument();
  });

  it("テンプレート名の欄でEnterを押すと保存し、メールの送信には進まない", async () => {
    vi.mocked(mailingApi.templates.save).mockResolvedValue(makeTemplate());
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名テスト");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文テスト");
    await user.click(screen.getByText("保存"));
    await user.type(screen.getByLabelText(/テンプレート名/), "テンプレ名{Enter}");

    await waitFor(() => expect(mailingApi.templates.save).toHaveBeenCalledTimes(1));
    expect(mailingApi.recipientCount).not.toHaveBeenCalled();
  });

  it("テンプレート名は100文字までしか入力できない", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("保存"));

    expect(screen.getByLabelText(/テンプレート名/)).toHaveAttribute("maxLength", "100");
  });

  it("保存の画面でEscを押すと保存の画面だけが閉じ、作成中のメールは閉じない", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithClient(<ComposeModal orgSlug="o" onClose={onClose} onSent={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名テスト");
    await user.click(screen.getByText("保存"));
    expect(screen.getByLabelText(/テンプレート名/)).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText(/テンプレート名/)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("件名テスト")).toBeInTheDocument();
  });

  it("閉じるボタンで保存モーダルを閉じる", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("保存"));
    const closeButtons = screen.getAllByLabelText("閉じる");
    await user.click(closeButtons[closeButtons.length - 1]);

    expect(screen.queryByText("テンプレートとして保存")).not.toBeInTheDocument();
  });
});
