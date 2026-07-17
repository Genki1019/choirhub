import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposeModal } from "../ComposeModal";
import { mailingApi, type MailTemplate } from "@/lib/mailing-api";

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
      send: vi.fn(),
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

function renderModal() {
  return render(<ComposeModal orgSlug="o" parts={[]} onClose={vi.fn()} onSent={vi.fn()} />);
}

beforeEach(() => {
  vi.resetAllMocks();
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
    await user.click(await screen.findByLabelText("テンプレートを削除"));
    const confirmRow = screen.getByText("削除しますか？").closest("div") as HTMLElement;
    expect(confirmRow).toBeInTheDocument();

    await user.click(within(confirmRow).getByText("キャンセル"));
    expect(screen.queryByText("削除しますか？")).not.toBeInTheDocument();
    expect(screen.getByText("練習案内テンプレート")).toBeInTheDocument();
  });

  it("削除を確定するとtemplates.deleteが呼ばれ一覧から消える", async () => {
    vi.mocked(mailingApi.templates.list).mockResolvedValue([makeTemplate()]);
    vi.mocked(mailingApi.templates.delete).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("テンプレート"));
    await user.click(await screen.findByLabelText("テンプレートを削除"));
    await user.click(screen.getByText("削除"));

    expect(mailingApi.templates.delete).toHaveBeenCalledWith("o", "template-1");
    expect(await screen.findByText("保存済みテンプレートがありません")).toBeInTheDocument();
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

    expect(await screen.findByText("保存に失敗しました")).toBeInTheDocument();
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
