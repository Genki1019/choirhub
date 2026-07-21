import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposeModal } from "../ComposeModal";
import { mailingApi } from "@/lib/mailing-api";
import { membersApi, type MemberProfile, type PartSummary } from "@/lib/members-api";

vi.mock("@/lib/mailing-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mailing-api")>("@/lib/mailing-api");
  return {
    ...actual,
    mailingApi: {
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

function renderModal(overrides: Partial<Parameters<typeof ComposeModal>[0]> = {}) {
  return render(
    <ComposeModal orgSlug="o" parts={parts} onClose={vi.fn()} onSent={vi.fn()} {...overrides} />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(mailingApi.templates.list).mockResolvedValue([]);
});

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

    expect(mailingApi.send).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ recipientType: "all", recipientFilter: null }),
    );
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(mailingApi.send).mockRejectedValue(new Error("送信に失敗しました"));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText("例: 6月練習のご案内"), "件名");
    await user.type(screen.getByPlaceholderText("メール本文を入力..."), "本文");
    await user.click(screen.getByText("送信する"));

    expect(await screen.findByText("送信に失敗しました")).toBeInTheDocument();
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
