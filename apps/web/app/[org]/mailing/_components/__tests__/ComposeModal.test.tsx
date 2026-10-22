import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ComposeModal } from "../ComposeModal";
import { mailingApi } from "@/lib/mailing-api";
import { ApiClientError } from "@/lib/api-client";
import { homeKeys, mailingKeys } from "@/lib/query-keys";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
      recipientCount: vi.fn(),
      send: vi.fn(),
      templates: { list: vi.fn().mockResolvedValue([]) },
    },
  };
});

vi.mock("@/lib/members-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/members-api")>("@/lib/members-api");
  return {
    ...actual,
    membersApi: {
      list: vi.fn(),
      parts: vi.fn(),
    },
  };
});

const parts: PartSummary[] = [
  { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 0 },
  { id: "part-2", name: "ベース", voiceType: "bass1", sortOrder: 1 },
];

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part: null,
    memberType: null,
    roles: ["member"],
    status: "active",
    bio: null,
    job: null,
    interests: null,
    originGroup: null,
    joinedAt: null,
    ...overrides,
  };
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderModal(overrides: Partial<Parameters<typeof ComposeModal>[0]> = {}) {
  return renderWithClient(
    <ComposeModal orgSlug="o" onClose={vi.fn()} onSent={vi.fn()} {...overrides} />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(membersApi.parts).mockResolvedValue(parts);
  vi.mocked(mailingApi.templates.list).mockResolvedValue([]);
  vi.mocked(mailingApi.recipientCount).mockResolvedValue({ count: 5 });
});

async function confirmSend(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "送信する" }));
}

describe("ComposeModal（バリデーション）", () => {
  it("件名未入力で送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文です");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("件名を入力してください")).toBeInTheDocument();
    expect(mailingApi.send).not.toHaveBeenCalled();
  });

  it("本文未入力で送信するとエラーメッセージを表示する", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名です");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("本文を入力してください")).toBeInTheDocument();
  });
});

describe("ComposeModal（送信先タブ）", () => {
  it("デフォルトは「全員」で、パート/ロール/個別のチェックボックス欄は表示されない", () => {
    renderModal();
    expect(screen.queryByText("テノール1")).not.toBeInTheDocument();
  });

  it("「パート」タブでパート一覧を表示し、未選択で送信するとエラーになる", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("パート"));
    expect(screen.getByText("テノール1")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("パートを選択してください")).toBeInTheDocument();
  });

  it("パートを選択して送信するとrecipientFilterにpartIdsが渡る", async () => {
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "m1",
      recipientCount: 5,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const onSent = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSent, onClose });

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("パート"));
    await user.click(screen.getByText("テノール1"));
    await user.click(screen.getByText("送信する"));
    await confirmSend(user);

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        recipientType: "part",
        recipientFilter: { partIds: ["part-1"] },
      }),
    );
    expect(onSent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("「ロール」タブはvisitorを除く全ロールを表示し、未選択で送信するとエラーになる", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("ロール"));
    expect(screen.getByText("最高管理者")).toBeInTheDocument();
    expect(screen.queryByText("体験")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("ロールを選択してください")).toBeInTheDocument();
  });

  it("ロールを選択して送信するとrecipientFilterにrolesが渡る", async () => {
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "m1",
      recipientCount: 3,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("ロール"));
    await user.click(screen.getByText("最高管理者"));
    await user.click(screen.getByText("送信する"));
    await confirmSend(user);

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        recipientType: "role",
        recipientFilter: { roles: ["admin"] },
      }),
    );
  });

  it("「個別」タブ初回選択時にmembersApi.listを呼び出しメンバー一覧を表示する", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("個別"));

    expect(await screen.findByText("山田太郎")).toBeInTheDocument();
    expect(membersApi.list).toHaveBeenCalledWith("o", { status: "active" });
  });

  it("個別タブでメンバー未選択のまま送信するとエラーになる", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("個別"));
    await screen.findByText("山田太郎");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("送信先を選択してください")).toBeInTheDocument();
  });

  it("メンバーを選択して送信するとrecipientFilterにmemberIdsが渡る", async () => {
    vi.mocked(membersApi.list).mockResolvedValue([makeMember()]);
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "m1",
      recipientCount: 1,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("個別"));
    await user.click(await screen.findByText("山田太郎"));
    await user.click(screen.getByText("送信する"));
    await confirmSend(user);

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        recipientType: "custom",
        recipientFilter: { memberIds: ["member-1"] },
      }),
    );
  });
});

