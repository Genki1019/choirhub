import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

    await user.click(screen.getByText("×"));
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

    expect(screen.getAllByLabelText("参加者を削除")).toHaveLength(1);
    await user.click(screen.getByText("参加者を追加"));
    expect(screen.getAllByLabelText("参加者を削除")).toHaveLength(2);
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
    expect(screen.getAllByLabelText("参加者を削除")).toHaveLength(2);

    await user.click(screen.getAllByLabelText("参加者を削除")[0]);
    expect(screen.getAllByLabelText("参加者を削除")).toHaveLength(1);
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

  it("送信失敗時はエラーメッセージを表示する", async () => {
    vi.mocked(ticketsApi.createOutreachActivity).mockRejectedValue(new Error("送信に失敗しました"));
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

    expect(await screen.findByText("送信に失敗しました")).toBeInTheDocument();
  });
});
