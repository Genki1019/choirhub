import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MailDetailPage from "../page";
import { MemberProvider } from "@/contexts/MemberContext";
import { mailingApi, type MailDetail } from "@/lib/mailing-api";
import { ApiClientError } from "@/lib/api-client";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "tokyo-men-choir", id: "mail-1" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
      get: vi.fn(),
      send: vi.fn(),
    },
  };
});

function makeMail(overrides: Partial<MailDetail> = {}): MailDetail {
  return {
    id: "mail-1",
    sentBy: { id: "member-sender", nameJa: "幹事花子" },
    sentAt: "2026-05-30T12:00:00+09:00",
    recipientCount: 2,
    recipientMemberIds: ["member-a", "member-b"],
    recipients: [],
    resend: null,
    ...overrides,
  };
}

function renderPage(roles: string[] = ["member"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider memberId="member-self" roles={roles}>
        <MailDetailPage />
      </MemberProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("MailDetailPage（表示状態）", () => {
  it("データ取得中は「読み込み中...」を表示する", () => {
    vi.mocked(mailingApi.get).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("404エラー時はメール一覧へリダイレクトする", async () => {
    vi.mocked(mailingApi.get).mockRejectedValue(new ApiClientError("NOT_FOUND", "not found", 404));
    renderPage();

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/mailing"));
  });

  it("404以外のエラー時はエラーメッセージを表示する", async () => {
    vi.mocked(mailingApi.get).mockRejectedValue(new Error("取得に失敗しました"));
    renderPage();

    expect(await screen.findByText("取得に失敗しました")).toBeInTheDocument();
  });
});

describe("MailDetailPage（表示内容）", () => {
  it("件名・送信者・送信日時・受信者数を表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({
        resend: {
          subject: "6月練習のご案内",
          html: null,
          text: null,
          lastEvent: "sent",
          createdAt: "2026-05-30T12:00:00+09:00",
        },
      }),
    );
    renderPage();

    expect(await screen.findAllByText("6月練習のご案内")).not.toHaveLength(0);
    expect(screen.getByText("幹事花子")).toBeInTheDocument();
    expect(screen.getByText("2026年5月30日 12:00")).toBeInTheDocument();
    expect(screen.getByText("2名")).toBeInTheDocument();
  });

  it("件名がresendに無い場合は「（件名なし）」を表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail({ resend: null }));
    renderPage();

    expect(await screen.findAllByText("（件名なし）")).not.toHaveLength(0);
  });

  it("resend.htmlがある場合はiframeで本文を表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({
        resend: {
          subject: "件名",
          html: "<p>本文</p>",
          text: null,
          lastEvent: "delivered",
          createdAt: "2026-05-30T12:00:00+09:00",
        },
      }),
    );
    renderPage();

    const iframe = await screen.findByTitle("メール本文");
    expect(iframe).toHaveAttribute("srcdoc", "<p>本文</p>");
    expect(screen.getByText("配信完了")).toBeInTheDocument();
  });

  it("resend.htmlが無くtextがある場合はpreで本文を表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({
        resend: {
          subject: "件名",
          html: null,
          text: "プレーンテキスト本文",
          lastEvent: "opened",
          createdAt: "2026-05-30T12:00:00+09:00",
        },
      }),
    );
    renderPage();

    expect(await screen.findByText("プレーンテキスト本文")).toBeInTheDocument();
  });

  it("resendが未設定の場合は案内メッセージを表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail({ resend: null }));
    renderPage();

    expect(
      await screen.findByText("Resend が未設定のため本文を取得できません"),
    ).toBeInTheDocument();
  });

  it("受信者が1件以上ある場合は配信ステータス一覧を表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({
        recipients: [
          { email: "a@example.com", lastEvent: "delivered" },
          { email: "b@example.com", lastEvent: "bounced" },
        ],
      }),
    );
    renderPage();

    await screen.findByText("配信ステータス");
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("バウンス")).toBeInTheDocument();
  });

  it("受信者が0件の場合は配信ステータスセクションを表示しない", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail({ recipients: [] }));
    renderPage();

    await screen.findByText("幹事花子");
    expect(screen.queryByText("配信ステータス")).not.toBeInTheDocument();
  });
});

describe("MailDetailPage（返信モーダル）", () => {
  it("「返信」ボタンクリックでモーダルを開き、件名の初期値は「Re: 元の件名」になる", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({
        resend: {
          subject: "6月練習のご案内",
          html: null,
          text: null,
          lastEvent: "sent",
          createdAt: "2026-05-30T12:00:00+09:00",
        },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    expect(screen.getByDisplayValue("Re: 6月練習のご案内")).toBeInTheDocument();
  });

  it("本文が空の場合はバリデーションエラーを表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    await user.click(screen.getByRole("button", { name: /名に送信/ }));

    expect(await screen.findByText("本文を入力してください")).toBeInTheDocument();
    expect(mailingApi.send).not.toHaveBeenCalled();
  });

  it("「送信者のみ」（デフォルト）で送信するとmemberIdsに送信者のみ指定される", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail());
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "new-1",
      recipientCount: 1,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    await user.type(screen.getByPlaceholderText("返信内容を入力..."), "承知しました");
    await user.click(screen.getByText("1名に送信"));

    await waitFor(() =>
      expect(mailingApi.send).toHaveBeenCalledWith(
        "tokyo-men-choir",
        expect.objectContaining({
          recipientType: "custom",
          recipientFilter: { memberIds: ["member-sender"] },
        }),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/tokyo-men-choir/mailing");
  });

  it("「全員に返信」を選択すると送信者+受信者（重複除去）がmemberIdsに指定される", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(
      makeMail({ recipientMemberIds: ["member-sender", "member-a"] }),
    );
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "new-1",
      recipientCount: 2,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    await user.click(screen.getByText(/全員に返信/));
    await user.type(screen.getByPlaceholderText("返信内容を入力..."), "承知しました");
    await user.click(screen.getByText("2名に送信"));

    await waitFor(() =>
      expect(mailingApi.send).toHaveBeenCalledWith(
        "tokyo-men-choir",
        expect.objectContaining({
          recipientFilter: { memberIds: ["member-sender", "member-a"] },
        }),
      ),
    );
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail());
    vi.mocked(mailingApi.send).mockRejectedValue(new Error("送信に失敗しました"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    await user.type(screen.getByPlaceholderText("返信内容を入力..."), "承知しました");
    await user.click(screen.getByText("1名に送信"));

    expect(await screen.findByText("送信に失敗しました")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("閉じるボタン・Escapeキーで返信モーダルを閉じる", async () => {
    vi.mocked(mailingApi.get).mockResolvedValue(makeMail());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText("返信"));
    await user.click(screen.getByLabelText("閉じる"));
    expect(screen.queryByPlaceholderText("返信内容を入力...")).not.toBeInTheDocument();

    await user.click(screen.getByText("返信"));
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText("返信内容を入力...")).not.toBeInTheDocument();
  });
});