describe("ComposeModal（全員送信・送信失敗）", () => {
  it("「全員」のまま送信するとrecipientFilterはnullで送信される", async () => {
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "m1",
      recipientCount: 40,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));
    await confirmSend(user);

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ recipientType: "all", recipientFilter: null }),
    );
  });

  it("送信失敗時は確認ダイアログの中にエラーメッセージを表示する", async () => {
    vi.mocked(mailingApi.send).mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));
    await confirmSend(user);

    expect(await within(screen.getByRole("alertdialog")).findByRole("alert")).toHaveTextContent(
      "送信に失敗しました。もう一度お試しください。",
    );
  });
});

describe("ComposeModal（送信前の確認）", () => {
  async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "7月練習のご案内");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));
  }

  it("送信するとサーバーで数えた宛先人数つきの確認を出し、確定するまで送信しない", async () => {
    vi.mocked(mailingApi.recipientCount).mockResolvedValue({ count: 32 });
    const user = userEvent.setup();
    renderModal();

    await fillAndSend(user);

    expect(mailingApi.recipientCount).toHaveBeenCalledWith("o", {
      recipientType: "all",
      recipientFilter: null,
    });
    const dialog = await screen.findByRole("alertdialog", { name: "32名にメールを送信しますか？" });
    expect(dialog).toHaveTextContent("件名「7月練習のご案内」のメールを送信します");
    expect(mailingApi.send).not.toHaveBeenCalled();
  });

  it("人数を数えている間に宛先を変えても、確認した宛先に送る", async () => {
    let resolveCount: (v: { count: number }) => void = () => {};
    vi.mocked(mailingApi.recipientCount).mockReturnValue(
      new Promise((resolve) => (resolveCount = resolve)),
    );
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "m1",
      recipientCount: 3,
      sentAt: "2026-06-01T00:00:00+09:00",
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("パート"));
    await user.click(screen.getByText("テノール1"));
    await user.click(screen.getByText("送信する"));
    await user.click(screen.getByText("ベース"));
    resolveCount({ count: 3 });
    await confirmSend(user);

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({
        recipientType: "part",
        recipientFilter: { partIds: ["part-1"] },
      }),
    );
  });

  it("確認でキャンセルすると送信せず、入力内容は残る", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await fillAndSend(user);
    await screen.findByRole("alertdialog");
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "キャンセル" }),
    );

    expect(mailingApi.send).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("7月練習のご案内")).toBeInTheDocument();
  });

  it("確認をキャンセルすると、送信ボタンにフォーカスが戻る", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    const sendButton = screen.getByRole("button", { name: "送信する" });
    sendButton.focus();
    await user.keyboard("{Enter}");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "キャンセル" }),
    );

    await waitFor(() => expect(sendButton).toHaveFocus());
  });

  it("宛先人数の取得中にもう一度押しても、数え直さない", async () => {
    vi.mocked(mailingApi.recipientCount).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));
    await user.click(screen.getByText("送信する"));

    expect(mailingApi.recipientCount).toHaveBeenCalledTimes(1);
  });

  it("確認でEscを押すと確認だけが閉じ、作成中のメールは閉じない", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await fillAndSend(user);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("7月練習のご案内")).toBeInTheDocument();
  });

  it("宛先が0名なら確認を出さずに送信できないことを伝える", async () => {
    vi.mocked(mailingApi.recipientCount).mockResolvedValue({ count: 0 });
    const user = userEvent.setup();
    renderModal();

    await fillAndSend(user);

    expect(
      await screen.findByText("宛先に該当する団員がいません。宛先を選び直してください。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mailingApi.send).not.toHaveBeenCalled();
  });

  it("宛先人数の取得に失敗したらエラーを表示し、送信しない", async () => {
    vi.mocked(mailingApi.recipientCount).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderModal();

    await fillAndSend(user);

    expect(
      await screen.findByText("宛先の確認に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mailingApi.send).not.toHaveBeenCalled();
  });
});

describe("ComposeModal（閉じる）", () => {
  it("閉じるボタン・キャンセルボタン・Escapeキーでoncloseを呼ぶ", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });

    await user.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText("キャンセル"));
    expect(onClose).toHaveBeenCalledTimes(2);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("ComposeModal（下書きの事前入力）", () => {
  it("initialSubject/initialBody/initialRecipientTypeで初期値が入った状態で開く", () => {
    renderModal({
      initialSubject: "見学者のご紹介",
      initialBody: "・見学 太郎さん（希望パート: テノール）",
      initialRecipientType: "all",
    });

    expect(screen.getByDisplayValue("見学者のご紹介")).toBeInTheDocument();
    expect(screen.getByDisplayValue("・見学 太郎さん（希望パート: テノール）")).toBeInTheDocument();
  });

  it("初期値を渡さない場合は空の状態で開く（既存呼び出し元への影響なし）", () => {
    renderModal();

    expect(screen.getByPlaceholderText("例: 6月練習のご案内")).toHaveValue("");
  });
});

describe("ComposeModal（キーボード・読み上げ）", () => {
  it("開くと件名の欄にフォーカスが入り、ダイアログの名前は「新規メール」になる", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "新規メール" })).toBeInTheDocument();
    expect(screen.getByLabelText(/件名/)).toHaveFocus();
  });

  it("件名の欄でEnterを押すと宛先を数えて確認に進む", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/本文/), "本文");
    await user.type(screen.getByLabelText(/件名/), "件名{Enter}");

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(mailingApi.recipientCount).toHaveBeenCalledTimes(1);
  });

  it("本文でEnterを押すと改行し、送信には進まない", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/件名/), "件名");
    await user.type(screen.getByLabelText(/本文/), "1行目{Enter}2行目");

    expect(screen.getByLabelText(/本文/)).toHaveValue("1行目\n2行目");
    expect(mailingApi.recipientCount).not.toHaveBeenCalled();
  });

  it("送信先のタブは選択中のものだけが押された状態として読み上げられる", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole("button", { name: "全員" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "ロール" }));

    expect(screen.getByRole("button", { name: "全員" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "ロール" })).toHaveAttribute("aria-pressed", "true");
  });

  it("パートの取得に失敗したら「パート」タブに理由を出す", async () => {
    vi.mocked(membersApi.parts).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "パート" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パートの読み込みに失敗しました。ページを再読み込みしてください。",
    );
  });

  it("個別の団員の取得の失敗が4xxならAPIの理由を出す", async () => {
    vi.mocked(membersApi.list).mockRejectedValue(
      new ApiClientError("FORBIDDEN", "閲覧権限がありません", 403),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "個別" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("閲覧権限がありません");
  });
});

describe("ComposeModal（送信後の一覧の更新）", () => {
  it("送信に成功するとメール一覧とホームの取得をやり直す", async () => {
    vi.mocked(mailingApi.send).mockResolvedValue({
      mailLogId: "mail-new",
      recipientCount: 5,
      sentAt: "2026-06-01T10:00:00+09:00",
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(mailingKeys.list("o", 2), { data: [], meta: {} });
    queryClient.setQueryData(homeKeys.get("o"), {});
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <ComposeModal orgSlug="o" onClose={vi.fn()} onSent={vi.fn()} />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText(/件名/), "件名");
    await user.type(screen.getByLabelText(/本文/), "本文");
    await user.click(screen.getByRole("button", { name: "送信する" }));
    await confirmSend(user);

    await waitFor(() => expect(mailingApi.send).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(mailingKeys.list("o", 2))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(homeKeys.get("o"))?.isInvalidated).toBe(true);
  });
});
