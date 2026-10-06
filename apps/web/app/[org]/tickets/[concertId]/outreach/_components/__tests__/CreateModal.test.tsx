import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateModal } from "../CreateModal";
import { ticketsApi, type OutreachActivityRow } from "@/lib/tickets-api";
import type { MemberProfile } from "@/lib/api-types";

vi.mock("@/lib/tickets-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tickets-api")>("@/lib/tickets-api");
  return {
    ...actual,
    ticketsApi: {
      createOutreachActivity: vi.fn(),
    },
  };
});

function makeMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "member-1",
    nameJa: "山田太郎",
    nameKana: null,
    nameEn: null,
    avatarUrl: null,
    part: { id: "part-1", name: "テノール1", voiceType: "tenor1", sortOrder: 1 },
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

function makeActivity(overrides: Partial<OutreachActivityRow> = {}): OutreachActivityRow {
  return {
    id: "activity-new",
    concertId: "concert-1",
    destination: "渋谷駅前",
    activityDate: "2026-05-10",
    note: null,
    status: "pending",
    paidAt: null,
    createdById: "member-1",
    creatorName: "山田太郎",
    createdAt: "2026-05-10T00:00:00+09:00",
    participants: [],
    ...overrides,
  };
}

const members = [makeMember(), makeMember({ id: "member-2", nameJa: "鈴木花子" })];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CreateModal（表示）", () => {
  it("×ボタンクリックでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("「参加者を追加」クリックで参加者行が増える", async () => {
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: /^参加者\d+を削除$/ })).toHaveLength(1);
    await user.click(screen.getByText("参加者を追加"));
    expect(screen.getAllByRole("button", { name: /^参加者\d+を削除$/ })).toHaveLength(2);
  });

  it("参加者削除ボタンで行が減る", async () => {
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("参加者を追加"));
    expect(screen.getAllByRole("button", { name: /^参加者\d+を削除$/ })).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: /^参加者\d+を削除$/ })[0]);
    expect(screen.getAllByRole("button", { name: /^参加者\d+を削除$/ })).toHaveLength(1);
  });
});

describe("CreateModal（バリデーション）", () => {
  it("行き先未入力の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.click(screen.getByText("申請する"));
    expect(await screen.findByText("行き先を入力してください")).toBeInTheDocument();
  });

  it("参加者未選択の場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 渋谷駅前、新宿西口"), "渋谷駅前");
    await user.click(screen.getByText("申請する"));
    expect(await screen.findByText("参加者を1人以上選択してください")).toBeInTheDocument();
  });

  it("同じ団員が重複している場合はエラーを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 渋谷駅前、新宿西口"), "渋谷駅前");
    await user.selectOptions(screen.getAllByRole("combobox")[0], "member-1");
    await user.click(screen.getByText("参加者を追加"));
    await user.selectOptions(screen.getAllByRole("combobox")[1], "member-1");
    await user.click(screen.getByText("申請する"));

    expect(await screen.findByText("同じ団員が重複しています")).toBeInTheDocument();
  });
});

describe("CreateModal（送信）", () => {
  it("正しく入力すると createOutreachActivity が呼ばれ onCreated が呼ばれる", async () => {
    vi.mocked(ticketsApi.createOutreachActivity).mockResolvedValue(makeActivity());
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 渋谷駅前、新宿西口"), "渋谷駅前");
    await user.selectOptions(screen.getByRole("combobox"), "member-1");
    await user.type(screen.getByPlaceholderText("枚数"), "3");
    await user.type(screen.getByPlaceholderText("交通費"), "500");
    await user.click(screen.getByText("申請する"));

    expect(ticketsApi.createOutreachActivity).toHaveBeenCalledWith(
      "o",
      "concert-1",
      expect.objectContaining({
        destination: "渋谷駅前",
        participants: [{ memberId: "member-1", ticketsSold: 3, expense: 500 }],
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "activity-new" }));
  });

  describe("活動日の初期値", () => {
    beforeEach(() => {
      // JST 2026-09-29 08:00（UTCでは前日）
      vi.useFakeTimers({ now: new Date("2026-09-28T23:00:00Z"), toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("JSTの今日の日付で申請される", async () => {
      vi.mocked(ticketsApi.createOutreachActivity).mockResolvedValue(makeActivity());
      const user = userEvent.setup();
      render(
        <CreateModal
          orgSlug="o"
          concertId="concert-1"
          members={members}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />,
      );

      await user.type(screen.getByPlaceholderText("例: 渋谷駅前、新宿西口"), "渋谷駅前");
      await user.selectOptions(screen.getByRole("combobox"), "member-1");
      await user.click(screen.getByText("申請する"));

      expect(ticketsApi.createOutreachActivity).toHaveBeenCalledWith(
        "o",
        "concert-1",
        expect.objectContaining({ activityDate: "2026-09-29" }),
      );
    });
  });

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.createOutreachActivity).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const user = userEvent.setup();
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await user.type(screen.getByPlaceholderText("例: 渋谷駅前、新宿西口"), "渋谷駅前");
    await user.selectOptions(screen.getByRole("combobox"), "member-1");
    await user.click(screen.getByText("申請する"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "情宣活動の申請に失敗しました。もう一度お試しください。",
    );
  });
});

describe("CreateModal（モーダルの操作）", () => {
  function renderModal(onClose = vi.fn()) {
    render(
      <CreateModal
        orgSlug="o"
        concertId="concert-1"
        members={members}
        onClose={onClose}
        onCreated={vi.fn()}
      />,
    );
    return { onClose };
  }

  it("「情宣活動を申請」という名前のダイアログとして開き、行き先欄にフォーカスが当たる", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "情宣活動を申請" })).toBeInTheDocument();
    expect(screen.getByLabelText(/行き先/)).toHaveFocus();
  });

  it("すべての入力欄がラベルや名前で見つかる", () => {
    renderModal();

    expect(screen.getByLabelText(/活動日/)).toBeInTheDocument();
    expect(screen.getByLabelText("メモ（任意）")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /参加者/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "参加者1の団員" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "参加者1の販売枚数" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "参加者1の交通費（円）" })).toBeInTheDocument();
  });

  it("行き先欄でEnterを押すと送信する（参加者が空ならalertを出して送らない）", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/行き先/), "渋谷駅前{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("参加者を1人以上選択してください");
    expect(ticketsApi.createOutreachActivity).not.toHaveBeenCalled();
  });

  it("申請中はEscで閉じず、キャンセルも押せない", async () => {
    vi.mocked(ticketsApi.createOutreachActivity).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText(/行き先/), "渋谷駅前");
    await user.selectOptions(screen.getByRole("combobox", { name: "参加者1の団員" }), "member-1");
    await user.click(screen.getByText("申請する"));
    await waitFor(() => expect(ticketsApi.createOutreachActivity).toHaveBeenCalled());
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
  });
});
